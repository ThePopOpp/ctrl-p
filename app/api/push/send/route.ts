import { NextResponse } from "next/server";
import webpush from "web-push";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

type SendBody = {
  title?: string;
  body?: string;
  url?: string;
  image?: string;
  tag?: string;
  userId?: string; // target a single user; omit to broadcast to everyone
};

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string };

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;
  const { adminClient } = verified;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:jw@controlp.io";
  if (!publicKey || !privateKey) return jsonError("VAPID keys are not configured on the server.", 501);
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = (await request.json().catch(() => ({}))) as SendBody;
  if (!payload.title && !payload.body) return jsonError("A title or body is required.", 400);

  let query = adminClient.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (payload.userId) query = query.eq("user_id", payload.userId);
  const { data: subs, error } = await query;
  if (error) return jsonError(error.message, 500);

  const notification = JSON.stringify({
    title: payload.title || "Ctrl+P",
    body: payload.body || "",
    url: payload.url || "/",
    image: payload.image,
    tag: payload.tag,
  });

  const rows = (subs ?? []) as SubscriptionRow[];
  const results = await Promise.allSettled(
    rows.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, notification),
    ),
  );

  // Prune subscriptions the push service reports as gone.
  const expired: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) expired.push(rows[i].endpoint);
    }
  });
  if (expired.length) {
    await adminClient.from("push_subscriptions").delete().in("endpoint", expired);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent, failed: results.length - sent, pruned: expired.length });
}
