// Closed Won → customer + order, exactly once.
//
// Repeated clicks, retries and reopen-then-win-again must never create a second
// customer or order. Three things make that hold:
//   1. A claim token on the opportunity: only one request converts at a time.
//   2. Every created id is written back to the opportunity immediately, so a
//      retry after a partial failure reuses what already exists.
//   3. Customers are found by email before one is created; auth itself rejects a
//      duplicate email, and that case falls back to linking the existing user.
// Existing users are linked as they are — their login role is never changed.

import type { SupabaseClient } from "@supabase/supabase-js";

import { FULFILLMENT_METHODS, labelFor, serviceLabel, ARTWORK_SOURCES } from "@/lib/pipeline/stages";
import { opportunityValue } from "@/lib/pipeline/forecast";
import type { Opportunity, OpportunityLineItem, OpportunityQuote } from "@/lib/pipeline/types";
import { logActivity, recordEvent } from "@/lib/pipeline/server";

export type ConversionOutcome =
  | {
      ok: true;
      customerId: string;
      orderId: string;
      orderNumber: string | null;
      customerCreated: boolean;
      orderCreated: boolean;
      alreadyConverted: boolean;
    }
  | { ok: false; status: number; error: string };

const CLAIM_TTL_MS = 2 * 60 * 1000;

export async function ensureWonRecords(input: {
  client: SupabaseClient;
  actorId: string;
  opportunity: Opportunity;
  currentQuote: OpportunityQuote | null;
  lineItems: OpportunityLineItem[];
}): Promise<ConversionOutcome> {
  const { client, actorId, currentQuote, lineItems } = input;
  const id = input.opportunity.id;
  const token = crypto.randomUUID();
  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString();

  const claim = await client
    .from("pipeline_opportunities")
    .update({ conversion_token: token, conversion_started_at: new Date().toISOString() })
    .eq("id", id)
    .or(`conversion_token.is.null,conversion_started_at.lt.${staleBefore}`)
    .select("*")
    .maybeSingle();

  if (claim.error) return { ok: false, status: 400, error: claim.error.message };
  if (!claim.data) {
    return { ok: false, status: 409, error: "This opportunity is already being converted. Refresh in a moment." };
  }

  // Work from the freshly claimed row, not the caller's copy, so a retry sees earlier progress.
  const current = claim.data as Opportunity;
  const release = async (patch: Record<string, unknown> = {}) => {
    await client.from("pipeline_opportunities").update({ ...patch, conversion_token: null, conversion_started_at: null }).eq("id", id).eq("conversion_token", token);
  };

  const alreadyConverted = Boolean(current.customer_user_id && current.won_order_id);

  // ── Customer ────────────────────────────────────────────────────────────
  let customerId = current.customer_user_id;
  let customerCreated = false;
  if (!customerId) {
    const email = (current.contact_email ?? "").trim().toLowerCase();
    if (!email) {
      await release();
      return { ok: false, status: 422, error: "Link an existing customer or add the contact's email before closing as won." };
    }

    customerId = await findUserIdByEmail(client, email);
    if (!customerId) {
      const created = await client.auth.admin.createUser({
        email,
        password: `${crypto.randomUUID()}aA1!`,
        email_confirm: true,
        user_metadata: { full_name: current.contact_name, phone: current.contact_phone, company: current.company },
      });
      if (created.error || !created.data.user) {
        const message = created.error?.message ?? "Could not create the customer.";
        if (/already|registered|exists/i.test(message)) {
          customerId = await findUserIdByEmail(client, email);
        }
        if (!customerId) {
          await release();
          return { ok: false, status: 400, error: `Could not create the customer: ${message}` };
        }
      } else {
        customerId = created.data.user.id;
        customerCreated = true;
        // The auth trigger creates the users row with the default customer role; fill in contact details only.
        await client
          .from("users")
          .update({
            email,
            full_name: current.contact_name,
            phone: current.contact_phone ? current.contact_phone.replace(/[^\d+]/g, "") : null,
            company: current.company,
            status: "active",
          })
          .eq("id", customerId);
        await client.from("activity_logs").insert({
          actor_id: actorId,
          action: "user_created",
          entity_type: "user",
          entity_id: customerId,
          details: { email, source: "pipeline_closed_won", opportunity_id: id, send_invite: false },
        });
      }
    }

    const saved = await client.from("pipeline_opportunities").update({ customer_user_id: customerId }).eq("id", id).eq("conversion_token", token);
    if (saved.error) {
      await release();
      return { ok: false, status: 400, error: saved.error.message };
    }
  }

  // ── Order ───────────────────────────────────────────────────────────────
  let orderId = current.won_order_id;
  let orderNumber: string | null = null;
  let orderCreated = false;

  if (orderId) {
    const existing = await client.from("orders").select("id, order_number").eq("id", orderId).maybeSingle();
    orderNumber = (existing.data as { order_number: string | null } | null)?.order_number ?? null;
  }

  if (!orderId && currentQuote?.order_id) {
    const quoteOrder = await client
      .from("orders")
      .select("id, order_number, status, production_status, user_id")
      .eq("id", currentQuote.order_id)
      .maybeSingle();
    const order = quoteOrder.data as { id: string; order_number: string | null; status: string; production_status: string | null; user_id: string | null } | null;
    if (order) {
      const saved = await client.from("pipeline_opportunities").update({ won_order_id: order.id }).eq("id", id).eq("conversion_token", token);
      if (saved.error) {
        await release();
        return { ok: false, status: 400, error: `Could not link order ${order.order_number ?? order.id}: ${saved.error.message}` };
      }
      orderId = order.id;
      orderNumber = order.order_number;

      const updates: Record<string, unknown> = {};
      // Accepting the quote moves it out of the quote queue into the normal order
      // workflow. Production status is left alone: artwork, proofs, and payment
      // still gate production on the order itself.
      if (order.status === "quote_requested") updates.status = "new";
      if (!order.user_id) updates.user_id = customerId;
      if (Object.keys(updates).length) {
        await client.from("orders").update(updates).eq("id", order.id);
        if (updates.status) {
          await client.from("order_status_history").insert({
            order_id: order.id,
            previous_status: order.status,
            new_status: updates.status,
            previous_production_status: order.production_status,
            new_production_status: order.production_status,
            actor_id: actorId,
            note: `Quote accepted — opportunity ${current.opportunity_number} closed won. Production still requires artwork approval and payment per order workflow.`,
          });
        }
      }
    }
  }

  if (!orderId) {
    const created = await createOrderFromOpportunity(client, actorId, current, customerId, currentQuote, lineItems, token);
    if (!created.ok) {
      await release();
      return { ok: false, status: created.status, error: created.error };
    }
    orderId = created.orderId;
    orderNumber = created.orderNumber;
    orderCreated = true;
  }

  await release();

  if (!alreadyConverted) {
    await recordEvent(client, {
      opportunity_id: id,
      event_type: "converted",
      actor_id: actorId,
      summary: `Linked ${customerCreated ? "new" : "existing"} customer and ${orderCreated ? "created" : "linked"} order ${orderNumber ?? ""}`.trim(),
      details: { customer_id: customerId, customer_created: customerCreated, order_id: orderId, order_created: orderCreated, order_number: orderNumber },
    });
    await logActivity(client, actorId, "pipeline_converted", id, { customer_id: customerId, order_id: orderId, customer_created: customerCreated, order_created: orderCreated });
  }

  return { ok: true, customerId, orderId, orderNumber, customerCreated, orderCreated, alreadyConverted };
}

