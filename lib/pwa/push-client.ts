/* Client-side web-push subscription helper. */
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type EnableResult = { ok: boolean; error?: string; code?: "unsupported" | "config" | "denied" | "server" };

export async function enablePushNotifications(): Promise<EnableResult> {
  if (!pushSupported()) {
    return { ok: false, code: "unsupported", error: "Notifications aren't supported on this device or browser." };
  }
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, code: "config", error: "Push notifications are not configured yet." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, code: "denied", error: "Notification permission was blocked." };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  try {
    const db = getSupabaseBrowserClient();
    const token = db ? (await db.auth.getSession()).data.session?.access_token : null;
    if (token) headers["authorization"] = `Bearer ${token}`;
  } catch {
    /* anonymous subscription is fine */
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify(subscription),
  });
  if (!res.ok) {
    return { ok: false, code: "server", error: "Could not save your notification subscription." };
  }
  return { ok: true };
}
