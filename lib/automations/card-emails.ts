import nodemailer from "nodemailer";

function env(name: string) { return process.env[name] || ""; }

function configured() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD"));
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") || 465),
    secure: (env("SMTP_SECURE") || "true").toLowerCase() !== "false",
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
  });
}

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ControlP.io</title></head>
<body style="margin:0;padding:0;background:#0d1a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1a0f;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111f14;border-radius:14px;overflow:hidden;border:1px solid #1e3322">
        <tr><td style="background:#0a120c;padding:18px 28px;border-bottom:1px solid #1e3322">
          <span style="color:#a3e635;font-size:20px;font-weight:800;letter-spacing:-0.5px">ControlP.io</span>
          <span style="color:#4b6b52;font-size:13px;margin-left:10px">Digital Card</span>
        </td></tr>
        <tr><td style="padding:28px;color:#d1fae5">${content}</td></tr>
        <tr><td style="background:#0a120c;border-top:1px solid #1e3322;padding:14px 28px;font-size:11px;color:#4b6b52">
          ControlP.io &bull; Digital Business Cards &bull; <a href="https://my.controlp.io" style="color:#4b6b52">my.controlp.io</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#a3e635;color:#0a120c;font-weight:700;font-size:14px;padding:10px 22px;border-radius:8px;text-decoration:none">${label}</a>`;
}

function pill(label: string, color = "#1e3322", text = "#a3e635") {
  return `<span style="display:inline-block;background:${color};color:${text};font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px">${label}</span>`;
}

// ── 1. Lead notification → card owner ────────────────────────────────────────
export async function sendLeadNotification(opts: {
  ownerEmail: string;
  ownerName: string;
  cardName: string;
  cardPublicUrl: string;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  leadMessage: string | null;
  leadSource: string;
  leadCompany: string | null;
  dashboardUrl: string;
}) {
  if (!configured()) return;
  const details = [
    opts.leadName    && `<tr><td style="padding:5px 0;color:#6b8f72;font-size:13px">Name</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#d1fae5">${opts.leadName}</td></tr>`,
    opts.leadEmail   && `<tr><td style="padding:5px 0;color:#6b8f72;font-size:13px">Email</td><td style="padding:5px 0;font-size:13px"><a href="mailto:${opts.leadEmail}" style="color:#a3e635">${opts.leadEmail}</a></td></tr>`,
    opts.leadPhone   && `<tr><td style="padding:5px 0;color:#6b8f72;font-size:13px">Phone</td><td style="padding:5px 0;font-size:13px"><a href="tel:${opts.leadPhone}" style="color:#a3e635">${opts.leadPhone}</a></td></tr>`,
    opts.leadCompany && `<tr><td style="padding:5px 0;color:#6b8f72;font-size:13px">Company</td><td style="padding:5px 0;font-size:13px;color:#d1fae5">${opts.leadCompany}</td></tr>`,
    opts.leadMessage && `<tr><td colspan="2" style="padding:10px 0 5px;color:#6b8f72;font-size:13px">Message</td></tr><tr><td colspan="2" style="padding:5px 12px;font-size:13px;color:#d1fae5;background:#0a120c;border-radius:8px;border:1px solid #1e3322">${opts.leadMessage}</td></tr>`,
  ].filter(Boolean).join("");

  const html = baseHtml(`
    <div style="margin-bottom:20px">
      <div style="font-size:11px;color:#6b8f72;margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">New lead &mdash; ${opts.cardName}</div>
      <div style="font-size:26px;font-weight:800;color:#a3e635;margin-bottom:4px">&#9889; New lead from your card</div>
      <div style="font-size:14px;color:#6b8f72">Someone just submitted your lead form. Here&apos;s what they shared:</div>
    </div>
    <div style="background:#0a120c;border:1px solid #1e3322;border-radius:10px;padding:16px 18px;margin-bottom:20px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${details}
        <tr><td style="padding:5px 0;color:#6b8f72;font-size:13px">Source</td><td style="padding:5px 0">${pill(opts.leadSource)}</td></tr>
      </table>
    </div>
    <div>${btn(opts.dashboardUrl, "View in dashboard")}</div>
  `);

  await createTransporter().sendMail({
    from: `ControlP.io <${env("EMAIL_FROM") || env("SMTP_USER")}>`,
    to: opts.ownerEmail,
    subject: `New lead on "${opts.cardName}"${opts.leadName ? ` from ${opts.leadName}` : ""}`,
    text: `New lead on "${opts.cardName}".\n${opts.leadName ? `Name: ${opts.leadName}\n` : ""}${opts.leadEmail ? `Email: ${opts.leadEmail}\n` : ""}${opts.leadPhone ? `Phone: ${opts.leadPhone}\n` : ""}${opts.leadMessage ? `Message: ${opts.leadMessage}\n` : ""}\nView: ${opts.dashboardUrl}`,
    html,
  });
}

