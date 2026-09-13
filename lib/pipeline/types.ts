import type { PipelineStage, QuoteStatus } from "@/lib/pipeline/stages";

/** A step added to one opportunity on top of its stage template. */
export type ExtraChecklistItem = { id: string; label: string; stage: PipelineStage; required?: boolean };

export type Opportunity = {
  id: string;
  opportunity_number: string;
  name: string;
  stage: PipelineStage;
  probability: number;
  estimated_value: number;
  service_category: string | null;
  description: string | null;
  source: string | null;

  customer_user_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  source_submission_id: string | null;

  owner_id: string | null;
  expected_close_date: string | null;
  requested_completion_date: string | null;
  is_rush: boolean;
  fulfillment_method: string | null;
  fulfillment_notes: string | null;
  artwork_source: string | null;
  artwork_status: string | null;
  budget: number | null;
  decision_makers: string | null;

  next_action: string | null;
  next_action_type: string | null;
  next_action_due: string | null;

  po_number: string | null;
  payment_terms: string | null;
  deposit_status: string | null;
  billing_confirmed: boolean;

  checklist: Record<string, boolean>;
  extra_items: ExtraChecklistItem[];

  stage_entered_at: string;
  closed_at: string | null;
  won_summary: string | null;
  lost_reason: string | null;
  lost_notes: string | null;
  competitor: string | null;
  hold_reason: string | null;
  hold_follow_up_date: string | null;
  hold_from_stage: PipelineStage | null;
  reopened_at: string | null;

  won_order_id: string | null;
  won_project_id: string | null;
  conversion_token: string | null;
  conversion_started_at: string | null;

  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityLineItem = {
  id: string;
  opportunity_id: string;
  position: number;
  service_category: string | null;
  product_id: string | null;
  description: string;
  quantity: number | null;
  width: number | null;
  height: number | null;
  dimension_unit: string | null;
  material: string | null;
  finishing: string | null;
  artwork_source: string | null;
  unit_price_estimate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityQuote = {
  id: string;
  opportunity_id: string;
  order_id: string | null;
  version: number;
  amount: number;
  status: QuoteStatus;
  is_current: boolean;
  sent_at: string | null;
  expires_at: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityEventType =
  | "created"
  | "stage_changed"
  | "owner_changed"
  | "fields_updated"
  | "quote_linked"
  | "quote_revised"
  | "quote_updated"
  | "converted"
  | "task_created"
  | "task_completed"
  | "file_linked"
  | "manual_log"
  | "communication"
  | "record_linked"
  | "document_updated";

export type OpportunityEvent = {
  id: string;
  opportunity_id: string;
  event_type: OpportunityEventType;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage | null;
  from_owner_id: string | null;
  to_owner_id: string | null;
  log_kind: string | null;
  summary: string | null;
  body: string | null;
  details: Record<string, unknown>;
  is_manual_log: boolean;
  occurred_at: string;
  actor_id: string | null;
  created_at: string;
};

export type OpportunityTask = {
  id: string;
  opportunity_id: string;
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  status: "open" | "done";
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityFile = {
  id: string;
  opportunity_id: string;
  label: string;
  url: string;
  kind: string;
  artwork_file_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type DocumentKind = "plan" | "contract" | "sow";
export type DocumentStatus = "draft" | "sent" | "accepted" | "signed" | "declined" | "archived";

export type OpportunityDocument = {
  id: string;
  opportunity_id: string;
  kind: DocumentKind;
  title: string;
  status: DocumentStatus;
  amount: number | null;
  effective_date: string | null;
  due_date: string | null;
  body: string | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LinkedProject = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  project_name: string | null;
};

export type StaffMember = { id: string; full_name: string | null; email: string | null; role: string };

export type PipelineAccess = {
  canViewAll: boolean;
  canEdit: boolean;
  canManage: boolean;
  actorId: string;
};

/** Stored stage configuration: only the parts an administrator can change. */
export type StoredChecklistItem = { id: string; label: string; required?: boolean };
export type StoredStageConfig = {
  probability: number;
  goal: string;
  actions: string[];
  items: StoredChecklistItem[];
};
export type StageConfigMap = Partial<Record<PipelineStage, StoredStageConfig>>;

/** An opportunity as returned by the list endpoint. */
export type OpportunityListRow = Opportunity & {
  value: number;
  current_quote: Pick<OpportunityQuote, "id" | "version" | "amount" | "status" | "order_id" | "sent_at" | "expires_at"> | null;
};

export type RelatedOrder = {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string | null;
  production_status: string | null;
  total: number | null;
  due_at: string | null;
  created_at?: string | null;
  customer_email?: string | null;
  company?: string | null;
};

export type RelatedPayment = {
  id: string;
  order_id: string;
  status: string;
  amount: number | null;
  invoice_number: string | null;
  balance_due: number | null;
  created_at: string | null;
};

export type RelatedMessage = {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  sent_at: string | null;
  created_at: string;
  order_id: string | null;
};

export type RelatedAppointment = {
  id: string;
  title: string;
  start_time: string;
  status: string;
  location_type: string | null;
};

export type CustomerRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string;
};

export type SourceSubmission = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  status: string;
  created_at: string | null;
};

export type OpportunityDetail = {
  opportunity: Opportunity;
  value: number;
  lineItems: OpportunityLineItem[];
  quotes: OpportunityQuote[];
  events: OpportunityEvent[];
  tasks: OpportunityTask[];
  files: OpportunityFile[];
  customer: CustomerRecord | null;
  submission: SourceSubmission | null;
  orders: RelatedOrder[];
  quoteOrderCandidates: RelatedOrder[];
  payments: RelatedPayment[];
  messages: RelatedMessage[];
  appointments: RelatedAppointment[];
  documents: OpportunityDocument[];
  projects: LinkedProject[];
  /** Short-lived signed playback URLs for voice notes, keyed by event id. */
  voiceNoteUrls: Record<string, string>;
  staff: StaffMember[];
  stageConfig: StageConfigMap;
  access: PipelineAccess;
};
