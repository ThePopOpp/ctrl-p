import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { verifyPipelineRequest } from "@/lib/pipeline/server";
import type { CustomerRecord, SourceSubmission } from "@/lib/pipeline/types";

/**
 * What an opportunity can be created from: website inquiries (contact form
 * submissions) and existing customers. Leads are added intentionally; nothing
 * here creates an opportunity on its own.
 */
export async function GET(request: Request) {
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return verified.error;
  const { client } = verified.context;

  const [submissions, customers, linked] = await Promise.all([
    client
      .from("contact_submissions")
      .select("id, first_name, last_name, email, phone, company, subject, message, status, created_at")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("users")
      .select("id, full_name, email, phone, company, role")
      .eq("role", "customer")
      .is("deleted_at", null)
      .order("full_name", { ascending: true })
      .limit(2000),
    client.from("pipeline_opportunities").select("id, source_submission_id").not("source_submission_id", "is", null),
  ]);

  if (submissions.error) return jsonError(submissions.error.message, 400);
  if (customers.error) return jsonError(customers.error.message, 400);

  const inPipeline = new Map(((linked.data ?? []) as { id: string; source_submission_id: string }[]).map((row) => [row.source_submission_id, row.id]));

  return NextResponse.json({
    submissions: ((submissions.data ?? []) as SourceSubmission[]).map((submission) => ({
      ...submission,
      opportunity_id: inPipeline.get(submission.id) ?? null,
    })),
    customers: (customers.data ?? []) as CustomerRecord[],
  });
}
