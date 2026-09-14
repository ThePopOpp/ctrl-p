import { describe, expect, it } from "vitest";

import { sanitizeLeadPatch } from "@/lib/digital-cards/lead-patch";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("sanitizeLeadPatch", () => {
  it("accepts valid status, notes and tags", () => {
    const { patch, error } = sanitizeLeadPatch({ status: "contacted", notes: "Called back", tags: [" wrap ", "wrap", "fleet", 7] }, [OWNER]);
    expect(error).toBeNull();
    expect(patch).toEqual({ status: "contacted", notes: "Called back", tags: ["wrap", "fleet"] });
  });

  it("rejects unknown statuses and empty patches", () => {
    expect(sanitizeLeadPatch({ status: "won" }, [OWNER]).error).toBe("Unsupported lead status.");
    expect(sanitizeLeadPatch({}, [OWNER]).error).toBe("No lead changes were provided.");
    expect(sanitizeLeadPatch(null, [OWNER]).error).toBe("No lead changes were provided.");
  });

  it("limits assignment for card owners but not for super admins", () => {
    expect(sanitizeLeadPatch({ assigned_to: OTHER }, [OWNER]).error).toBe("You can't assign this lead to that person.");
    expect(sanitizeLeadPatch({ assigned_to: OWNER }, [OWNER]).patch.assigned_to).toBe(OWNER);
    expect(sanitizeLeadPatch({ assigned_to: OTHER }, null).patch.assigned_to).toBe(OTHER);
    expect(sanitizeLeadPatch({ assigned_to: "not-a-uuid" }, null).error).toBe("Unknown assignee.");
    expect(sanitizeLeadPatch({ assigned_to: null }, [OWNER]).patch.assigned_to).toBeNull();
  });

  it("caps tags and clears blank notes", () => {
    expect(sanitizeLeadPatch({ tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }, null).error).toBe("A lead can have at most 20 tags.");
    expect(sanitizeLeadPatch({ notes: "   " }, null).patch.notes).toBeNull();
  });
});
