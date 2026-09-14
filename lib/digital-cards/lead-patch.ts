// Validation for edits to a digital card lead (status, notes, tags, assignee).
// Pure so the rules can be unit-tested; the route enforces who may call it.

export const LEAD_STATUSES = ["new", "contacted", "qualified", "archived"] as const;

export type LeadPatchInput = { status?: unknown; notes?: unknown; tags?: unknown; assigned_to?: unknown };
export type LeadPatch = { status?: string; notes?: string | null; tags?: string[]; assigned_to?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/**
 * Returns the fields to write, or an error. `assignableIds` lists who the lead
 * may be assigned to; `null` means any existing user (super admins).
 */
export function sanitizeLeadPatch(input: LeadPatchInput | null | undefined, assignableIds: string[] | null): { patch: LeadPatch; error: string | null } {
  const patch: LeadPatch = {};
  if (!input || typeof input !== "object") return { patch, error: "No lead changes were provided." };

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !(LEAD_STATUSES as readonly string[]).includes(input.status)) {
      return { patch, error: "Unsupported lead status." };
    }
    patch.status = input.status;
  }

  if (input.notes !== undefined) {
    if (input.notes !== null && typeof input.notes !== "string") return { patch, error: "Notes must be text." };
    const notes = typeof input.notes === "string" ? input.notes.slice(0, 5000) : "";
    patch.notes = notes.trim() ? notes : null;
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) return { patch, error: "Tags must be a list." };
    const tags = Array.from(new Set(input.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim().slice(0, 40))
      .filter(Boolean)));
    if (tags.length > 20) return { patch, error: "A lead can have at most 20 tags." };
    patch.tags = tags;
  }

  if (input.assigned_to !== undefined) {
    if (input.assigned_to === null || input.assigned_to === "") {
      patch.assigned_to = null;
    } else {
      if (!isUuid(input.assigned_to)) return { patch, error: "Unknown assignee." };
      if (assignableIds && !assignableIds.includes(input.assigned_to)) return { patch, error: "You can't assign this lead to that person." };
      patch.assigned_to = input.assigned_to;
    }
  }

  if (!Object.keys(patch).length) return { patch, error: "No lead changes were provided." };
  return { patch, error: null };
}
