"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, Heart, Share2, UserPlus } from "lucide-react";

type ActionProps = {
  cardId: string;
  slug: string;
  publicUrl: string;
};

async function track(cardId: string, eventType: string, metadata?: Record<string, unknown>) {
  await fetch("/api/digital-cards/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card_id: cardId, event_type: eventType, metadata }),
  }).catch(() => null);
}

export function PublicCardActions({ cardId, slug, publicUrl }: ActionProps) {
  const [message, setMessage] = useState("");

  async function copyLink() {
    await navigator.clipboard?.writeText(publicUrl);
    await track(cardId, "copy_link");
    setMessage("Link copied.");
  }

  async function shareCard() {
    if (navigator.share) {
      await navigator.share({ title: "Digital business card", url: publicUrl }).catch(() => null);
    } else {
      await navigator.clipboard?.writeText(publicUrl);
    }
    await track(cardId, "share");
    setMessage("Share ready.");
  }

  async function likeCard() {
    await track(cardId, "like");
    setMessage("Liked.");
  }

  async function saveContact() {
    await track(cardId, "save_contact");
    window.location.href = `/api/digital-cards/vcf?slug=${encodeURIComponent(slug)}`;
  }

  return (
    <div className="mb-4">
      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={copyLink} className="grid place-items-center rounded-2xl border border-white/15 bg-white/10 p-3 text-xs font-medium">
          <Copy className="h-4 w-4" />
          <span className="mt-1">Copy</span>
        </button>
        <button type="button" onClick={shareCard} className="grid place-items-center rounded-2xl border border-white/15 bg-white/10 p-3 text-xs font-medium">
          <Share2 className="h-4 w-4" />
          <span className="mt-1">Share</span>
        </button>
        <button type="button" onClick={saveContact} className="grid place-items-center rounded-2xl border border-white/15 bg-white/10 p-3 text-xs font-medium">
          <UserPlus className="h-4 w-4" />
          <span className="mt-1">Save</span>
        </button>
        <button type="button" onClick={likeCard} className="grid place-items-center rounded-2xl border border-white/15 bg-white/10 p-3 text-xs font-medium">
          <Heart className="h-4 w-4" />
          <span className="mt-1">Like</span>
        </button>
      </div>
      {message && <div className="mt-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center text-xs opacity-80">{message}</div>}
    </div>
  );
}

export function PublicLeadCapture({ cardId, slug, accent }: ActionProps & { accent: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [state, setState] = useState<"idle" | "saving" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const response = await fetch("/api/digital-cards/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ card_id: cardId, slug, ...form }),
    });
    setState(response.ok ? "sent" : "error");
    if (response.ok) setForm({ name: "", email: "", phone: "", company: "", message: "" });
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
      <div className="font-semibold">Send me your info</div>
      <div className="mt-1 text-xs opacity-70">Share your contact details and I&apos;ll follow up.</div>
      <div className="mt-3 grid gap-2">
        <input className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-current/45" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-current/45" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-current/45" placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <textarea className="min-h-20 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-current/45" placeholder="Message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      </div>
      <button disabled={state === "saving"} className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ background: accent }}>
        {state === "saving" ? "Sending..." : "Send info"}
      </button>
      {state === "sent" && <div className="mt-2 text-xs opacity-80">Sent. Thank you.</div>}
      {state === "error" && <div className="mt-2 text-xs text-red-200">Could not send. Try again.</div>}
    </form>
  );
}
