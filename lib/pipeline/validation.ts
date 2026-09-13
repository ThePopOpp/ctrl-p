import { cleanDate, cleanNumber, cleanText } from "@/lib/pipeline/server";
import {
  ARTWORK_SOURCES,
  ARTWORK_STATUSES,
  DEPOSIT_STATUSES,
  DIMENSION_UNITS,
  FULFILLMENT_METHODS,
  NEXT_ACTION_TYPES,
  isServiceCategory,
  keysOf,
} from "@/lib/pipeline/stages";

const TEXT_FIELDS: Record<string, number> = {
  description: 4000,
  source: 200,
  contact_name: 200,
  contact_email: 320,
  contact_phone: 40,
  company: 200,
  fulfillment_notes: 2000,
  decision_makers: 1000,
  next_action: 500,
  po_number: 100,
  payment_terms: 200,
  notes: 8000,
  won_summary: 2000,
};

const ENUM_FIELDS: Record<string, Set<string>> = {
  fulfillment_method: keysOf(FULFILLMENT_METHODS),
  artwork_source: keysOf(ARTWORK_SOURCES),
  artwork_status: keysOf(ARTWORK_STATUSES),
  deposit_status: keysOf(DEPOSIT_STATUSES),
  next_action_type: keysOf(NEXT_ACTION_TYPES),
};

const DATE_FIELDS = ["expected_close_date", "requested_completion_date", "next_action_due"];
const BOOLEAN_FIELDS = ["is_rush", "billing_confirmed"];

export type Collected = { updates: Record<string, unknown>; error: string | null };

/**
 * Validates the editable opportunity fields present in a request body. Only keys
 * that were supplied are returned, so a PATCH never blanks a field by omission.
 * Stage, owner and outcome fields are deliberately absent: they have their own paths.
 */
export function collectOpportunityFields(body: Record<string, unknown>): Collected {
  const updates: Record<string, unknown> = {};

  if ("name" in body) {
    const name = cleanText(body.name, 200);
    if (!name) return { updates, error: "Opportunity name can't be empty." };
    updates.name = name;
  }

  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (!(key in body)) continue;
    let value = cleanText(body[key], max);
    if (key === "contact_email" && value) {
      value = value.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { updates, error: "Enter a valid contact email." };
    }
    updates[key] = value ?? null;
  }

  if ("service_category" in body) {
    const value = body.service_category;
    if (value !== null && value !== "" && !isServiceCategory(value)) return { updates, error: "Unknown service category." };
    updates.service_category = value || null;
  }

  for (const [key, allowed] of Object.entries(ENUM_FIELDS)) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null || value === "") {
      updates[key] = null;
      continue;
    }
    if (typeof value !== "string" || !allowed.has(value)) return { updates, error: `Unsupported value for ${key.replace(/_/g, " ")}.` };
    updates[key] = value;
  }

  for (const key of DATE_FIELDS) {
    const value = cleanDate(body[key]);
    if (value === "invalid") return { updates, error: `${key.replace(/_/g, " ")} must be a date.` };
    if (value !== undefined) updates[key] = value;
  }

  if ("estimated_value" in body) {
    const value = cleanNumber(body.estimated_value);
    if (value === "invalid") return { updates, error: "Estimated value must be a positive number." };
    updates.estimated_value = value ?? 0;
  }
  if ("budget" in body) {
    const value = cleanNumber(body.budget);
    if (value === "invalid") return { updates, error: "Budget must be a positive number." };
    updates.budget = value ?? null;
  }
  if ("probability" in body) {
    const value = Number(body.probability);
    if (!Number.isFinite(value) || value < 0 || value > 100) return { updates, error: "Probability must be between 0 and 100." };
    updates.probability = Math.round(value);
  }

  for (const key of BOOLEAN_FIELDS) {
    if (!(key in body)) continue;
    if (typeof body[key] !== "boolean") return { updates, error: `${key.replace(/_/g, " ")} must be true or false.` };
    updates[key] = body[key];
  }

  return { updates, error: null };
}

const DIMENSION_UNIT_SET = new Set<string>(DIMENSION_UNITS);

/** Validates line-item fields. `partial` allows omitted keys for PATCH. */
export function collectLineItemFields(body: Record<string, unknown>, partial: boolean): Collected {
  const updates: Record<string, unknown> = {};

  if (!partial || "description" in body) {
    const description = cleanText(body.description, 500);
    if (!description) return { updates, error: "Describe the line item." };
    updates.description = description;
  }
  if (!partial || "service_category" in body) {
    const value = body.service_category;
    if (value !== null && value !== undefined && value !== "" && !isServiceCategory(value)) return { updates, error: "Unknown service category." };
    updates.service_category = value || null;
  }
  for (const key of ["material", "finishing", "notes"]) {
    if (partial && !(key in body)) continue;
    updates[key] = cleanText(body[key], key === "notes" ? 2000 : 300) ?? null;
  }
  for (const key of ["quantity", "width", "height", "unit_price_estimate"]) {
    if (partial && !(key in body)) continue;
    const value = cleanNumber(body[key]);
    if (value === "invalid") return { updates, error: `${key.replace(/_/g, " ")} must be a positive number.` };
    updates[key] = value ?? null;
  }
  if (!partial || "dimension_unit" in body) {
    const unit = body.dimension_unit;
    if (unit !== null && unit !== undefined && unit !== "" && (typeof unit !== "string" || !DIMENSION_UNIT_SET.has(unit))) {
      return { updates, error: "Unsupported dimension unit." };
    }
    updates.dimension_unit = unit || null;
  }
  if (!partial || "artwork_source" in body) {
    const value = body.artwork_source;
    if (value !== null && value !== undefined && value !== "" && (typeof value !== "string" || !ENUM_FIELDS.artwork_source.has(value))) {
      return { updates, error: "Unsupported artwork source." };
    }
    updates.artwork_source = value || null;
  }
  if (!partial || "product_id" in body) {
    const value = body.product_id;
    updates.product_id = typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  }
  return { updates, error: null };
}

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
