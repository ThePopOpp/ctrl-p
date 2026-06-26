import type { SupabaseClient } from "@supabase/supabase-js";
import twilio from "twilio";

import {
  sendLeadNotification,
  sendLeadFollowUp,
  sendScanAlert,
  sendPaymentAutomation,
} from "./card-emails";

function env(name: string) { return process.env[name] || ""; }

function appUrl() { return env("PUBLIC_APP_URL").replace(/\/$/, "") || "https://my.controlp.io"; }

export type CardTriggerType =
  | "lead_submit"
  | "nfc_tap"
  | "qr_scan"
  | "payment_received"
  | "payment_failed"
  | "subscription_activated"
  | "subscription_cancelled";

export interface AutomationTriggerData {
  card_id?: string;
  card_name?: string;
  card_owner_id?: string;
  card_slug?: string;
  lead_id?: string;
  lead_name?: string | null;
  lead_email?: string | null;
  lead_phone?: string | null;
  lead_message?: string | null;
  lead_company?: string | null;
  lead_source?: string;
  device_type?: string;
  event_type?: string;
  order_id?: string;
  amount?: number;
  [key: string]: unknown;
}

// ── Resolve owner contact info ───────────────────────────────────────────────
async function ownerInfo(adminClient: SupabaseClient, ownerId: string) {
  const result = await adminClient
    .from("users")
    .select("email, full_name, phone")
    .eq("id", ownerId)
    .maybeSingle();
  return result.data ?? null;
}

// ── Send SMS via Twilio ───────────────────────────────────────────────────────
async function sendSms(to: string, body: string) {
  const sid   = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from  = env("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) return;
  await twilio(sid, token).messages.create({ from, to, body });
}

// ── Interpolate {{variable}} tokens in a template string ────────────────────
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ""));
}

// ── Conditions match check (simple equality on each key) ────────────────────
function conditionsMatch(conditions: Record<string, unknown>, data: AutomationTriggerData): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    if (key === "card_id") continue; // handled at query level
    if (String(data[key] ?? "") !== String(expected)) return false;
  }
  return true;
}

// ── Execute a single automation immediately ──────────────────────────────────
async function executeAutomation(
  adminClient: SupabaseClient,
  automation: {
    id: string;
    action_type: string;
    action_data: Record<string, unknown>;
    digital_card_id: string | null;
  },
  data: AutomationTriggerData
): Promise<{ ok: boolean; error?: string }> {
  const { action_type, action_data } = automation;
  const dash = `${appUrl()}/dashboard/customer/digital-cards/${data.card_id ?? ""}`;
  const cardPublicUrl = data.card_slug ? `${appUrl()}/c/${data.card_slug}` : appUrl();

  try {
    // ── send_email ───────────────────────────────────────────────────────────
    if (action_type === "send_email") {
      const template = String(action_data.template ?? "");
      const toTarget  = String(action_data.to ?? "owner");

      if (template === "lead_notification" || (toTarget === "owner" && data.lead_id)) {
        if (!data.card_owner_id) return { ok: false, error: "No card owner id" };
        const owner = await ownerInfo(adminClient, data.card_owner_id);
        if (!owner?.email) return { ok: false, error: "Owner email not found" };
        await sendLeadNotification({
          ownerEmail: owner.email,
          ownerName: owner.full_name || "Card owner",
          cardName: data.card_name || "Your card",
          cardPublicUrl,
          leadName: data.lead_name ?? null,
          leadEmail: data.lead_email ?? null,
          leadPhone: data.lead_phone ?? null,
          leadMessage: data.lead_message ?? null,
          leadSource: data.lead_source || "public_card",
          leadCompany: data.lead_company ?? null,
          dashboardUrl: dash,
        });

      } else if (template === "lead_followup" || toTarget === "lead") {
        if (!data.lead_email) return { ok: false, error: "No lead email" };
        if (!data.card_owner_id) return { ok: false, error: "No card owner id" };
        const owner = await ownerInfo(adminClient, data.card_owner_id);
        await sendLeadFollowUp({
          leadEmail: data.lead_email,
          leadName: data.lead_name ?? null,
          ownerName: owner?.full_name || "Your contact",
          cardName: data.card_name || "My card",
          cardPublicUrl,
          customMessage: action_data.message ? String(action_data.message) : undefined,
        });

      } else if (template === "scan_alert") {
        if (!data.card_owner_id) return { ok: false, error: "No card owner id" };
        const owner = await ownerInfo(adminClient, data.card_owner_id);
        if (!owner?.email) return { ok: false, error: "Owner email not found" };
        await sendScanAlert({
          ownerEmail: owner.email,
          ownerName: owner.full_name || "Card owner",
          cardName: data.card_name || "Your card",
          eventType: (data.event_type ?? "qr_scan") as "nfc_tap" | "qr_scan",
          deviceType: data.device_type || "unknown",
          dashboardUrl: dash,
        });

      } else if (template === "payment_automation") {
        const recipient = toTarget === "owner" && data.card_owner_id
          ? await ownerInfo(adminClient, data.card_owner_id)
          : { email: data.lead_email, full_name: data.lead_name };
        if (!recipient?.email) return { ok: false, error: "No recipient email" };
        await sendPaymentAutomation({
          to: recipient.email,
          recipientName: (recipient.full_name as string) || null,
          triggerType: data.event_type || "payment_received",
          amount: data.amount,
          customSubject: action_data.subject ? String(action_data.subject) : undefined,
          customMessage: action_data.message ? String(action_data.message) : undefined,
        });
      }

    // ── send_sms ─────────────────────────────────────────────────────────────
    } else if (action_type === "send_sms") {
      const toTarget = String(action_data.to ?? "owner");
      let toPhone: string | null = null;

      if (toTarget === "owner" && data.card_owner_id) {
        const owner = await ownerInfo(adminClient, data.card_owner_id);
        toPhone = owner?.phone ?? null;
      } else if (toTarget === "lead") {
        toPhone = data.lead_phone ?? null;
      }

      if (!toPhone) return { ok: false, error: "No phone number resolved" };
      const message = interpolate(
        String(action_data.message ?? "New activity on your ControlP.io card."),
        { ...data, card_name: data.card_name ?? "" }
      );
      await sendSms(toPhone, message);

    // ── notify_admin ─────────────────────────────────────────────────────────
    } else if (action_type === "notify_admin") {
      await adminClient.from("admin_notifications").insert({
        type: "info",
        title: interpolate(String(action_data.title ?? "Card automation triggered"), data as Record<string, unknown>),
        body: interpolate(String(action_data.message ?? ""), data as Record<string, unknown>),
      });

    // ── tag_lead ─────────────────────────────────────────────────────────────
    } else if (action_type === "tag_lead") {
      if (!data.lead_id) return { ok: false, error: "No lead id" };
      const newTags = (action_data.tags as string[] | undefined) ?? [];
      // Auto-tag by source if configured
      if (action_data.auto_source && data.lead_source) {
        newTags.push(data.lead_source);
      }
      if (newTags.length) {
        try {
          await adminClient.rpc("add_lead_tags" as never, {
            p_lead_id: data.lead_id,
            p_tags: newTags,
          });
        } catch {
          // Fallback: fetch-merge-update if RPC doesn't exist
          const existing = await adminClient
            .from("digital_card_leads")
            .select("tags")
            .eq("id", data.lead_id)
            .maybeSingle();
          const merged = [...new Set([...(existing.data?.tags ?? []), ...newTags])];
          await adminClient
            .from("digital_card_leads")
            .update({ tags: merged })
            .eq("id", data.lead_id as string);
        }
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error).message ?? err) };
  }
}

