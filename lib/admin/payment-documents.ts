import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentDocumentKind = "invoice" | "receipt";

type PaymentRecord = {
  id: string;
  order_id: string;
  user_id?: string | null;
  amount: number | string | null;
  status: string;
  provider: string | null;
  method: string | null;
  currency?: string | null;
  notes?: string | null;
  invoice_number?: string | null;
  invoice_due_at?: string | null;
  invoice_terms?: string | null;
  billing_contact?: unknown;
  line_items?: unknown;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
  discount_amount?: number | string | null;
  balance_due?: number | string | null;
  payment_link_url?: string | null;
  received_at?: string | null;
  created_at?: string | null;
  orders?: {
    order_number?: string | null;
    company?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    total?: number | string | null;
    users?: {
      full_name?: string | null;
      company?: string | null;
    } | null;
  } | null;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback);
}

function html(value: unknown) {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getPaymentDocumentUrl(appUrl: string, paymentId: string, kind: PaymentDocumentKind) {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/api/admin/payments/${paymentId}/document?kind=${kind}`;
}

export function buildPaymentMessage(input: {
  kind: PaymentDocumentKind;
  payment: PaymentRecord;
  documentUrl: string;
}) {
  const label = input.kind === "receipt" ? "receipt" : "invoice";
  const order = Array.isArray(input.payment.orders) ? input.payment.orders[0] : input.payment.orders;
  const orderNumber = order?.order_number || input.payment.order_id.slice(0, 8);
  const amount = money.format(numberValue(input.payment.amount));
  const payLine = input.payment.payment_link_url && input.kind === "invoice"
    ? `\n\nPay securely here: ${input.payment.payment_link_url}`
    : "";

  return {
    subject: `ControlP.io ${label} for order ${orderNumber}`,
    body: `Hi,\n\nYour ControlP.io ${label} for order ${orderNumber} is ready.\n\nAmount: ${amount}\nView ${label}: ${input.documentUrl}${payLine}\n\nThank you,\nControlP.io`,
    sms: `ControlP.io ${label} for order ${orderNumber}: ${input.documentUrl}${input.payment.payment_link_url && input.kind === "invoice" ? ` Pay: ${input.payment.payment_link_url}` : ""}`,
  };
}

export async function loadPaymentDocument(adminClient: SupabaseClient, paymentId: string) {
  return adminClient
    .from("payments")
    .select("id, order_id, user_id, amount, status, provider, method, currency, notes, invoice_number, invoice_due_at, invoice_terms, billing_contact, line_items, subtotal, tax_amount, discount_amount, balance_due, payment_link_url, document_status, delivery_status, received_at, created_at, orders!payments_order_id_fkey(order_number, company, customer_email, customer_phone, total, users!orders_user_id_fkey(full_name, company))")
    .eq("id", paymentId)
    .single();
}

export function renderPaymentDocumentHtml(payment: PaymentRecord, kind: PaymentDocumentKind, autoPrint = false) {
  const order = Array.isArray(payment.orders) ? payment.orders[0] : payment.orders;
  const billingContact = asRecord(payment.billing_contact);
  const sender = asRecord(billingContact.sender);
  const customer = asRecord(billingContact.customer);
  const lines = asArray(payment.line_items);
  const title = kind === "receipt" ? "Receipt" : "Invoice";
  const orderNumber = order?.order_number || payment.order_id.slice(0, 8);
  const invoiceNumber = payment.invoice_number || `${kind.toUpperCase()}-${payment.id.slice(0, 8)}`;
  const senderLogo = text(sender.logo_url, "https://my.controlp.io/logos/ctrl-p-logo-dark.svg");
  const senderName = text(sender.name, "ControlP.io");
  const senderEmail = text(sender.email, "hello@controlp.io");
  const senderWebsite = text(sender.website, "https://www.controlp.io");
  const senderPhone = text(sender.phone, "");
  const senderAddress = text(sender.address, "");
  const orderUsers = Array.isArray(order?.users) ? order?.users[0] : order?.users;
  const customerName = text(customer.name, orderUsers?.full_name || order?.company || "Customer");
  const customerCompany = text(customer.company, order?.company || orderUsers?.company || "");
  const customerEmail = text(customer.email, order?.customer_email || "");
  const customerPhone = text(customer.phone, order?.customer_phone || "");
  const subtotal = numberValue(payment.subtotal ?? payment.amount);
  const tax = numberValue(payment.tax_amount);
  const discount = numberValue(payment.discount_amount);
  const total = numberValue(payment.amount);
  const paidAt = kind === "receipt" ? formatDate(payment.received_at || payment.created_at) : "";

  const lineRows = lines.length ? lines.map((item) => {
    const description = html(item.description || item.name || "Line item");
    const quantity = html(item.quantity || 1);
    const unit = money.format(numberValue(text(item.unit_price || 0)));
    const lineTotal = money.format(numberValue(text(item.line_total || item.total || 0)));
    return `<tr><td>${description}</td><td class="right">${quantity}</td><td class="right">${unit}</td><td class="right">${lineTotal}</td></tr>`;
  }).join("") : `<tr><td>${html(payment.notes || `${title} for order ${orderNumber}`)}</td><td class="right">1</td><td class="right">${money.format(total)}</td><td class="right">${money.format(total)}</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${html(title)} ${html(invoiceNumber)}</title>
  <style>
    @page { size: Letter; margin: 0; }
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f7f2; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 8.5in; min-height: 11in; margin: 32px auto; background: #fff; border: 1px solid #dfe5d8; border-radius: 12px; padding: 0.45in; page-break-after: always; }
    .top { display: flex; justify-content: space-between; gap: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 28px; }
    img { max-height: 54px; max-width: 190px; object-fit: contain; }
    h1 { margin: 0; font-size: 36px; letter-spacing: -0.02em; }
    h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; color: #647060; letter-spacing: .08em; }
    .muted, .meta { color: #5f6b5c; font-size: 13px; line-height: 1.55; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 28px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #647060; border-bottom: 1px solid #e5e7eb; padding: 10px 0; }
    td { border-bottom: 1px solid #eef1eb; padding: 14px 0; font-size: 14px; }
    .right { text-align: right; }
    .totals { margin-left: auto; margin-top: 24px; width: 320px; }
    .totals div { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .totals .grand { border-top: 2px solid #111827; font-size: 22px; font-weight: 700; }
    .badge { display: inline-block; border-radius: 999px; background: #e5ff5f; color: #183300; padding: 5px 10px; font-weight: 700; font-size: 12px; }
    .actions { margin-top: 28px; display: flex; gap: 10px; }
    .button { background: #111827; color: white; border-radius: 8px; padding: 11px 14px; text-decoration: none; font-size: 14px; font-weight: 700; }
    @media screen and (max-width: 900px) { .page { width: calc(100vw - 24px); min-height: auto; padding: 24px; } .top, .grid { grid-template-columns: 1fr; display: grid; } }
    @media print { body { background: #fff; } .page { width: 8.5in; min-height: 11in; margin: 0; border: 0; border-radius: 0; } .actions { display: none; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div>
        ${senderLogo ? `<img src="${html(senderLogo)}" alt="${html(senderName)}" />` : ""}
        <div class="meta" style="margin-top: 14px;">
          <strong>${html(senderName)}</strong><br />
          ${html(senderAddress)}${senderAddress ? "<br />" : ""}
          ${html(senderPhone)}${senderPhone ? " · " : ""}${html(senderEmail)}<br />
          ${html(senderWebsite)}
        </div>
      </div>
      <div class="right">
        <h1>${html(title)}</h1>
        <div class="meta">#${html(invoiceNumber)}</div>
        <div class="meta">Order ${html(orderNumber)}</div>
        ${kind === "receipt" ? `<div class="badge" style="margin-top: 12px;">Paid${paidAt ? ` ${html(paidAt)}` : ""}</div>` : `<div class="meta">Due ${html(formatDate(payment.invoice_due_at) || "on receipt")}</div>`}
      </div>
    </section>
    <section class="grid">
      <div>
        <h2>Bill To</h2>
        <div class="meta">
          <strong>${html(customerName)}</strong><br />
          ${customerCompany ? `${html(customerCompany)}<br />` : ""}
          ${html(customerEmail)}<br />
          ${html(customerPhone)}
        </div>
      </div>
      <div>
        <h2>Details</h2>
        <div class="meta">
          Status: ${html(payment.status)}<br />
          Processor: ${html(payment.provider || "manual")}<br />
          Method: ${html(payment.method || "invoice")}<br />
          Terms: ${html(payment.invoice_terms || "Due on receipt")}
        </div>
      </div>
    </section>
    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Total</th></tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
    <section class="totals">
      <div><span>Subtotal</span><span>${money.format(subtotal)}</span></div>
      <div><span>Tax</span><span>${money.format(tax)}</span></div>
      <div><span>Discount</span><span>-${money.format(discount)}</span></div>
      <div class="grand"><span>Total</span><span>${money.format(total)}</span></div>
    </section>
    ${payment.payment_link_url && kind === "invoice" ? `<section class="actions"><a class="button" href="${html(payment.payment_link_url)}">Pay securely</a><button class="button" onclick="window.print()">Download PDF</button></section>` : `<section class="actions"><button class="button" onclick="window.print()">Download PDF</button></section>`}
  </main>
  ${autoPrint ? `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>` : ""}
</body>
</html>`;
}
