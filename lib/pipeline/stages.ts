// Sales Pipeline stages for Ctrl+P.
//
// An opportunity is one potential job (a banner run, a fleet wrap, a design
// package), not the customer's whole relationship. The forward path ends at
// Closed Won; Closed Lost and On Hold are outcomes reachable from any active
// stage rather than columns every opportunity walks through. Production
// (proofing, printing, install) lives on the linked order, never here.

export type PipelineStage =
  | "new_inquiry"
  | "discovery"
  | "estimating"
  | "quote_sent"
  | "follow_up"
  | "approved"
  | "closed_won"
  | "closed_lost"
  | "on_hold";

export type StageMeta = {
  label: string;
  short: string;
  /** Starting forecast probability. Configurable per stage; not a measured conversion rate. */
  probability: number;
  description: string;
  tone: string;
};

export const STAGE_META: Record<PipelineStage, StageMeta> = {
  new_inquiry: {
    label: "New Inquiry",
    short: "Inquiry",
    probability: 10,
    description: "A potential customer requested information, pricing, or a project consultation.",
    tone: "bg-secondary text-secondary-foreground",
  },
  discovery: {
    label: "Discovery & Specifications",
    short: "Discovery",
    probability: 25,
    description: "Confirming quantity, sizes, materials, finishing, artwork, budget, and timing.",
    tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  estimating: {
    label: "Estimating",
    short: "Estimating",
    probability: 40,
    description: "Requirements are clear enough to price in the existing quoting workflow.",
    tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  },
  quote_sent: {
    label: "Quote Sent",
    short: "Quote Sent",
    probability: 60,
    description: "A quote has been delivered to the customer.",
    tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  follow_up: {
    label: "Follow-Up & Revisions",
    short: "Follow-Up",
    probability: 75,
    description: "The customer is reviewing the quote or requesting changes.",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  approved: {
    label: "Approved / Order Setup",
    short: "Approved",
    probability: 90,
    description: "The customer accepted the work; billing, PO, and deposit or terms are being confirmed.",
    tone: "bg-primary/20 text-foreground",
  },
  closed_won: {
    label: "Closed Won",
    short: "Won",
    probability: 100,
    description: "Commercial requirements are met and the order is linked. Production continues on the order.",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  closed_lost: {
    label: "Closed Lost",
    short: "Lost",
    probability: 0,
    description: "The customer will not proceed. The record and its history are kept for reporting.",
    tone: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  on_hold: {
    label: "On Hold / Nurture",
    short: "On Hold",
    probability: 0,
    description: "May proceed later. Excluded from the active forecast until reactivated.",
    tone: "bg-muted text-muted-foreground",
  },
};

/** The forward sales path, in order. */
export const PIPELINE_PATH: readonly PipelineStage[] = [
  "new_inquiry",
  "discovery",
  "estimating",
  "quote_sent",
  "follow_up",
  "approved",
  "closed_won",
];

/** Stages that count toward open pipeline value and the weighted forecast. */
export const ACTIVE_STAGES: readonly PipelineStage[] = [
  "new_inquiry",
  "discovery",
  "estimating",
  "quote_sent",
  "follow_up",
  "approved",
];

/** Every stage in board order: the path, then the two side outcomes. */
export const STAGE_ORDER: readonly PipelineStage[] = [...PIPELINE_PATH, "closed_lost", "on_hold"];

/** Stages a forward jump may pass over without satisfying that stage's own checklist. */
export const SKIPPABLE_STAGES: readonly PipelineStage[] = ["follow_up"];

export const isPipelineStage = (value: unknown): value is PipelineStage =>
  typeof value === "string" && value in STAGE_META;

export const isActiveStage = (stage: PipelineStage) => ACTIVE_STAGES.includes(stage);
export const isClosedStage = (stage: PipelineStage) => stage === "closed_won" || stage === "closed_lost";

/**
 * Ctrl+P had no sales pipeline before this feature, so there are no stored
 * stages to migrate. This map exists for importing opportunities from other
 * CRMs (including Channel Cast's keys) so an import never lands in an unknown
 * stage. Anything unmapped starts at New Inquiry.
 */
export const IMPORTED_STAGE_MAP: Readonly<Record<string, PipelineStage>> = {
  new_lead: "new_inquiry",
  new_working: "new_inquiry",
  contacted: "discovery",
  qualified: "discovery",
  opportunity: "estimating",
  proposal: "quote_sent",
  negotiation: "follow_up",
  won: "closed_won",
  lost: "closed_lost",
  disqualified: "closed_lost",
  unresponsive: "closed_lost",
  nurture: "on_hold",
};

export function normalizeStage(stage: string): PipelineStage {
  if (isPipelineStage(stage)) return stage;
  return IMPORTED_STAGE_MAP[stage] ?? "new_inquiry";
}

// ── Print / design vocabulary ───────────────────────────────────────────────

export type SpecRequirements = { quantity: boolean; dimensions: boolean; material: boolean };

export type ServiceCategory = {
  key: string;
  label: string;
  /** Which specifications must be captured during Discovery for this kind of work. */
  requires: SpecRequirements;
};

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  { key: "business_cards", label: "Business Cards & Stationery", requires: { quantity: true, dimensions: false, material: true } },
  { key: "print_collateral", label: "Flyers, Brochures & Print Collateral", requires: { quantity: true, dimensions: true, material: true } },
  { key: "banners_large_format", label: "Banners & Large Format", requires: { quantity: true, dimensions: true, material: true } },
  { key: "signage", label: "Storefront & Indoor Signage", requires: { quantity: true, dimensions: true, material: true } },
  { key: "vehicle_wraps", label: "Vehicle Wraps & Graphics", requires: { quantity: true, dimensions: false, material: true } },
  { key: "wall_graphics", label: "Wall Graphics & Murals", requires: { quantity: false, dimensions: true, material: true } },
  { key: "apparel", label: "Apparel & Embroidery", requires: { quantity: true, dimensions: false, material: true } },
  { key: "promotional", label: "Promotional Products", requires: { quantity: true, dimensions: false, material: false } },
  { key: "stickers_labels", label: "Stickers & Labels", requires: { quantity: true, dimensions: true, material: true } },
  { key: "graphic_design", label: "Graphic Design (design only)", requires: { quantity: false, dimensions: false, material: false } },
  { key: "installation", label: "Installation Service", requires: { quantity: false, dimensions: false, material: false } },
  { key: "other", label: "Other", requires: { quantity: false, dimensions: false, material: false } },
];

const CATEGORY_BY_KEY = new Map(SERVICE_CATEGORIES.map((c) => [c.key, c]));

export const serviceCategory = (key: string | null | undefined) => (key ? CATEGORY_BY_KEY.get(key) ?? null : null);
export const serviceLabel = (key: string | null | undefined) => serviceCategory(key)?.label ?? (key || "Not set");
export const isServiceCategory = (key: unknown): key is string => typeof key === "string" && CATEGORY_BY_KEY.has(key);

export const LOST_REASONS = [
  "Price",
  "Timing",
  "Competitor",
  "Project canceled",
  "No response",
  "Unsuitable requirements",
  "Budget",
  "Other",
] as const;

export const HOLD_REASONS = [
  "Waiting on customer decision",
  "Budget cycle",
  "Event or launch postponed",
  "Seasonal / reorder later",
  "Waiting on brand or artwork",
  "Other",
] as const;

export const FULFILLMENT_METHODS = [
  { key: "pickup", label: "Pickup" },
  { key: "shipping", label: "Shipping" },
  { key: "local_delivery", label: "Local delivery" },
  { key: "installation", label: "Installation" },
  { key: "digital_delivery", label: "Digital delivery (design files)" },
] as const;

export const ARTWORK_SOURCES = [
  { key: "customer_supplied", label: "Customer supplies artwork" },
  { key: "design_services", label: "Design services required" },
  { key: "mixed", label: "Mix of supplied and design" },
  { key: "reorder_existing", label: "Reorder of existing artwork" },
  { key: "undecided", label: "Not yet known" },
] as const;

/** Sales-side record of artwork progress. Proof approval of record lives on the order's proofs. */
export const ARTWORK_STATUSES = [
  { key: "not_started", label: "Not started" },
  { key: "awaiting_files", label: "Awaiting customer files" },
  { key: "files_received", label: "Files received" },
  { key: "design_in_progress", label: "Design in progress" },
  { key: "concept_shared", label: "Concept shared with customer" },
] as const;

export const DEPOSIT_STATUSES = [
  { key: "not_required", label: "Not required (approved terms)" },
  { key: "requested", label: "Deposit requested" },
  { key: "received", label: "Deposit received" },
] as const;

export const QUOTE_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "revision_requested", label: "Revision requested" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
  { key: "expired", label: "Expired" },
  { key: "superseded", label: "Superseded" },
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["key"];

export const NEXT_ACTION_TYPES = [
  { key: "call", label: "Call" },
  { key: "email", label: "Email" },
  { key: "sms", label: "Text" },
  { key: "meeting", label: "Meeting / consult" },
  { key: "site_visit", label: "Site visit / measure" },
  { key: "send_quote", label: "Send quote" },
  { key: "follow_up", label: "Follow up" },
  { key: "other", label: "Other" },
] as const;

export const DIMENSION_UNITS = ["in", "ft", "cm", "mm"] as const;

export const FILE_KINDS = [
  { key: "artwork", label: "Artwork" },
  { key: "reference", label: "Reference / photo" },
  { key: "proof", label: "Proof" },
  { key: "document", label: "Document / PO" },
  { key: "other", label: "Other" },
] as const;

export const MANUAL_LOG_KINDS = [
  { key: "note", label: "Note" },
  { key: "call", label: "Call" },
  { key: "email", label: "Email" },
  { key: "sms", label: "Text message" },
  { key: "meeting", label: "Meeting" },
] as const;

export type ManualLogKind = (typeof MANUAL_LOG_KINDS)[number]["key"];

export const keysOf = <T extends readonly { key: string }[]>(list: T) => new Set(list.map((item) => item.key));
export const labelFor = <T extends readonly { key: string; label: string }[]>(list: T, key: string | null | undefined) =>
  list.find((item) => item.key === key)?.label ?? (key ? key.replace(/_/g, " ") : "Not set");
