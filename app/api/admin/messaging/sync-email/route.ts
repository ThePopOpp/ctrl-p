import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

type EmailAddress = {
  address?: string;
  name?: string;
};

function asBoolean(value: string) {
  return value.toLowerCase() === "true" || value === "1";
}

function missing(...names: string[]) {
  return names.filter((name) => !serverEnv(name));
}

function cleanEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const missingEnv = missing("IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD");
  if (missingEnv.length) return jsonError(`Missing IMAP environment variables: ${missingEnv.join(", ")}`, 501);

  const client = new ImapFlow({
    host: serverEnv("IMAP_HOST"),
    port: Number(serverEnv("IMAP_PORT") || 993),
    secure: asBoolean(serverEnv("IMAP_SECURE") || "true"),
    auth: {
      user: serverEnv("IMAP_USER"),
      pass: serverEnv("IMAP_PASSWORD"),
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(serverEnv("IMAP_MAILBOX") || "INBOX");

    try {
      const imported: {
        from: string;
        subject: string;
        body: string;
        sent_at: string | null;
        user_id: string | null;
      }[] = [];

      for await (const message of client.fetch({ seen: false }, { envelope: true, source: true, internalDate: true, uid: true })) {
        const from = cleanEmail((message.envelope?.from?.[0] as EmailAddress | undefined)?.address);
        const subject = String(message.envelope?.subject || "(No subject)").slice(0, 240);
        const body = message.source ? message.source.toString("utf8").slice(0, 12000) : "Imported email message.";

        let userId: string | null = null;
        if (from) {
          const userResult = await verified.adminClient
            .from("users")
            .select("id")
            .eq("email", from)
            .maybeSingle();
          userId = userResult.data?.id ?? null;
        }

        imported.push({
          from,
          subject,
          body,
          sent_at: message.internalDate ? new Date(message.internalDate).toISOString() : null,
          user_id: userId,
        });

        if (imported.length >= 25) break;
      }

      if (!imported.length) {
        return NextResponse.json({ imported: 0, messageIds: [] });
      }

      const rows = imported.map((message) => ({
        user_id: message.user_id,
        order_id: null,
        channel: "email",
        direction: "inbound",
        subject: message.subject,
        body: message.body,
        internal_only: false,
        sent_at: message.sent_at,
        created_by: null,
      }));

      const insertResult = await verified.adminClient.from("messages").insert(rows).select("id");
      if (insertResult.error) return jsonError(insertResult.error.message, 400);

      await verified.adminClient.from("activity_logs").insert({
        actor_id: verified.actorId,
        action: "email_inbox_synced",
        entity_type: "message",
        entity_id: insertResult.data?.[0]?.id ?? null,
        details: { imported: insertResult.data?.length ?? 0 },
      });

      return NextResponse.json({
        imported: insertResult.data?.length ?? 0,
        messageIds: insertResult.data?.map((row) => row.id) ?? [],
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Email sync failed.", 502);
  } finally {
    await client.logout().catch(() => undefined);
  }
}
