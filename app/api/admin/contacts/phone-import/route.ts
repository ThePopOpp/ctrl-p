import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import {
  type ContactColumns,
  type ContactDraft,
  draftNotes,
  fillBlanks,
  isValidEmail,
  normalizePhone,
  phoneKey,
  placeholderEmailFor,
  sanitizeDraft,
} from "@/lib/contacts/phone-import";

type UserRow = ContactColumns & { id: string; email: string | null; deleted_at: string | null };

export type PhoneImportOutcome = { name: string; outcome: "added" | "updated" | "unchanged" | "failed"; error?: string; placeholder_email?: boolean };

const MAX_ROWS = 500;

/**
 * Save contacts imported from a phone. New people become customer accounts the
 * same way the CSV import creates them (no invite email; phone-only contacts get
 * a placeholder email and Pending status). People who already exist only have
 * blank fields filled — email, role and status are never changed. Matching is
 * re-checked here against the database, so a stale list in the browser can't
 * create a duplicate.
 */
export async function POST(request: Request) {
  // Same audience as the CSV user import and "Add customer": admins only.
  const verified = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if (verified.error) return verified.error;
  const { adminClient: client, actorId } = verified;

  const body = (await request.json().catch(() => null)) as { add?: unknown[]; merge?: { user_id?: unknown; draft?: unknown }[] } | null;
  const add = (Array.isArray(body?.add) ? body.add : []).map(sanitizeDraft).filter((draft): draft is ContactDraft => Boolean(draft));
  const merge = (Array.isArray(body?.merge) ? body.merge : [])
    .map((item) => ({ userId: typeof item?.user_id === "string" ? item.user_id : "", draft: sanitizeDraft(item?.draft) }))
    .filter((item): item is { userId: string; draft: ContactDraft } => Boolean(item.userId && item.draft));

  if (!add.length && !merge.length) return jsonError("No contacts to import.");
  if (add.length + merge.length > MAX_ROWS) return jsonError(`Import at most ${MAX_ROWS} contacts at a time.`);

  // Load every profile once (including deleted ones, so they are never silently recreated).
  const rows: UserRow[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await client
      .from("users")
      .select("id, email, full_name, phone, company, notes, profile_photo_url, deleted_at")
      .range(from, from + 999);
    if (page.error) return jsonError(page.error.message, 400);
    rows.push(...((page.data ?? []) as UserRow[]));
    if (!page.data || page.data.length < 1000) break;
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byEmail = new Map(rows.filter((row) => row.email).map((row) => [row.email!.toLowerCase(), row]));
  const byPhone = new Map<string, UserRow>();
  for (const row of rows) {
    const key = phoneKey(row.phone);
    if (key.length >= 10 && !byPhone.has(key)) byPhone.set(key, row);
  }

  const results: PhoneImportOutcome[] = [];

  async function fill(row: UserRow, draft: ContactDraft) {
    if (row.deleted_at) {
      results.push({ name: draft.name, outcome: "failed", error: "Matches a deleted user — restore them in Users first." });
      return;
    }
    const patch = fillBlanks(row, draft);
    if (!Object.keys(patch).length) {
      results.push({ name: draft.name, outcome: "unchanged" });
      return;
    }
    const saved = await client.from("users").update(patch).eq("id", row.id);
    if (saved.error) {
      results.push({ name: draft.name, outcome: "failed", error: saved.error.message });
      return;
    }
    Object.assign(row, patch);
    results.push({ name: draft.name, outcome: "updated" });
  }

  for (const { userId, draft } of merge) {
    const row = byId.get(userId);
    if (!row) results.push({ name: draft.name, outcome: "failed", error: "That contact no longer exists." });
    else await fill(row, draft);
  }

  for (const draft of add) {
    const placeholder = !isValidEmail(draft.email);
    const email = placeholder ? placeholderEmailFor(draft.phone || draft.sms) : draft.email.toLowerCase();
    if (!email) {
      results.push({ name: draft.name, outcome: "failed", error: "No email or usable phone number." });
      continue;
    }

    const match = byEmail.get(email)
      ?? [draft.phone, draft.sms].map(phoneKey).filter((key) => key.length >= 10).map((key) => byPhone.get(key)).find(Boolean);
    if (match) {
      await fill(match, draft);
      continue;
    }

    const profile = {
      email,
      full_name: draft.name,
      phone: normalizePhone(draft.phone || draft.sms) || null,
      company: draft.company || null,
      notes: draftNotes(draft) || null,
      profile_photo_url: draft.photoUrl ?? null,
      status: placeholder ? "pending" : "active",
    };

    let userId: string | null = null;
    const created = await client.auth.admin.createUser({
      email,
      password: `${crypto.randomUUID()}aA1!`,
      email_confirm: true,
      user_metadata: {
        full_name: draft.name,
        phone: profile.phone,
        company: profile.company,
        address_line1: draft.address || null,
        city: draft.city || null,
        state: draft.state || null,
        zip: draft.zip || null,
        source: "phone_import",
      },
    });

    if (created.error || !created.data.user) {
      const message = created.error?.message ?? "Could not create the contact.";
      // An auth account without a profile (e.g. an earlier failed import): recover it instead of failing.
      if (/already|registered|exists/i.test(message)) {
        const lookup = await client.rpc("get_auth_user_id_by_email", { user_email: email });
        userId = typeof lookup.data === "string" ? lookup.data : null;
      }
      if (!userId) {
        results.push({ name: draft.name, outcome: "failed", error: message });
        continue;
      }
    } else {
      userId = created.data.user.id;
    }

    // New accounts are customers (the users table default); an existing profile row keeps its role.
    const existingRow = byId.get(userId);
    const saved = existingRow
      ? await client.from("users").update(fillBlanks(existingRow, draft)).eq("id", userId)
      : await client.from("users").upsert({ id: userId, role: "customer", ...profile });
    if (saved.error) {
      results.push({ name: draft.name, outcome: "failed", error: saved.error.message });
      continue;
    }

    await client.from("activity_logs").insert({
      actor_id: actorId,
      action: "user_created",
      entity_type: "user",
      entity_id: userId,
      details: { email, source: "phone_import", placeholder_email: placeholder },
    });

    const row: UserRow = { id: userId, deleted_at: null, ...profile };
    byId.set(userId, row);
    byEmail.set(email, row);
    const key = phoneKey(profile.phone);
    if (key.length >= 10) byPhone.set(key, row);
    results.push({ name: draft.name, outcome: "added", placeholder_email: placeholder });
  }

  const count = (outcome: PhoneImportOutcome["outcome"]) => results.filter((result) => result.outcome === outcome).length;
  return NextResponse.json({
    added: count("added"),
    updated: count("updated"),
    unchanged: count("unchanged"),
    failed: count("failed"),
    placeholders: results.filter((result) => result.placeholder_email).length,
    results,
  });
}
