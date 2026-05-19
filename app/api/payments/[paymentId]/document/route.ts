import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { loadPaymentDocument, renderPaymentDocumentHtml, type PaymentDocumentKind } from "@/lib/admin/payment-documents";
import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const { paymentId } = await context.params;
  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") === "receipt" ? "receipt" : "invoice") as PaymentDocumentKind;
  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const paymentResult = await loadPaymentDocument(adminClient, paymentId);
  if (paymentResult.error || !paymentResult.data) {
    return jsonError(paymentResult.error?.message || "Payment not found.", 404);
  }

  const html = renderPaymentDocumentHtml(paymentResult.data as any, kind);
  await adminClient
    .from("payments")
    .update({ document_status: "generated" })
    .eq("id", paymentId);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
