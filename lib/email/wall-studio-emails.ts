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
          ControlP.io &bull; Wall Studio &bull; Chandler, AZ &bull; <a href="https://my.controlp.io" style="color:#71717a">my.controlp.io</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendBookingConfirmation(options: {
  to: string;
  name: string;
  ref: string;
  projectType: string;
  preferredDate: string;
  timeWindow: string;
  phone: string;
}): Promise<void> {
  if (!configured()) return;

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#18181b">Install request received</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.5">
      Thanks, ${options.name}. We&apos;ve received your Wall Studio installation request and will reach out to confirm and schedule a free on-site measure.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:10px;padding:4px 16px;margin-bottom:20px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a">Reference</td><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;font-weight:700;text-align:right">${options.ref}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a">Project</td><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:right">${options.projectType}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a">Preferred date</td><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:right">${options.preferredDate}</td></tr>
      <tr><td style="padding:10px 0;font-size:13px;color:#71717a">Time window</td><td style="padding:10px 0;font-size:14px;text-align:right">${options.timeWindow}</td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">
      We&apos;ll text ${options.phone} to confirm. Questions? Call (480) 999-9906 or reply to this email.
    </p>`;

  await createTransporter().sendMail({
    from: env("SMTP_FROM") || env("SMTP_USER"),
    to: options.to,
    subject: `Install request ${options.ref} received — ControlP.io Wall Studio`,
    html: baseHtml(content),
  });
}