async function findUserIdByEmail(client: SupabaseClient, email: string): Promise<string | null> {
  const direct = await client.from("users").select("id").eq("email", email).is("deleted_at", null).limit(1).maybeSingle();
  const directId = (direct.data as { id: string } | null)?.id;
  if (directId) return directId;
  const lookup = await client.rpc("get_auth_user_id_by_email", { user_email: email });
  return typeof lookup.data === "string" && lookup.data ? lookup.data : null;
}

async function createOrderFromOpportunity(
  client: SupabaseClient,
  actorId: string,
  opportunity: Opportunity,
  customerId: string,
  currentQuote: OpportunityQuote | null,
  lineItems: OpportunityLineItem[],
  token: string,
): Promise<{ ok: true; orderId: string; orderNumber: string | null } | { ok: false; status: number; error: string }> {
  const total = opportunityValue(opportunity.estimated_value, currentQuote);
  const fulfillment = opportunity.fulfillment_method ? labelFor(FULFILLMENT_METHODS, opportunity.fulfillment_method) : null;

  const specLines = lineItems.map((item) => {
    const dims = item.width && item.height ? `${item.width} x ${item.height} ${item.dimension_unit ?? ""}`.trim() : null;
    return [
      `- ${item.description} (${serviceLabel(item.service_category)})`,
      item.quantity ? `qty ${item.quantity}` : null,
      dims,
      item.material ? `material: ${item.material}` : null,
      item.finishing ? `finishing: ${item.finishing}` : null,
    ].filter(Boolean).join(", ");
  });

  const internalNotes = [
    `From Pipeline opportunity ${opportunity.opportunity_number}: ${opportunity.name}`,
    currentQuote ? `Accepted quote v${currentQuote.version}: $${Number(currentQuote.amount).toFixed(2)}` : null,
    specLines.length ? `Specifications:\n${specLines.join("\n")}` : null,
    opportunity.artwork_source ? `Artwork: ${labelFor(ARTWORK_SOURCES, opportunity.artwork_source)}` : null,
    fulfillment ? `Fulfillment: ${fulfillment}${opportunity.fulfillment_notes ? ` — ${opportunity.fulfillment_notes}` : ""}` : null,
    opportunity.is_rush ? "RUSH requested" : null,
    opportunity.po_number ? `PO: ${opportunity.po_number}` : null,
    opportunity.payment_terms ? `Payment terms: ${opportunity.payment_terms}` : null,
    opportunity.notes ? `Sales notes: ${opportunity.notes}` : null,
    "Closed Won is not production approval: artwork/proof approval and payment requirements still apply.",
  ].filter(Boolean).join("\n\n");

  const orderResult = await client
    .from("orders")
    .insert({
      user_id: customerId,
      status: "new",
      payment_status: "unpaid",
      production_status: "new",
      company: opportunity.company,
      customer_email: opportunity.contact_email,
      customer_phone: opportunity.contact_phone,
      internal_notes: internalNotes,
      due_at: opportunity.requested_completion_date,
      shipping_method: fulfillment,
      pickup_shipping_method: fulfillment,
      subtotal: total,
      total,
    })
    .select("id, order_number, status, production_status")
    .single();

  if (orderResult.error || !orderResult.data) {
    return { ok: false, status: 400, error: orderResult.error?.message ?? "Could not create the order." };
  }
  const order = orderResult.data as { id: string; order_number: string | null; status: string; production_status: string };

  // Record the link before anything else can fail, so a retry never creates a second order.
  const linked = await client.from("pipeline_opportunities").update({ won_order_id: order.id }).eq("id", opportunity.id).eq("conversion_token", token);
  if (linked.error) {
    return { ok: false, status: 500, error: `Order ${order.order_number ?? order.id} was created but could not be linked: ${linked.error.message}. Link it manually before retrying.` };
  }

  const lines = lineItems.length
    ? lineItems
    : [{ description: opportunity.name, quantity: 1, unit_price_estimate: total, product_id: null, service_category: opportunity.service_category } as Partial<OpportunityLineItem>];

  for (const item of lines) {
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
    const unitPrice = Number(item.unit_price_estimate) || 0;
    const itemResult = await client
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: item.product_id ?? null,
        options: {
          source: "pipeline",
          opportunity_id: opportunity.id,
          description: item.description,
          service_category: item.service_category ?? null,
          width: item.width ?? null,
          height: item.height ?? null,
          dimension_unit: item.dimension_unit ?? null,
          material: item.material ?? null,
          finishing: item.finishing ?? null,
          artwork_source: item.artwork_source ?? opportunity.artwork_source ?? null,
          notes: item.notes ?? null,
        },
        quantity,
        unit_cost: 0,
        unit_price: unitPrice,
        line_total: Math.round(unitPrice * quantity * 100) / 100,
        proof_required: (item.artwork_source ?? opportunity.artwork_source) !== "reorder_existing",
      })
      .select("id")
      .single();

    if (itemResult.data) {
      await client.from("production_jobs").insert({
        order_id: order.id,
        order_item_id: (itemResult.data as { id: string }).id,
        status: "new",
        priority: opportunity.is_rush ? 50 : 100,
        station: "Prepress",
        due_at: opportunity.requested_completion_date,
        notes: `From ${opportunity.opportunity_number}. Hold until artwork is approved and payment requirements are met.`,
      });
    }
  }

  await client.from("order_status_history").insert({
    order_id: order.id,
    previous_status: null,
    new_status: order.status,
    previous_production_status: null,
    new_production_status: order.production_status,
    actor_id: actorId,
    note: `Order created from Pipeline opportunity ${opportunity.opportunity_number} (Closed Won).`,
  });
  await client.from("activity_logs").insert({
    actor_id: actorId,
    action: "order_created",
    entity_type: "order",
    entity_id: order.id,
    details: { order_number: order.order_number, source: "pipeline", opportunity_id: opportunity.id, total },
  });

  return { ok: true, orderId: order.id, orderNumber: order.order_number };
}
