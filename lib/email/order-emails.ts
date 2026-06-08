import nodemailer from "nodemailer";

function env(name: string) {
  return process.env[name] || "";
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") || 465),
    secure: (env("SMTP_SECURE") || "true").toLowerCase() !== "false",
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
  });
}

function configured() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD"));
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmt = (v: number | string | null | undefined) => money.format(Number(v || 0));

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ControlP.io</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
        <tr><td style="background:#1a1a1a;padding:20px 28px">
          <span style="color:#a3e635;font-size:22px;font-weight:700;letter-spacing:-0.5px">ControlP.io</span>
        </td></tr>
        <tr><td style="padding:28px">${content}</td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #e4e4e7;padding:16px 28px;font-size:12px;color:#71717a">
          ControlP.io &bull; Print management platform &bull; <a href="https://my.controlp.io" style="color:#71717a">my.controlp.io</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function itemRows(items: Array<{ name: string; quantity: number; unit_price: number | string; line_total: number | string }>) {
  return items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px">${item.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px;color:#71717a;text-align:center">&times;${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:right;font-weight:600">${fmt(item.line_total)}</td>
    </tr>`).join("");
}

export async function sendOrderConfirmation(options: {
  to: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; unit_price: number | string; line_total: number | string }>;
  subtotal: number | string;
  discountAmount?: number | string | null;
  total: number | string;
  paymentLinkUrl?: string | null;
  shippingMethod?: string | null;
}) {
  if (!configured()) return;

  const from = env("EMAIL_FROM") || env("SMTP_USER");
  const appUrl = env("PUBLIC_APP_URL") || "https://my.controlp.io";
  const discount = Number(options.discountAmount || 0);

  const html = baseHtml(`
    <div style="margin-bottom:20px">
      <div style="font-size:28px;margin-bottom:4px">&#10003; Order received</div>
      <div style="font-size:15px;color:#71717a">Hi ${options.customerName || "there"} &mdash; we&apos;ve got your order and we&apos;ll start working on it shortly.</div>
    </div>

    <div style="background:#f9f9f9;border-radius:8px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#71717a">
      Order <strong style="color:#1a1a1a;font-family:monospace">#${options.orderNumber}</strong>
      &bull; ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#71717a;padding-bottom:8px;border-bottom:1px solid #e4e4e7">Item</th>
          <th style="text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#71717a;padding-bottom:8px;border-bottom:1px solid #e4e4e7">Qty</th>
          <th style="text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#71717a;padding-bottom:8px;border-bottom:1px solid #e4e4e7">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows(options.items)}</tbody>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr>
        <td style="font-size:14px;color:#71717a;padding:3px 0">Subtotal</td>
        <td style="font-size:14px;text-align:right;padding:3px 0">${fmt(options.subtotal)}</td>
      </tr>
      ${discount > 0 ? `<tr>
        <td style="font-size:14px;color:#16a34a;padding:3px 0">Discount applied</td>
        <td style="font-size:14px;text-align:right;color:#16a34a;padding:3px 0">-${fmt(discount)}</td>
      </tr>` : ""}
      <tr>
        <td style="font-size:16px;font-weight:700;padding:8px 0 3px;border-top:2px solid #e4e4e7">Total</td>
        <td style="font-size:16px;font-weight:700;text-align:right;padding:8px 0 3px;border-top:2px solid #e4e4e7">${fmt(options.total)}</td>
      </tr>
    </table>

    ${options.paymentLinkUrl ? `
    <div style="text-align:center;margin-bottom:20px">
      <a href="${options.paymentLinkUrl}" style="display:inline-block;background:#a3e635;color:#1a1a1a;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none">Complete payment</a>
    </div>` : ""}

    <div style="font-size:13px;color:#71717a">
      <p style="margin:0 0 8px">You can track your order at any time from your <a href="${appUrl}/dashboard/customer/orders" style="color:#16a34a">customer dashboard</a>.</p>
      ${options.shippingMethod ? `<p style="margin:0">Delivery method: <strong style="color:#1a1a1a">${options.shippingMethod.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</strong></p>` : ""}
    </div>
  `);

  await createTransporter().sendMail({
    from,
    to: options.to,
    subject: `Order #${options.orderNumber} confirmed — ControlP.io`,
    text: `Hi ${options.customerName || "there"},\n\nYour order #${options.orderNumber} has been received. Total: ${fmt(options.total)}.\n\n${options.paymentLinkUrl ? `Complete payment: ${options.paymentLinkUrl}\n\n` : ""}Track your order: ${appUrl}/dashboard/customer/orders`,
    html,
  });
}

export async function sendPaymentConfirmed(options: {
  to: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  amount: number | string;
  receiptUrl?: string | null;
}) {
  if (!configured()) return;

  const from = env("EMAIL_FROM") || env("SMTP_USER");
  const appUrl = env("PUBLIC_APP_URL") || "https://my.controlp.io";

  const html = baseHtml(`
    <div style="margin-bottom:20px">
      <div style="font-size:28px;margin-bottom:4px">&#10003; Payment confirmed</div>
      <div style="font-size:15px;color:#71717a">Hi ${options.customerName || "there"} &mdash; your payment of <strong style="color:#1a1a1a">${fmt(options.amount)}</strong> was successful.</div>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <div style="font-size:13px;color:#16a34a;font-weight:600">Payment received</div>
      <div style="font-size:22px;font-weight:700;color:#1a1a1a;margin:4px 0">${fmt(options.amount)}</div>
      <div style="font-size:13px;color:#71717a">Order <span style="font-family:monospace;color:#1a1a1a">#${options.orderNumber}</span></div>
    </div>

    <div style="font-size:14px;color:#71717a;margin-bottom:20px">
      Your order is now in production. We&apos;ll be in touch with proof approvals and shipping updates.
    </div>

    <div style="display:flex;gap:12px;margin-bottom:20px">
      ${options.receiptUrl ? `<a href="${options.receiptUrl}" style="display:inline-block;background:#f4f4f5;color:#1a1a1a;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;border:1px solid #e4e4e7">View receipt</a>` : ""}
      <a href="${appUrl}/dashboard/customer/orders" style="display:inline-block;background:#a3e635;color:#1a1a1a;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">Track order</a>
    </div>
  `);

  await createTransporter().sendMail({
    from,
    to: options.to,
    subject: `Payment confirmed for order #${options.orderNumber} — ControlP.io`,
    text: `Hi ${options.customerName || "there"},\n\nYour payment of ${fmt(options.amount)} for order #${options.orderNumber} was successful.\n\nTrack your order: ${appUrl}/dashboard/customer/orders${options.receiptUrl ? `\nView receipt: ${options.receiptUrl}` : ""}`,
    html,
  });
}
