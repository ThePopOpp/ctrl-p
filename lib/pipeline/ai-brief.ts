// What the AI Agent is told about an opportunity. Pure, so it can be tested and
// so the prompt only ever contains facts that exist on the record.

import { ARTWORK_SOURCES, FULFILLMENT_METHODS, STAGE_META, labelFor, serviceLabel } from "@/lib/pipeline/stages";
import type { Opportunity, OpportunityEvent, OpportunityLineItem, OpportunityQuote } from "@/lib/pipeline/types";

export const AI_MODES = [
  { key: "summary", label: "Summarize this opportunity" },
  { key: "next_steps", label: "Suggest next steps" },
  { key: "follow_up_email", label: "Draft a follow-up email" },
  { key: "follow_up_sms", label: "Draft a follow-up text" },
  { key: "question", label: "Ask a question" },
] as const;

export type AiMode = (typeof AI_MODES)[number]["key"];

export const isAiMode = (value: unknown): value is AiMode => AI_MODES.some((mode) => mode.key === value);

const money = (value: number | string | null | undefined) =>
  `$${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function buildOpportunityBrief(input: {
  opportunity: Opportunity;
  lineItems: OpportunityLineItem[];
  currentQuote: OpportunityQuote | null;
  events: OpportunityEvent[];
  ownerName: string;
  customerName: string | null;
}): string {
  const { opportunity: o, lineItems, currentQuote, events } = input;
  const lines: string[] = [
    `Opportunity: ${o.name} (${o.opportunity_number})`,
    `Stage: ${STAGE_META[o.stage].label}`,
    `Customer: ${input.customerName || o.contact_name || "unknown"}${o.company ? `, ${o.company}` : ""}`,
    `Salesperson: ${input.ownerName}`,
    `Service: ${serviceLabel(o.service_category)}`,
  ];
  if (o.description) lines.push(`Summary: ${o.description}`);
  if (o.requested_completion_date) lines.push(`Customer needs it by: ${o.requested_completion_date}${o.is_rush ? " (rush)" : ""}`);
  if (o.expected_close_date) lines.push(`Expected close: ${o.expected_close_date}`);
  if (o.fulfillment_method) lines.push(`Fulfillment: ${labelFor(FULFILLMENT_METHODS, o.fulfillment_method)}`);
  if (o.artwork_source) lines.push(`Artwork: ${labelFor(ARTWORK_SOURCES, o.artwork_source)}`);
  if (o.budget) lines.push(`Budget: ${money(o.budget)}`);
  if (o.decision_makers) lines.push(`Decision-makers: ${o.decision_makers}`);
  if (o.next_action) lines.push(`Next action: ${o.next_action}${o.next_action_due ? ` (due ${o.next_action_due})` : ""}`);
  if (lineItems.length) {
    lines.push("Line items:");
    for (const item of lineItems) {
      const size = item.width && item.height ? `${item.width}x${item.height} ${item.dimension_unit ?? ""}`.trim() : null;
      lines.push(`- ${[item.description, item.quantity ? `qty ${item.quantity}` : null, size, item.material, item.finishing].filter(Boolean).join(", ")}`);
    }
  }
  lines.push(currentQuote
    ? `Current quote: v${currentQuote.version}, ${money(currentQuote.amount)}, status ${currentQuote.status.replace(/_/g, " ")}${currentQuote.expires_at ? `, expires ${currentQuote.expires_at}` : ""}`
    : "Current quote: none linked");
  const recent = events
    .filter((event) => event.event_type !== "fields_updated")
    .slice(0, 15)
    .map((event) => `- ${event.occurred_at.slice(0, 10)}: ${event.summary || event.event_type}${event.body ? ` — ${event.body.slice(0, 200)}` : ""}`);
  if (recent.length) lines.push("Recent activity (newest first):", ...recent);
  return lines.join("\n");
}

const SYSTEM = [
  "You are a sales assistant for Ctrl+P (ControlP.io), a print, signage, apparel and vehicle-wrap shop in Chandler, Arizona.",
  "Use only the facts in the opportunity brief. If something isn't in the brief, say it's unknown rather than guessing.",
  "Never state or imply that a message was sent, a quote was accepted, artwork was approved, or a payment was received unless the brief says so.",
  "Write plain text with no markdown headings. Keep it practical and concise.",
].join(" ");

export function aiPrompt(mode: AiMode, brief: string, instructions: string | null): { system: string; prompt: string } {
  const ask: Record<AiMode, string> = {
    summary: "Summarize where this opportunity stands in 4-6 short bullet lines: what the job is, where the sale is, what's missing, and the risk.",
    next_steps: "Suggest the 3-5 most useful next steps to move this sale forward, most important first, each one line.",
    follow_up_email: "Draft a short follow-up email to the customer. Put the subject on the first line as 'Subject: ...', then a blank line, then the body. Sign off as the salesperson.",
    follow_up_sms: "Draft a friendly follow-up text message to the customer under 300 characters. No links unless one is in the brief.",
    question: "Answer the salesperson's question about this opportunity.",
  };
  return {
    system: SYSTEM,
    prompt: [`Opportunity brief:\n${brief}`, ask[mode], instructions ? `Salesperson's instructions: ${instructions}` : null].filter(Boolean).join("\n\n"),
  };
}

/** Split an AI email draft into subject and body. */
export function splitEmailDraft(text: string): { subject: string; body: string } {
  const match = text.match(/^\s*subject:\s*(.+)$/im);
  if (!match) return { subject: "", body: text.trim() };
  return { subject: match[1].trim(), body: text.replace(match[0], "").trim() };
}