// ── Log the automation run ────────────────────────────────────────────────────
async function logRun(
  adminClient: SupabaseClient,
  automationId: string,
  triggerData: AutomationTriggerData,
  result: { ok: boolean; error?: string }
) {
  await adminClient.from("automation_logs").insert({
    automation_id: automationId,
    trigger_data: triggerData as Record<string, unknown>,
    action_result: {},
    status: result.ok ? "success" : "failed",
    error_message: result.error ?? null,
  });

  if (result.ok) {
    await adminClient
      .from("automations")
      .update({ last_run_at: new Date().toISOString(), run_count: (0) })
      .eq("id", automationId);
    // increment run_count via rpc if available, otherwise just update last_run_at
  }
}

// ── Main card-scoped runner ───────────────────────────────────────────────────
// Call this from any API route after a card event occurs.
export async function runCardAutomations(
  adminClient: SupabaseClient,
  triggerType: CardTriggerType,
  data: AutomationTriggerData
): Promise<void> {
  const { data: automations, error } = await adminClient
    .from("automations")
    .select("id, name, action_type, action_data, delay_minutes, trigger_conditions, digital_card_id, preset_key")
    .eq("trigger_type", triggerType)
    .eq("enabled", true)
    .or(`digital_card_id.eq.${data.card_id ?? "00000000-0000-0000-0000-000000000000"},digital_card_id.is.null`);

  if (error || !automations?.length) return;

  for (const automation of automations) {
    const conditions = (automation.trigger_conditions as Record<string, unknown>) ?? {};
    if (!conditionsMatch(conditions, data)) continue;

    const delay = Number(automation.delay_minutes ?? 0);
    if (delay > 0) {
      // Schedule for later
      const scheduledAt = new Date(Date.now() + delay * 60_000).toISOString();
      await adminClient.from("pending_automations").insert({
        automation_id: automation.id,
        trigger_data: data as Record<string, unknown>,
        scheduled_at: scheduledAt,
        status: "pending",
      });
    } else {
      // Execute immediately (fire-and-forget; log result)
      const result = await executeAutomation(adminClient, automation, data);
      await logRun(adminClient, automation.id, data, result);
    }
  }
}

// ── Process pending (delayed) automations ─────────────────────────────────────
// Called by the cron route: /api/cron/process-automations
export async function processPendingAutomations(adminClient: SupabaseClient): Promise<number> {
  const { data: pending } = await adminClient
    .from("pending_automations")
    .select("id, automation_id, trigger_data, automations(id, action_type, action_data, digital_card_id, enabled)")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(50);

  if (!pending?.length) return 0;

  let processed = 0;
  for (const item of pending) {
    type AutomationRow = { id: string; action_type: string; action_data: Record<string, unknown>; digital_card_id: string | null; enabled: boolean };
    const automationsRaw = item.automations as AutomationRow[] | AutomationRow | null;
    const automation = Array.isArray(automationsRaw) ? (automationsRaw[0] ?? null) : automationsRaw;
    if (!automation?.enabled) {
      await adminClient.from("pending_automations").update({ status: "cancelled" }).eq("id", item.id);
      continue;
    }

    const result = await executeAutomation(adminClient, automation, item.trigger_data as AutomationTriggerData);
    await adminClient.from("pending_automations").update({
      status: result.ok ? "executed" : "failed",
      executed_at: new Date().toISOString(),
      error_message: result.error ?? null,
    }).eq("id", item.id);

    await logRun(adminClient, automation.id, item.trigger_data as AutomationTriggerData, result);
    processed++;
  }

  return processed;
}
