"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, Heart, Share2, UserPlus } from "lucide-react";

type ActionProps = {
  cardId: string;
  slug: string;
  publicUrl: string;
};

type LeadField = { key: string; label: string; enabled: boolean; required: boolean };
type LeadFormSettings = {
  enabled?: boolean;
  title?: string;
  description?: string;
  submit_label?: string;
  button_background?: string;
  button_text_color?: string;
  field_background?: string;
  field_text_color?: string;
  fields?: LeadField[];
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

export function PublicLeadCapture({ cardId, slug, accent, settings }: ActionProps & { accent: string; settings?: LeadFormSettings | null }) {
  const leadSettings = {
    enabled: true,
    title: "Send me your info",
    description: "Share your contact details and I'll follow up.",
    submit_label: "Send info",
    button_background: accent,
    button_text_color: "#07130b",
    field_background: "rgba(0,0,0,.2)",
    field_text_color: "inherit",
    fields: [
      { key: "name", label: "Name", enabled: true, required: false },
      { key: "email", label: "Email", enabled: true, required: false },
      { key: "phone", label: "Phone", enabled: true, required: false },
      { key: "company", label: "Company", enabled: false, required: false },
      { key: "message", label: "Message", enabled: true, required: false },
    ],
    ...(settings || {}),
  };
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [state, setState] = useState<"idle" | "saving" | "sent" | "error">("idle");
  if (leadSettings.enabled === false) return null;
  const fieldStyle = {
    background: leadSettings.field_background,
    color: leadSettings.field_text_color,
  };

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
      <div className="font-semibold">{leadSettings.title}</div>
      {leadSettings.description && <div className="mt-1 text-xs opacity-70">{leadSettings.description}</div>}
      <div className="mt-3 grid gap-2">
        {leadSettings.fields?.filter((field) => field.enabled).map((field) => field.key === "message" ? (
          <textarea key={field.key} required={field.required} className="min-h-20 rounded-xl border border-white/15 px-3 py-2 text-sm outline-none placeholder:text-current/45" style={fieldStyle} placeholder={field.label} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
        ) : (
          <input key={field.key} required={field.required} className="rounded-xl border border-white/15 px-3 py-2 text-sm outline-none placeholder:text-current/45" style={fieldStyle} placeholder={field.label} value={String(form[field.key as keyof typeof form] || "")} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />
        ))}
      </div>
      <button disabled={state === "saving"} className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: leadSettings.button_background || accent, color: leadSettings.button_text_color || "#07130b" }}>
        {state === "saving" ? "Sending..." : leadSettings.submit_label}
      </button>
      {state === "sent" && <div className="mt-2 text-xs opacity-80">Sent. Thank you.</div>}
      {state === "error" && <div className="mt-2 text-xs text-red-200">Could not send. Try again.</div>}
    </form>
  );
}