// ── 2. Lead follow-up → the lead themselves ───────────────────────────────────
export async function sendLeadFollowUp(opts: {
  leadEmail: string;
  leadName: string | null;
  ownerName: string;
  cardName: string;
  cardPublicUrl: string;
  customMessage?: string;
}) {
  if (!configured()) return;
  const greeting = opts.leadName ? `Hi ${opts.leadName.split(" ")[0]}` : "Hi there";
  const body = opts.customMessage
    || `Just following up on your recent inquiry. I'd love to connect — feel free to reply to this email or visit my card below.`;

  const html = baseHtml(`
    <div style="margin-bottom:24px">
      <div style="font-size:26px;font-weight:800;color:#a3e635;margin-bottom:8px">Following up</div>
      <div style="font-size:15px;color:#6b8f72">${greeting} &mdash; ${opts.ownerName} here.</div>
    </div>
    <div style="font-size:15px;color:#d1fae5;line-height:1.7;margin-bottom:24px">${body}</div>
    <div>${btn(opts.cardPublicUrl, "View my card")}</div>
  `);

  await createTransporter().sendMail({
    from: `${opts.ownerName} via ControlP.io <${env("EMAIL_FROM") || env("SMTP_USER")}>`,
    to: opts.leadEmail,
    replyTo: env("EMAIL_REPLY_TO") || env("SMTP_USER"),
    subject: `Following up — ${opts.ownerName}`,
    text: `${greeting},\n\n${body}\n\nView my card: ${opts.cardPublicUrl}`,
    html,
  });
}

// ── 3. NFC / QR scan alert → card owner ──────────────────────────────────────
export async function sendScanAlert(opts: {
  ownerEmail: string;
  ownerName: string;
  cardName: string;
  eventType: "nfc_tap" | "qr_scan";
  deviceType: string;
  dashboardUrl: string;
}) {
  if (!configured()) return;
  const label = opts.eventType === "nfc_tap" ? "NFC Tap" : "QR Scan";
  const icon  = opts.eventType === "nfc_tap" ? "📲" : "🔲";

  const html = baseHtml(`
    <div style="margin-bottom:20px">
      <div style="font-size:11px;color:#6b8f72;margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">${label} &mdash; ${opts.cardName}</div>
      <div style="font-size:26px;font-weight:800;color:#a3e635;margin-bottom:4px">${icon} Someone scanned your card</div>
      <div style="font-size:14px;color:#6b8f72">A visitor just triggered a ${label.toLowerCase()} on <strong style="color:#d1fae5">${opts.cardName}</strong>.</div>
    </div>
    <div style="background:#0a120c;border:1px solid #1e3322;border-radius:10px;padding:14px 18px;margin-bottom:20px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;color:#6b8f72;font-size:13px">Type</td><td>${pill(label)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b8f72;font-size:13px">Device</td><td style="font-size:13px;color:#d1fae5">${opts.deviceType}</td></tr>
        <tr><td style="padding:4px 0;color:#6b8f72;font-size:13px">Card</td><td style="font-size:13px;color:#d1fae5">${opts.cardName}</td></tr>
      </table>
    </div>
    <div>${btn(opts.dashboardUrl, "View analytics")}</div>
  `);

  await createTransporter().sendMail({
    from: `ControlP.io <${env("EMAIL_FROM") || env("SMTP_USER")}>`,
    to: opts.ownerEmail,
    subject: `${icon} ${label} on "${opts.cardName}"`,
    text: `Someone triggered a ${label.toLowerCase()} on "${opts.cardName}" (${opts.deviceType}).\n\nView analytics: ${opts.dashboardUrl}`,
    html,
  });
}

// ── 4. Square payment trigger → lead / customer ───────────────────────────────
export async function sendPaymentAutomation(opts: {
  to: string;
  recipientName: string | null;
  triggerType: string;
  amount?: number;
  cardName?: string;
  customSubject?: string;
  customMessage?: string;
}) {
  if (!configured()) return;
  const isReceived = opts.triggerType === "payment_received";
  const headline = isReceived ? "&#10003; Payment received — thank you!" : "Your subscription is active";
  const body = opts.customMessage || (isReceived
    ? `We've received your payment${opts.amount ? ` of <strong style="color:#a3e635">$${opts.amount.toFixed(2)}</strong>` : ""}. Thank you — we'll be in touch shortly.`
    : "Your subscription has been activated. Welcome aboard!");

  const html = baseHtml(`
    <div style="margin-bottom:20px">
      <div style="font-size:26px;font-weight:800;color:#a3e635;margin-bottom:8px">${headline}</div>
      <div style="font-size:15px;color:#d1fae5;line-height:1.7">${body}</div>
    </div>
  `);

  await createTransporter().sendMail({
    from: `ControlP.io <${env("EMAIL_FROM") || env("SMTP_USER")}>`,
    to: opts.to,
    subject: opts.customSubject || (isReceived ? "Payment confirmed — ControlP.io" : "Subscription activated — ControlP.io"),
    text: `${opts.recipientName ? `Hi ${opts.recipientName},\n\n` : ""}${opts.customMessage || headline}`,
    html,
  });
}
