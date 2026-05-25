"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, Heart, Plus, Share2, UserPlus, X } from "lucide-react";

type ActionProps = {
  cardId: string;
  slug: string;
  publicUrl: string;
  position?: string;
  accent?: string;
  background?: string;
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

const fabPositions: Record<string, string> = {
  bottom_right: "bottom-5 right-5 items-end",
  bottom_left: "bottom-5 left-5 items-start",
  bottom_center: "bottom-5 left-1/2 -translate-x-1/2 items-center",
  top_right: "right-5 top-5 items-end",
};

export function PublicCardActions({ cardId, slug, publicUrl, position = "bottom_right", accent = "#a3ff12", background = "#07130b" }: ActionProps) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

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

  const actions = [
    { label: "Copy", icon: Copy, onClick: copyLink },
    { label: "Share", icon: Share2, onClick: shareCard },
    { label: "Save", icon: UserPlus, onClick: saveContact },
    { label: "Like", icon: Heart, onClick: likeCard },
  ];

  return (
    <div className={`fixed z-40 flex flex-col gap-2 ${fabPositions[position] || fabPositions.bottom_right}`}>
      {open && (
        <div className="grid gap-2 rounded-[1.4rem] border border-white/15 bg-black/40 p-2 shadow-2xl backdrop-blur-xl">
          {actions.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={async () => {
                await onClick();
                setOpen(false);
              }}
              className="flex min-w-28 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold shadow-lg transition hover:bg-white/15"
              style={{ color: accent }}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
      {message && <div className="rounded-2xl border border-white/15 bg-black/50 px-3 py-2 text-center text-xs shadow-xl backdrop-blur-xl">{message}</div>}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close card actions" : "Open card actions"}
        onClick={() => setOpen((value) => !value)}
        className="grid h-14 w-14 place-items-center rounded-full border border-white/15 text-lg font-semibold shadow-2xl transition hover:scale-105"
        style={{ background: accent, color: background }}
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-6 w-6" />}
      </button>
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
