"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlignCenter, AlignLeft, AlignRight, Archive, Bell, Bot, Check,
  ChevronDown, Clock, Copy, Edit2, Eye, FileText,
  GripVertical, Image, Layout, LayoutList, Link as LinkIcon,
  Mail, MessageSquare, Minus, MousePointer, Phone, Plus,
  RefreshCw, Send, Settings, ShoppingBag, ToggleLeft,
  ToggleRight, Trash2, Type, Users, Workflow, X, Zap,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ContentItem } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// ─── Types ─────────────────────────────────────────────────────────────────────

type EmailTab = "stats" | "send" | "templates" | "editor" | "automations" | "inbox" | "submissions" | "history" | "wizard";

type Submission = {
  id: string; first_name: string; last_name: string | null; email: string;
  phone: string | null; company: string | null; subject: string | null;
  message: string; status: "new" | "read" | "replied" | "archived";
  notes: string | null; replied_at: string | null; created_at: string;
};

type InboxMessage = {
  id: string; from_email: string; from_name: string | null; to_email: string;
  subject: string; body_text: string | null; body_html: string | null;
  is_read: boolean; received_at: string;
};

type Automation = {
  id: string; name: string; description: string | null;
  trigger_type: string; trigger_conditions: Record<string, unknown>;
  action_type: string; action_data: Record<string, unknown>;
  delay_minutes: number; enabled: boolean;
  last_run_at: string | null; run_count: number; created_at: string;
};

type HistoryEvent = {
  id: string; type: "submission" | "email_sent" | "email_received" | "sms" | "call" | "message";
  timestamp: string; title: string; description: string;
  contact_email: string | null; contact_name: string | null;
  status: string | null; meta: Record<string, unknown>;
};

type EmailBlockType = "header" | "heading" | "text" | "button" | "image" | "columns" | "divider" | "spacer" | "footer";

type EmailBlockProps = {
  bgColor?: string; padTop?: number; padBottom?: number; padSide?: number;
  align?: "left" | "center" | "right";
  logoUrl?: string; logoAlt?: string; logoWidth?: number;
  content?: string; level?: "h1" | "h2" | "h3"; fontSize?: number; color?: string;
  buttonText?: string; buttonUrl?: string; buttonBgColor?: string; buttonColor?: string;
  src?: string; alt?: string; linkUrl?: string; imgWidth?: string;
  col1?: string; col2?: string; height?: number;
  companyName?: string; address?: string; preferencesUrl?: string; unsubscribeUrl?: string;
};

type EmailBlock = { id: string; type: EmailBlockType; props: EmailBlockProps };

type TemplateForm = {
  name: string; subject: string; status: string; previewText: string; category: string;
};

// ─── Automation meta ──────────────────────────────────────────────────────────

const TRIGGER_TYPES: { value: string; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "contact_form_submission", label: "Contact form submission",  desc: "When someone submits the /contact form",           icon: FileText },
  { value: "new_order",               label: "New order placed",          desc: "When a customer places a new order",               icon: ShoppingBag },
  { value: "order_status_change",     label: "Order status changes",      desc: "When an order's status changes (e.g. shipped)",    icon: RefreshCw },
  { value: "payment_received",        label: "Payment received",          desc: "When a payment is successfully captured",          icon: ShoppingBag },
  { value: "new_customer",            label: "New customer registered",   desc: "When a new user account is created",               icon: Users },
  { value: "sms_received",            label: "SMS received",              desc: "When an inbound SMS is received via Twilio",       icon: MessageSquare },
  { value: "call_completed",          label: "Call completed",            desc: "When a Twilio call ends",                          icon: Phone },
  { value: "project_created",         label: "New project created",       desc: "When a production project is created",             icon: Settings },
  { value: "schedule_reminder",       label: "Scheduled reminder",        desc: "Run on a recurring schedule",                      icon: Clock },
];

const ACTION_TYPES: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "send_email",    label: "Send email",             icon: Mail },
  { value: "send_sms",      label: "Send SMS",               icon: MessageSquare },
  { value: "notify_admin",  label: "Notify admin",           icon: Bell },
  { value: "create_task",   label: "Create task / note",     icon: FileText },
  { value: "update_contact",label: "Update contact record",  icon: Users },
];

const STATUS_SUBMISSION: Record<string, string> = {
  new:      "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  read:     "bg-muted text-muted-foreground",
  replied:  "bg-green-500/15 text-green-700 dark:text-green-300",
  archived: "bg-muted/60 text-muted-foreground",
};

const HISTORY_TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submission:     { label: "Form",     color: "bg-blue-500/15 text-blue-700",   icon: FileText },
  email_sent:     { label: "Sent",     color: "bg-green-500/15 text-green-700", icon: Send },
  email_received: { label: "Received", color: "bg-purple-500/15 text-purple-700", icon: Mail },
  sms:            { label: "SMS",      color: "bg-amber-500/15 text-amber-700", icon: MessageSquare },
  call:           { label: "Call",     color: "bg-orange-500/15 text-orange-700", icon: Phone },
  message:        { label: "Message",  color: "bg-muted text-muted-foreground",  icon: FileText },
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMAIL_TABS: [EmailTab, string][] = [
  ["stats", "Stats"], ["send", "Send Email"], ["templates", "Templates"],
  ["editor", "Template Editor"], ["automations", "Email Automations"],
  ["inbox", "Inbox"], ["submissions", "Form Submissions"],
  ["history", "History"], ["wizard", "Wizard"],
];

const MERGE_TAGS = [
  "{{first_name}}", "{{last_name}}", "{{full_name}}", "{{email}}",
  "{{order_id}}", "{{order_total}}", "{{order_status}}", "{{business_name}}",
  "{{site_url}}", "{{unsubscribe_url}}",
];

const BLOCK_LIBRARY: { type: EmailBlockType; label: string; desc: string; icon: React.ElementType }[] = [
  { type: "header",  label: "Header",   desc: "Logo / brand bar",       icon: Layout },
  { type: "columns", label: "Columns",  desc: "2 column layout",         icon: LayoutList },
  { type: "heading", label: "Heading",  desc: "H1, H2 or H3 title",      icon: Type },
  { type: "text",    label: "Text",     desc: "Body paragraph",           icon: AlignLeft },
  { type: "button",  label: "Button",   desc: "CTA button with link",     icon: MousePointer },
  { type: "image",   label: "Image",    desc: "Image with optional link", icon: Image },
  { type: "divider", label: "Divider",  desc: "Horizontal rule",          icon: Minus },
  { type: "spacer",  label: "Spacer",   desc: "Empty vertical gap",       icon: ChevronDown },
  { type: "footer",  label: "Footer",   desc: "Company info footer",      icon: FileText },
];

const BLOCK_DEFAULTS: Record<EmailBlockType, EmailBlockProps> = {
  header:  { logoUrl: "/logos/logo-light-lime.svg", logoAlt: "Logo", logoWidth: 200, bgColor: "#111111", padTop: 28, padBottom: 28, padSide: 40 },
  heading: { content: "Your Heading", level: "h1", fontSize: 28, color: "#0f1f1a", align: "left", padTop: 20, padBottom: 8, padSide: 40, bgColor: "#ffffff" },
  text:    { content: "Write your message here. Keep it clear and concise.", fontSize: 16, color: "#444444", align: "left", padTop: 8, padBottom: 16, padSide: 40, bgColor: "#ffffff" },
  button:  { buttonText: "Click Here →", buttonUrl: "#", buttonBgColor: "#2f6848", buttonColor: "#ffffff", align: "center", padTop: 20, padBottom: 20, padSide: 40, bgColor: "#ffffff" },
  image:   { src: "", alt: "Image", linkUrl: "", imgWidth: "100%", align: "center", padTop: 0, padBottom: 0, bgColor: "#ffffff" },
  columns: { col1: "<p>Column 1 content</p>", col2: "<p>Column 2 content</p>", bgColor: "#ffffff", padTop: 20, padBottom: 20, padSide: 40 },
  divider: { color: "#dddddd", padTop: 12, padBottom: 12, bgColor: "#ffffff" },
  spacer:  { height: 40, bgColor: "#ffffff" },
  footer:  { companyName: "Ctrl+P", address: "123 Print Ave, Austin, TX 78701", preferencesUrl: "{{preferences_url}}", unsubscribeUrl: "{{unsubscribe_url}}", bgColor: "#f5f5f5", color: "#888888", padTop: 24, padBottom: 24, padSide: 40 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

async function apiCall(method: string, body: Record<string, unknown>) {
  const db = getSupabaseBrowserClient();
  const token = (await db?.auth.getSession())?.data.session?.access_token;
  const res = await fetch("/api/admin/content", {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error || "Request failed"));
  return json;
}

async function getToken() {
  const db = getSupabaseBrowserClient();
  return (await db?.auth.getSession())?.data.session?.access_token ?? "";
}

async function adminGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
  return res.json() as Promise<T>;
}

async function adminPost(path: string, body: Record<string, unknown>, method = "POST") {
  const token = await getToken();
  const res = await fetch(path, {
    method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function fetchTemplates(): Promise<ContentItem[]> {
  const json = await adminGet<{ items?: ContentItem[] }>("/api/admin/content?type=email_template");
  return json.items ?? [];
}

function blockToHtml(block: EmailBlock): string {
  const p = block.props;
  const padStyle = `padding:${p.padTop ?? 0}px ${p.padSide ?? 0}px ${p.padBottom ?? 0}px;`;
  const bgStyle = p.bgColor ? `background-color:${p.bgColor};` : "";
  switch (block.type) {
    case "header":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="${padStyle}text-align:center;"><img src="${p.logoUrl}" alt="${p.logoAlt}" width="${p.logoWidth}" style="display:block;margin:0 auto;" /></td></tr></table>`;
    case "heading":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="${padStyle}text-align:${p.align};"><${p.level} style="margin:0;font-size:${p.fontSize}px;color:${p.color};">${p.content}</${p.level}></td></tr></table>`;
    case "text":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="${padStyle}text-align:${p.align};font-size:${p.fontSize}px;color:${p.color};line-height:1.6;">${p.content}</td></tr></table>`;
    case "button":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="${padStyle}text-align:${p.align};"><a href="${p.buttonUrl}" style="display:inline-block;padding:12px 24px;background:${p.buttonBgColor};color:${p.buttonColor};text-decoration:none;border-radius:4px;font-weight:600;">${p.buttonText}</a></td></tr></table>`;
    case "image":
      const imgEl = p.src ? `<img src="${p.src}" alt="${p.alt}" style="display:block;max-width:100%;width:${p.imgWidth};" />` : `<div style="height:120px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;">Image placeholder</div>`;
      const linked = p.linkUrl ? `<a href="${p.linkUrl}">${imgEl}</a>` : imgEl;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="text-align:${p.align ?? "center"};">${linked}</td></tr></table>`;
    case "columns":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="${padStyle}"><table width="100%"><tr><td width="50%" style="padding-right:10px;vertical-align:top;">${p.col1}</td><td width="50%" style="padding-left:10px;vertical-align:top;">${p.col2}</td></tr></table></td></tr></table>`;
    case "divider":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="${padStyle}"><hr style="border:none;border-top:1px solid ${p.color ?? "#ddd"};margin:0;" /></td></tr></table>`;
    case "spacer":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td height="${p.height ?? 40}"></td></tr></table>`;
    case "footer":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="${bgStyle}"><tr><td style="${padStyle}text-align:center;font-size:12px;color:${p.color};line-height:1.8;">${p.companyName}<br/>${p.address}<br/><a href="${p.preferencesUrl}" style="color:${p.color};">Preferences</a> &nbsp;|&nbsp; <a href="${p.unsubscribeUrl}" style="color:${p.color};">Unsubscribe</a></td></tr></table>`;
    default:
      return "";
  }
}

function blocksToFullHtml(blocks: EmailBlock[]): string {
  return `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>\n<body style="margin:0;padding:20px 0;background:#e9e9e9;font-family:Arial,sans-serif;">\n<table width="640" align="center" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;">\n<tr><td>\n${blocks.map(blockToHtml).join("\n")}\n</td></tr>\n</table>\n</body>\n</html>`;
}

// ─── Block preview renderer ────────────────────────────────────────────────────

function BlockPreview({ block, selected, onClick }: { block: EmailBlock; selected: boolean; onClick: () => void }) {
  const p = block.props;
  const bg = p.bgColor ?? "#ffffff";
  const pt = p.padTop ?? 0;
  const pb = p.padBottom ?? 0;
  const ps = p.padSide ?? 0;

  let inner: React.ReactNode;
  switch (block.type) {
    case "header":
      inner = (
        <div style={{ background: bg, padding: `${pt}px ${ps}px ${pb}px`, textAlign: "center" }}>
          {p.logoUrl ? <img src={p.logoUrl} alt={p.logoAlt} style={{ maxWidth: `${p.logoWidth}px`, maxHeight: 50 }} /> : <span style={{ color: "#ccc", fontSize: 14 }}>Logo</span>}
        </div>
      );
      break;
    case "heading": {
      const Tag = (p.level ?? "h1") as "h1" | "h2" | "h3";
      inner = (
        <div style={{ background: bg, padding: `${pt}px ${ps}px ${pb}px`, textAlign: p.align as "left" | "center" | "right" ?? "left" }}>
          <Tag style={{ margin: 0, fontSize: p.fontSize, color: p.color }}>{p.content}</Tag>
        </div>
      );
      break;
    }
    case "text":
      inner = <div style={{ background: bg, padding: `${pt}px ${ps}px ${pb}px`, textAlign: p.align as "left" | "center" | "right" ?? "left", fontSize: p.fontSize, color: p.color, lineHeight: 1.6 }}>{p.content}</div>;
      break;
    case "button":
      inner = (
        <div style={{ background: bg, padding: `${pt}px ${ps}px ${pb}px`, textAlign: p.align as "left" | "center" | "right" ?? "center" }}>
          <span style={{ display: "inline-block", padding: "10px 22px", background: p.buttonBgColor, color: p.buttonColor, borderRadius: 4, fontWeight: 600, fontSize: 14 }}>{p.buttonText}</span>
        </div>
      );
      break;
    case "image":
      inner = (
        <div style={{ background: bg, textAlign: p.align as "left" | "center" | "right" ?? "center" }}>
          {p.src ? <img src={p.src} alt={p.alt} style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} /> : <div style={{ height: 80, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>Image placeholder</div>}
        </div>
      );
      break;
    case "columns":
      inner = (
        <div style={{ background: bg, padding: `${pt}px ${ps}px ${pb}px`, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, padding: 8, border: "1px dashed #ddd", fontSize: 12, color: "#888" }} dangerouslySetInnerHTML={{ __html: p.col1 ?? "" }} />
          <div style={{ flex: 1, padding: 8, border: "1px dashed #ddd", fontSize: 12, color: "#888" }} dangerouslySetInnerHTML={{ __html: p.col2 ?? "" }} />
        </div>
      );
      break;
    case "divider":
      inner = <div style={{ background: bg, padding: `${pt}px 40px ${pb}px` }}><hr style={{ border: "none", borderTop: `1px solid ${p.color ?? "#ddd"}`, margin: 0 }} /></div>;
      break;
    case "spacer":
      inner = <div style={{ background: bg, height: Math.min(p.height ?? 40, 60) }} />;
      break;
    case "footer":
      inner = (
        <div style={{ background: bg, padding: `${pt}px ${ps}px ${pb}px`, textAlign: "center", fontSize: 12, color: p.color, lineHeight: 1.8 }}>
          <div>{p.companyName}</div>
          <div>{p.address}</div>
          <div style={{ marginTop: 4 }}><span style={{ color: p.color, textDecoration: "underline" }}>{p.preferencesUrl}</span> | <span style={{ color: p.color, textDecoration: "underline" }}>{p.unsubscribeUrl}</span></div>
        </div>
      );
      break;
    default:
      inner = null;
  }

  return (
    <div
      onClick={onClick}
      style={{ position: "relative", outline: selected ? "2px solid #2f6848" : "2px solid transparent", cursor: "pointer" }}
    >
      {inner}
      {selected && (
        <div style={{ position: "absolute", top: 2, right: 2, background: "#2f6848", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 3 }}>
          {block.type}
        </div>
      )}
    </div>
  );
}

// ─── Block settings panel ──────────────────────────────────────────────────────

function BlockSettings({ block, onChange }: { block: EmailBlock; onChange: (props: Partial<EmailBlockProps>) => void }) {
  const p = block.props;
  const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-0.5";
  const inputClass = "h-7 text-xs";

  function Field({ label, propKey, type = "text" }: { label: string; propKey: keyof EmailBlockProps; type?: string }) {
    return (
      <div>
        <span className={labelClass}>{label}</span>
        <Input
          type={type}
          className={inputClass}
          value={String(p[propKey] ?? "")}
          onChange={(e) => onChange({ [propKey]: type === "number" ? Number(e.target.value) : e.target.value } as Partial<EmailBlockProps>)}
        />
      </div>
    );
  }

  function ColorField({ label, propKey }: { label: string; propKey: keyof EmailBlockProps }) {
    return (
      <div>
        <span className={labelClass}>{label}</span>
        <div className="flex items-center gap-1.5">
          <input type="color" value={String(p[propKey] ?? "#000000")} onChange={(e) => onChange({ [propKey]: e.target.value } as Partial<EmailBlockProps>)} className="h-7 w-8 cursor-pointer rounded border p-0.5" />
          <Input className={inputClass} value={String(p[propKey] ?? "")} onChange={(e) => onChange({ [propKey]: e.target.value } as Partial<EmailBlockProps>)} />
        </div>
      </div>
    );
  }

  function AlignField() {
    return (
      <div>
        <span className={labelClass}>Alignment</span>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <Button key={a} variant="outline" size="icon" className={cn("h-7 w-7", p.align === a && "border-primary bg-primary/10")} onClick={() => onChange({ align: a })}>
              {a === "left" ? <AlignLeft className="h-3.5 w-3.5" /> : a === "center" ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const sectionTitle = (t: string) => <div className="mt-3 mb-1.5 border-t pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t}</div>;

  switch (block.type) {
    case "header":
      return (
        <div className="space-y-2">
          {sectionTitle("Logo")}
          <Field label="Logo / Image URL" propKey="logoUrl" />
          <Field label="Alt Text" propKey="logoAlt" />
          <Field label="Logo Width (px)" propKey="logoWidth" type="number" />
          {sectionTitle("Section")}
          <ColorField label="Background Color" propKey="bgColor" />
          <div className="grid grid-cols-2 gap-1">
            <Field label="Pad Top (px)" propKey="padTop" type="number" />
            <Field label="Pad Bottom (px)" propKey="padBottom" type="number" />
          </div>
          <Field label="Pad Left / Right (px)" propKey="padSide" type="number" />
        </div>
      );
    case "heading":
      return (
        <div className="space-y-2">
          {sectionTitle("Content")}
          <div><span className={labelClass}>Text</span><Textarea className="text-xs min-h-[60px] resize-none" value={p.content ?? ""} onChange={(e) => onChange({ content: e.target.value })} /></div>
          <div>
            <span className={labelClass}>Level</span>
            <Select value={p.level ?? "h1"} onValueChange={(v) => onChange({ level: v as "h1" | "h2" | "h3" })}>
              <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="h1">H1</SelectItem><SelectItem value="h2">H2</SelectItem><SelectItem value="h3">H3</SelectItem></SelectContent>
            </Select>
          </div>
          <Field label="Font Size (px)" propKey="fontSize" type="number" />
          <ColorField label="Text Color" propKey="color" />
          <AlignField />
          {sectionTitle("Section")}
          <ColorField label="Background" propKey="bgColor" />
          <div className="grid grid-cols-2 gap-1"><Field label="Pad Top" propKey="padTop" type="number" /><Field label="Pad Bottom" propKey="padBottom" type="number" /></div>
          <Field label="Pad Side" propKey="padSide" type="number" />
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          {sectionTitle("Content")}
          <div><span className={labelClass}>Text</span><Textarea className="text-xs min-h-[80px] resize-none" value={p.content ?? ""} onChange={(e) => onChange({ content: e.target.value })} /></div>
          <Field label="Font Size (px)" propKey="fontSize" type="number" />
          <ColorField label="Text Color" propKey="color" />
          <AlignField />
          {sectionTitle("Section")}
          <ColorField label="Background" propKey="bgColor" />
          <div className="grid grid-cols-2 gap-1"><Field label="Pad Top" propKey="padTop" type="number" /><Field label="Pad Bottom" propKey="padBottom" type="number" /></div>
          <Field label="Pad Side" propKey="padSide" type="number" />
        </div>
      );
    case "button":
      return (
        <div className="space-y-2">
          {sectionTitle("Button")}
          <Field label="Button Text" propKey="buttonText" />
          <Field label="Link URL" propKey="buttonUrl" />
          <ColorField label="Button Color" propKey="buttonBgColor" />
          <ColorField label="Text Color" propKey="buttonColor" />
          <AlignField />
          {sectionTitle("Section")}
          <ColorField label="Background" propKey="bgColor" />
          <div className="grid grid-cols-2 gap-1"><Field label="Pad Top" propKey="padTop" type="number" /><Field label="Pad Bottom" propKey="padBottom" type="number" /></div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          {sectionTitle("Image")}
          <Field label="Image URL" propKey="src" />
          <Field label="Alt Text" propKey="alt" />
          <Field label="Link URL (optional)" propKey="linkUrl" />
          <Field label="Width (px or %)" propKey="imgWidth" />
          <AlignField />
          {sectionTitle("Section")}
          <ColorField label="Background" propKey="bgColor" />
        </div>
      );
    case "columns":
      return (
        <div className="space-y-2">
          {sectionTitle("Column 1")}
          <Textarea className="text-xs min-h-[60px] resize-none" value={p.col1 ?? ""} onChange={(e) => onChange({ col1: e.target.value })} />
          {sectionTitle("Column 2")}
          <Textarea className="text-xs min-h-[60px] resize-none" value={p.col2 ?? ""} onChange={(e) => onChange({ col2: e.target.value })} />
          {sectionTitle("Section")}
          <ColorField label="Background" propKey="bgColor" />
          <div className="grid grid-cols-2 gap-1"><Field label="Pad Top" propKey="padTop" type="number" /><Field label="Pad Bottom" propKey="padBottom" type="number" /></div>
          <Field label="Pad Side" propKey="padSide" type="number" />
        </div>
      );
    case "divider":
      return (
        <div className="space-y-2">
          <ColorField label="Line Color" propKey="color" />
          <ColorField label="Background" propKey="bgColor" />
          <div className="grid grid-cols-2 gap-1"><Field label="Pad Top" propKey="padTop" type="number" /><Field label="Pad Bottom" propKey="padBottom" type="number" /></div>
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-2">
          <Field label="Height (px)" propKey="height" type="number" />
          <ColorField label="Background" propKey="bgColor" />
        </div>
      );
    case "footer":
      return (
        <div className="space-y-2">
          {sectionTitle("Footer Content")}
          <Field label="Company Name" propKey="companyName" />
          <Field label="Address" propKey="address" />
          <Field label="Preferences URL" propKey="preferencesUrl" />
          <Field label="Unsubscribe URL" propKey="unsubscribeUrl" />
          {sectionTitle("Style")}
          <ColorField label="Background" propKey="bgColor" />
          <ColorField label="Text Color" propKey="color" />
          <div className="grid grid-cols-2 gap-1"><Field label="Pad Top" propKey="padTop" type="number" /><Field label="Pad Bottom" propKey="padBottom" type="number" /></div>
        </div>
      );
    default:
      return <div className="text-sm text-muted-foreground">Select a block to edit its settings.</div>;
  }
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AdminEmail() {
  const [tab, setTab] = useState<EmailTab>("stats");
  const [templates, setTemplates] = useState<ContentItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subFilter, setSubFilter] = useState("all");
  const [subSearch, setSubSearch] = useState("");
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  // Inbox state
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState<InboxMessage | null>(null);

  // Automations state
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoForm, setAutoForm] = useState<Partial<Automation> | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  // History state
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState("all");

  // Template editor state
  const [editorBlocks, setEditorBlocks] = useState<EmailBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [htmlContent, setHtmlContent] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>({ name: "", subject: "", status: "Draft", previewText: "", category: "General" });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Send email state
  const [sendTo, setSendTo] = useState("");
  const [sendFrom, setSendFrom] = useState("Ctrl+P <noreply@ctrlp.io>");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (tab === "templates" || tab === "send") {
      setLoadingTemplates(true);
      fetchTemplates().then((t) => { setTemplates(t); setLoadingTemplates(false); });
    }
    if (tab === "submissions") {
      setSubLoading(true);
      adminGet<{ submissions: Submission[] }>("/api/admin/communications/submissions")
        .then((r) => { setSubmissions(r.submissions ?? []); setSubLoading(false); });
    }
    if (tab === "inbox") {
      setInboxLoading(true);
      adminGet<{ messages: InboxMessage[] }>("/api/admin/communications/inbox")
        .then((r) => { setInboxMessages(r.messages ?? []); setInboxLoading(false); });
    }
    if (tab === "automations") {
      setAutoLoading(true);
      adminGet<{ automations: Automation[] }>("/api/admin/communications/automations")
        .then((r) => { setAutomations(r.automations ?? []); setAutoLoading(false); });
    }
    if (tab === "history") {
      setHistoryLoading(true);
      adminGet<{ events: HistoryEvent[] }>("/api/admin/communications/history")
        .then((r) => { setHistoryEvents(r.events ?? []); setHistoryLoading(false); });
    }
  }, [tab]);

  const selectedBlock = editorBlocks.find((b) => b.id === selectedBlockId) ?? null;

  function addBlock(type: EmailBlockType) {
    const block: EmailBlock = { id: uid(), type, props: { ...BLOCK_DEFAULTS[type] } };
    setEditorBlocks((prev) => [...prev, block]);
    setSelectedBlockId(block.id);
  }

  function updateBlockProps(id: string, props: Partial<EmailBlockProps>) {
    setEditorBlocks((prev) => prev.map((b) => b.id === id ? { ...b, props: { ...b.props, ...props } } : b));
  }

  function removeBlock(id: string) {
    setEditorBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }

  function moveBlock(fromIdx: number, toIdx: number) {
    const next = [...editorBlocks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setEditorBlocks(next);
  }

  function openTemplate(tmpl: ContentItem) {
    setTemplateForm({ name: tmpl.title, subject: tmpl.subject ?? "", status: tmpl.status, previewText: tmpl.preheader ?? "", category: (tmpl.categories ?? [])[0] ?? "General" });
    setHtmlContent(tmpl.content);
    setEditorBlocks([]);
    setEditorMode("html");
    setEditingTemplateId(tmpl.id);
    setTab("editor");
  }

  function newTemplate() {
    setTemplateForm({ name: "", subject: "", status: "draft", previewText: "", category: "General" });
    setEditorBlocks([]);
    setHtmlContent("");
    setEditorMode("visual");
    setEditingTemplateId(null);
    setTab("editor");
  }

  function switchEditorMode(mode: "visual" | "html") {
    if (mode === "html") setHtmlContent(blocksToFullHtml(editorBlocks));
    if (mode === "visual") setEditorBlocks([]);
    setEditorMode(mode);
  }

  async function saveTemplate() {
    if (!templateForm.name.trim()) { alert("Template name is required."); return; }
    setSaving(true);
    const content = editorMode === "html" ? htmlContent : blocksToFullHtml(editorBlocks);
    try {
      await apiCall(editingTemplateId ? "PATCH" : "POST", {
        id: editingTemplateId, content_type: "email_template",
        title: templateForm.name, subject: templateForm.subject,
        preheader: templateForm.previewText, status: templateForm.status,
        categories: [templateForm.category], content,
        tags: [], hashtags: [], gallery: [],
      });
      setTemplates(await fetchTemplates());
      alert("Template saved!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await apiCall("DELETE", { id });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingTemplateId === id) { setEditingTemplateId(null); setTab("templates"); }
  }

  async function sendEmail() {
    if (!sendTo.trim() || !sendSubject.trim()) { alert("To and Subject are required."); return; }
    setSending(true);
    try {
      const db = getSupabaseBrowserClient();
      const token = (await db?.auth.getSession())?.data.session?.access_token;
      const body = sendTemplateId ? templates.find((t) => t.id === sendTemplateId)?.content ?? sendBody : sendBody;
      const res = await fetch("/api/admin/communications/email", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to: sendTo, from: sendFrom, subject: sendSubject, html: body }),
      });
      if (!res.ok) throw new Error("Send failed");
      alert("Email sent!");
      setSendTo(""); setSendSubject(""); setSendBody(""); setSendTemplateId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send email");
    } finally { setSending(false); }
  }

  function copyMergeTag(tag: string) {
    navigator.clipboard.writeText(tag).then(() => {
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 1500);
    });
  }

  // Stat placeholders
  const publishedCount = templates.filter((t) => t.status === "published").length;
  const draftCount = templates.filter((t) => t.status === "draft").length;

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-0.5 overflow-x-auto border-b scrollbar-none -mx-1 px-1">
        {EMAIL_TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors -mb-px",
              tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══ STATS TAB ══ */}
      {tab === "stats" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold">Emails</h2>
            <p className="text-sm text-muted-foreground">Email overview for templates, automations, sends, inbox sync, and history.</p>
          </div>

          {/* 4 metric cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Active templates", value: String(publishedCount || "—"), sub: `${draftCount} drafts` },
              { label: "Delivery rate",    value: "—",    sub: "No sends yet" },
              { label: "Inbox messages",   value: "—",    sub: "Inbox sync not configured" },
              { label: "Automations",      value: "—",    sub: "No active automations" },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="p-4">
                  <div className="text-[12px] text-muted-foreground">{m.label}</div>
                  <div className="my-1 text-3xl font-bold">{m.value}</div>
                  <div className="text-[11px] text-muted-foreground">{m.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Email health */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="col-span-2">
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 font-semibold">Email health</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "SMTP sends", status: "Configure SMTP in Settings", badge: "Setup required", red: true },
                      { label: "Inbox sync",  status: "Not connected",             badge: "Not configured",  red: true },
                      { label: "Templates",   status: `${publishedCount} active, ${draftCount} drafts`, badge: "Ready", red: false },
                      { label: "Automations", status: "No automations configured",  badge: "Not configured",  red: true },
                    ].map((h) => (
                      <div key={h.label} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{h.label}</span>
                          <span className={h.red ? "text-red-500 font-medium" : "text-green-600 font-medium"}>{h.badge}</span>
                        </div>
                        <div className="mt-1 text-sm font-medium">{h.status}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 font-semibold">Journey queue</div>
                {[["Due or queued", "0"], ["Journey emails sent", "0"], ["Total journey events", "0"]].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b py-2 last:border-0 text-sm">
                    <span>{k}</span><span className="font-semibold">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recent activity */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 font-semibold">Recent journey activity</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {["Recipient", "Step", "Subject", "Status", "Attempted", "Scheduled"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground text-sm">No journey events yet.</td></tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ SEND EMAIL TAB ══ */}
      {tab === "send" && (
        <div className="max-w-2xl space-y-4">
          <div><h2 className="text-lg font-bold">Send Email</h2><p className="text-sm text-muted-foreground">Compose and send a one-off email or use a saved template.</p></div>
          <Card><CardContent className="p-5 space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold">To</p>
              <Input placeholder="recipient@email.com or multiple comma-separated" value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold">From</p>
              <Input value={sendFrom} onChange={(e) => setSendFrom(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold">Subject</p>
              <Input placeholder="Email subject line" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold">Template (optional)</p>
              <Select value={sendTemplateId} onValueChange={setSendTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select a saved template…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None — compose below</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!sendTemplateId && (
              <div>
                <p className="mb-1 text-xs font-semibold">Body (HTML)</p>
                <Textarea placeholder="<p>Your email body here...</p>" value={sendBody} onChange={(e) => setSendBody(e.target.value)} className="min-h-[160px] font-mono text-xs" />
              </div>
            )}
            <Button onClick={sendEmail} disabled={sending} className="gap-2 w-full">
              <Send className="h-4 w-4" />{sending ? "Sending…" : "Send Email"}
            </Button>
          </CardContent></Card>
        </div>
      )}

      {/* ══ TEMPLATES TAB ══ */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h2 className="text-lg font-bold">Email Templates</h2><p className="text-sm text-muted-foreground">Saved templates for campaigns and automations.</p></div>
            <Button onClick={newTemplate} className="gap-1.5"><Plus className="h-4 w-4" />New Template</Button>
          </div>
          {loadingTemplates ? (
            <div className="py-12 text-center text-muted-foreground text-sm"><Zap className="mx-auto mb-2 h-5 w-5 animate-pulse" />Loading templates…</div>
          ) : templates.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <div className="font-medium">No email templates yet</div>
              <div className="mb-4 text-sm text-muted-foreground">Create your first template to get started.</div>
              <Button onClick={newTemplate}><Plus className="mr-2 h-4 w-4" />New Template</Button>
            </CardContent></Card>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {["Template Name", "Subject", "Category", "Status", "Updated", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {templates.map((tmpl) => (
                    <tr key={tmpl.id} className="hover:bg-muted/20">
                      <td className="max-w-[200px] px-4 py-2.5 font-medium truncate">{tmpl.title}</td>
                      <td className="max-w-[200px] px-4 py-2.5 text-muted-foreground truncate">{tmpl.subject ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{(tmpl.categories ?? [])[0] ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-[11px] capitalize">{tmpl.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-[12px]">
                        {tmpl.updated_at ? new Date(tmpl.updated_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTemplate(tmpl)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => deleteTemplate(tmpl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ TEMPLATE EDITOR TAB ══ */}
      {tab === "editor" && (
        <div className="-mx-5 -mb-5 flex flex-col" style={{ height: "calc(100vh - 48px - 49px - 44px)" }}>
          {/* Editor header */}
          <div className="shrink-0 border-b bg-card px-4 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input placeholder="Template name" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} className="h-8 flex-1 text-sm font-medium" />
              <Input placeholder="Subject line" value={templateForm.subject} onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))} className="h-8 flex-1 text-sm" />
              <Select value={templateForm.status} onValueChange={(v) => setTemplateForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 gap-1.5" disabled={saving} onClick={saveTemplate}>
                {saving ? <><Zap className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Check className="h-3.5 w-3.5" />Save</>}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Short preview shown in inbox…" value={templateForm.previewText} onChange={(e) => setTemplateForm((f) => ({ ...f, previewText: e.target.value }))} className="h-7 flex-1 text-xs" />
              <Select value={templateForm.category} onValueChange={(v) => setTemplateForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["General", "Marketing", "Transactional", "Order", "Newsletter"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button size="sm" variant={editorMode === "visual" ? "default" : "outline"} className="h-7 px-3 text-xs" onClick={() => switchEditorMode("visual")}>Visual</Button>
                <Button size="sm" variant={editorMode === "html" ? "default" : "outline"} className="h-7 px-3 text-xs" onClick={() => switchEditorMode("html")}>HTML</Button>
              </div>
              <Button variant="outline" size="icon" className="h-7 w-7" title="Preview"><Eye className="h-3.5 w-3.5" /></Button>
            </div>

            {/* Merge tags */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">FIELDS</span>
              {MERGE_TAGS.map((tag) => (
                <button key={tag} onClick={() => copyMergeTag(tag)} className={cn("flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-mono transition-colors hover:border-primary/60 hover:bg-primary/5", copiedTag === tag && "border-green-500 bg-green-500/10 text-green-700")}>
                  {copiedTag === tag ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                  {tag}
                </button>
              ))}
            </div>

            {templateForm.subject && (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">Rendered Subject</span>
                <span className="ml-2 text-foreground">{templateForm.subject.replace("{{first_name}}", "Jeremy").replace("{{last_name}}", "Waters")}</span>
              </div>
            )}
          </div>

          {/* Three-panel editor */}
          {editorMode === "visual" ? (
            <div className="flex flex-1 overflow-hidden">
              {/* Left: block library */}
              <div className="w-40 shrink-0 overflow-y-auto border-r bg-card/60 p-2">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Add Block</div>
                {BLOCK_LIBRARY.map(({ type, label, desc, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => addBlock(type)}
                    className="mb-1 flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-left hover:border-border hover:bg-accent transition-colors"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    <div>
                      <div className="text-[12px] font-semibold">{label}</div>
                      <div className="text-[10px] text-muted-foreground">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Center: preview */}
              <div className="flex-1 overflow-y-auto bg-[#e9e9e9] p-6">
                {editorBlocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <Mail className="h-10 w-10 text-muted-foreground/30" />
                    <div className="text-sm text-muted-foreground">Click a block on the left to start building your email.</div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-[640px] overflow-hidden rounded shadow-sm">
                    {editorBlocks.map((block, i) => (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={(e) => { e.preventDefault(); setDropIdx(i); }}
                        onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
                        onDrop={() => { if (dragIdx !== null) moveBlock(dragIdx, i); setDragIdx(null); setDropIdx(null); }}
                        className={cn("group relative", dropIdx === i && dragIdx !== i && "outline outline-2 outline-primary")}
                      >
                        <BlockPreview block={block} selected={selectedBlockId === block.id} onClick={() => setSelectedBlockId(block.id)} />
                        <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="rounded bg-black/60 p-1 text-white hover:bg-black/80" title="Drag to reorder">
                            <GripVertical className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="rounded bg-red-500/80 p-1 text-white hover:bg-red-600">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="py-3 bg-white text-center text-[11px] text-muted-foreground border-t">{editorBlocks.length} block{editorBlocks.length !== 1 ? "s" : ""}</div>
                  </div>
                )}
              </div>

              {/* Right: settings */}
              <div className="w-[250px] shrink-0 overflow-y-auto border-l bg-card/60 p-3">
                {selectedBlock ? (
                  <>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-bold capitalize">{selectedBlock.type} Settings</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBlock(selectedBlock.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </div>
                    <BlockSettings block={selectedBlock} onChange={(props) => updateBlockProps(selectedBlock.id, props)} />
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">Select a block to edit its settings.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden p-4">
              <Textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="h-full min-h-full font-mono text-xs leading-relaxed resize-none"
                placeholder="<!DOCTYPE html><html>...</html>"
              />
            </div>
          )}
        </div>
      )}

      {/* ══ AUTOMATIONS TAB ══ */}
      {tab === "automations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Email Automations</h2>
              <p className="text-sm text-muted-foreground">Trigger-based sequences for emails, SMS, and notifications. Connects to orders, calls, projects, contacts, and forms.</p>
            </div>
            <Button onClick={() => setAutoForm({ trigger_type: "contact_form_submission", action_type: "send_email", delay_minutes: 0, enabled: true })} className="gap-1.5">
              <Plus className="h-4 w-4" />New Automation
            </Button>
          </div>

          {/* Create / edit panel */}
          {autoForm !== null && (
            <Card className="border-primary/40">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{autoForm.id ? "Edit Automation" : "New Automation"}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAutoForm(null)}><X className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Automation name</p>
                    <Input value={autoForm.name ?? ""} onChange={(e) => setAutoForm((f) => ({ ...f!, name: e.target.value }))} placeholder="e.g. Welcome new contact" className="h-8 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                    <Input value={autoForm.description ?? ""} onChange={(e) => setAutoForm((f) => ({ ...f!, description: e.target.value }))} placeholder="What does this automation do?" className="h-8 text-sm" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
                    <Select value={autoForm.trigger_type ?? ""} onValueChange={(v) => setAutoForm((f) => ({ ...f!, trigger_type: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select trigger…" /></SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[11px] text-muted-foreground">{TRIGGER_TYPES.find((t) => t.value === autoForm.trigger_type)?.desc}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Action</p>
                    <Select value={autoForm.action_type ?? ""} onValueChange={(v) => setAutoForm((f) => ({ ...f!, action_type: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select action…" /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delay (minutes, 0 = immediate)</p>
                    <Input type="number" min={0} value={autoForm.delay_minutes ?? 0} onChange={(e) => setAutoForm((f) => ({ ...f!, delay_minutes: parseInt(e.target.value, 10) }))} className="h-8 text-sm" />
                  </div>
                  {/* Action data for send_email */}
                  {autoForm.action_type === "send_email" && (
                    <>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email Subject</p>
                        <Input value={(autoForm.action_data as Record<string,string>)?.subject ?? ""} onChange={(e) => setAutoForm((f) => ({ ...f!, action_data: { ...(f!.action_data ?? {}), subject: e.target.value } }))} placeholder="Hi {{first_name}}," className="h-8 text-sm" />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Template name</p>
                        <Select value={(autoForm.action_data as Record<string,string>)?.template_name ?? ""} onValueChange={(v) => setAutoForm((f) => ({ ...f!, action_data: { ...(f!.action_data ?? {}), template_name: v } }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select template…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None (compose inline)</SelectItem>
                            {templates.map((t) => <SelectItem key={t.id} value={t.title}>{t.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {autoForm.action_type === "send_sms" && (
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SMS Message</p>
                      <Textarea value={(autoForm.action_data as Record<string,string>)?.message ?? ""} onChange={(e) => setAutoForm((f) => ({ ...f!, action_data: { ...(f!.action_data ?? {}), message: e.target.value } }))} placeholder="Hi {{first_name}}, your order {{order_id}} is ready!" className="min-h-[60px] resize-none text-sm" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button size="sm" disabled={autoSaving} onClick={async () => {
                    if (!autoForm.name || !autoForm.trigger_type || !autoForm.action_type) { alert("Name, trigger, and action are required."); return; }
                    setAutoSaving(true);
                    try {
                      const method = autoForm.id ? "PATCH" : "POST";
                      await adminPost("/api/admin/communications/automations", autoForm as Record<string,unknown>, method);
                      const r = await adminGet<{ automations: Automation[] }>("/api/admin/communications/automations");
                      setAutomations(r.automations ?? []);
                      setAutoForm(null);
                    } catch { alert("Save failed"); }
                    finally { setAutoSaving(false); }
                  }}>{autoSaving ? "Saving…" : "Save Automation"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAutoForm(null)}>Cancel</Button>
                  <Button size="sm" variant="ghost" className="ml-auto gap-1 text-primary" asChild>
                    <Link href="/admin/agent" target="_blank"><Bot className="h-3.5 w-3.5" />Ask AI Agent</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Automations list */}
          {autoLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground"><Zap className="mx-auto mb-2 h-5 w-5 animate-pulse" />Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 text-left">Name</th>
                    <th className="px-4 py-2.5 text-left">Trigger</th>
                    <th className="px-4 py-2.5 text-left">Action</th>
                    <th className="px-4 py-2.5 text-left">Delay</th>
                    <th className="px-4 py-2.5 text-left">Runs</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {automations.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="max-w-[180px] px-4 py-2.5">
                        <div className="truncate font-medium">{a.name}</div>
                        {a.description && <div className="truncate text-[11px] text-muted-foreground">{a.description}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-[12px]">{TRIGGER_TYPES.find((t) => t.value === a.trigger_type)?.label ?? a.trigger_type}</td>
                      <td className="px-4 py-2.5 text-[12px]">{ACTION_TYPES.find((t) => t.value === a.action_type)?.label ?? a.action_type}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{a.delay_minutes === 0 ? "Immediate" : `${a.delay_minutes}m`}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{a.run_count}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={async () => {
                            await adminPost("/api/admin/communications/automations", { id: a.id, enabled: !a.enabled }, "PATCH");
                            setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, enabled: !x.enabled } : x));
                          }}
                          className="flex items-center gap-1 text-[12px]"
                        >
                          {a.enabled
                            ? <><ToggleRight className="h-4 w-4 text-green-600" /><span className="text-green-700">On</span></>
                            : <><ToggleLeft className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Off</span></>}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAutoForm(a)}><Edit2 className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={async () => {
                            if (!confirm("Delete this automation?")) return;
                            await adminPost("/api/admin/communications/automations", { id: a.id }, "DELETE");
                            setAutomations((prev) => prev.filter((x) => x.id !== a.id));
                          }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {automations.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">No automations yet. Click "New Automation" to get started.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Trigger reference card */}
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Available Triggers</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TRIGGER_TYPES.map(({ value, label, desc, icon: Icon }) => (
                <div key={value} className="flex items-start gap-2 rounded-lg border bg-card p-2.5">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <div>
                    <div className="text-[12px] font-semibold">{label}</div>
                    <div className="text-[11px] text-muted-foreground">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ INBOX TAB ══ */}
      {tab === "inbox" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Inbox</h2>
              <p className="text-sm text-muted-foreground">Incoming email replies synced from your connected inbox.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              setInboxLoading(true);
              adminGet<{ messages: InboxMessage[] }>("/api/admin/communications/inbox")
                .then((r) => { setInboxMessages(r.messages ?? []); setInboxLoading(false); });
            }}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          </div>

          {inboxLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground"><Zap className="mx-auto mb-2 h-5 w-5 animate-pulse" />Loading inbox…</div>
          ) : inboxMessages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Mail className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <div className="font-medium">Inbox is empty</div>
                <div className="text-sm text-muted-foreground max-w-sm mx-auto">To sync incoming emails here, configure IMAP/email forwarding from your provider (e.g. Hostinger) and set up a webhook to POST to <code className="font-mono text-xs bg-muted px-1 rounded">/api/email/webhook</code>.</div>
                <Button variant="outline" size="sm" asChild><Link href="/admin/settings">Configure in Settings</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex gap-4 overflow-hidden rounded-xl border bg-card">
              {/* Message list */}
              <div className="w-64 shrink-0 divide-y border-r overflow-y-auto max-h-[500px]">
                {inboxMessages.map((m) => (
                  <button key={m.id} onClick={() => {
                    setSelectedInbox(m);
                    if (!m.is_read) {
                      adminPost("/api/admin/communications/inbox", { id: m.id, is_read: true }, "PATCH");
                      setInboxMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, is_read: true } : x));
                    }
                  }} className={cn("w-full px-3 py-2.5 text-left hover:bg-muted/40 transition-colors", selectedInbox?.id === m.id && "bg-muted/60", !m.is_read && "font-semibold")}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {!m.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <span className="truncate text-[12px]">{m.from_name ?? m.from_email}</span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{m.subject}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(m.received_at).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
              {/* Message detail */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                {selectedInbox ? (
                  <>
                    <div className="mb-3 border-b pb-3">
                      <div className="text-lg font-semibold">{selectedInbox.subject}</div>
                      <div className="text-sm text-muted-foreground">From: {selectedInbox.from_name ?? selectedInbox.from_email} &lt;{selectedInbox.from_email}&gt;</div>
                      <div className="text-[12px] text-muted-foreground">{new Date(selectedInbox.received_at).toLocaleString()}</div>
                    </div>
                    {selectedInbox.body_html
                      ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedInbox.body_html }} />
                      : <pre className="text-sm whitespace-pre-wrap">{selectedInbox.body_text}</pre>}
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Select a message to read it.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ FORM SUBMISSIONS TAB ══ */}
      {tab === "submissions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Form Submissions</h2>
              <p className="text-sm text-muted-foreground">Contact form submissions from <code className="font-mono text-xs bg-muted px-1 rounded">my.controlp.io/contact</code>. All submissions are automatically stored here.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              setSubLoading(true);
              adminGet<{ submissions: Submission[] }>("/api/admin/communications/submissions")
                .then((r) => { setSubmissions(r.submissions ?? []); setSubLoading(false); });
            }}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          </div>

          {/* Stats row */}
          <div className="flex gap-2 flex-wrap">
            {(["all","new","read","replied","archived"] as const).map((s) => (
              <button key={s} onClick={() => setSubFilter(s)} className={cn("rounded-full border px-3 py-1 text-[12px] font-medium capitalize transition-all", subFilter === s ? "border-primary/60 bg-primary/10 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:border-border")}>
                {s === "all"
                  ? `All (${submissions.length})`
                  : `${s} (${submissions.filter((x) => x.status === s).length})`}
              </button>
            ))}
            <div className="ml-auto">
              <Input placeholder="Search by name or email…" value={subSearch} onChange={(e) => setSubSearch(e.target.value)} className="h-7 w-48 text-xs" />
            </div>
          </div>

          {subLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground"><Zap className="mx-auto mb-2 h-5 w-5 animate-pulse" />Loading…</div>
          ) : (
            <div className="space-y-2">
              {submissions
                .filter((s) => subFilter === "all" || s.status === subFilter)
                .filter((s) => !subSearch || `${s.first_name} ${s.last_name ?? ""} ${s.email}`.toLowerCase().includes(subSearch.toLowerCase()))
                .map((s) => (
                  <div key={s.id} className={cn("rounded-xl border bg-card overflow-hidden", expandedSub === s.id && "border-primary/40")}>
                    {/* Header row */}
                    <button onClick={() => {
                      setExpandedSub(expandedSub === s.id ? null : s.id);
                      if (s.status === "new") {
                        adminPost("/api/admin/communications/submissions", { id: s.id, status: "read" }, "PATCH");
                        setSubmissions((prev) => prev.map((x) => x.id === s.id ? { ...x, status: "read" } : x));
                      }
                    }} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left">
                      <div className={cn("shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold",
                        s.status === "new" ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground")}>
                        {(s.first_name[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{[s.first_name, s.last_name].filter(Boolean).join(" ")}</span>
                          {s.company && <span className="text-[12px] text-muted-foreground">— {s.company}</span>}
                          {s.status === "new" && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <span>{s.email}</span>
                          {s.phone && <span>· {s.phone}</span>}
                          {s.subject && <span>· {s.subject}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_SUBMISSION[s.status])}>{s.status}</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSub === s.id && "rotate-180")} />
                      </div>
                    </button>

                    {/* Expanded content */}
                    {expandedSub === s.id && (
                      <div className="border-t px-4 py-4 space-y-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{s.message}</p>
                        {s.notes && (
                          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm">
                            <span className="font-semibold text-amber-700">Note: </span>{s.notes}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                          <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium hover:bg-muted transition-colors">
                            <Mail className="h-3.5 w-3.5" />Reply via email
                          </a>
                          {(["read","replied","archived"] as const).map((status) => (
                            status !== s.status && (
                              <Button key={status} variant="outline" size="sm" className="h-7 text-[12px] capitalize" onClick={async () => {
                                await adminPost("/api/admin/communications/submissions", { id: s.id, status }, "PATCH");
                                setSubmissions((prev) => prev.map((x) => x.id === s.id ? { ...x, status } : x));
                              }}>{status === "replied" ? "Mark replied" : status === "archived" ? "Archive" : "Mark read"}</Button>
                            )
                          ))}
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px] text-primary ml-auto" asChild>
                            <Link href="/admin/agent" target="_blank"><Bot className="h-3.5 w-3.5" />Draft reply with AI</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {submissions.filter((s) => subFilter === "all" || s.status === subFilter).length === 0 && (
                <Card><CardContent className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                  <div className="font-medium">No submissions yet</div>
                  <div className="text-sm text-muted-foreground">Submissions from <code className="font-mono text-xs">/contact</code> appear here automatically.</div>
                </CardContent></Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ HISTORY TAB ══ */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">History</h2>
              <p className="text-sm text-muted-foreground">Unified timeline of all email, SMS, call, and form activity — searchable by contact email.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              setHistoryLoading(true);
              const qs = [historySearch && `email=${encodeURIComponent(historySearch)}`, historyType !== "all" && `type=${historyType}`].filter(Boolean).join("&");
              adminGet<{ events: HistoryEvent[] }>(`/api/admin/communications/history${qs ? `?${qs}` : ""}`)
                .then((r) => { setHistoryEvents(r.events ?? []); setHistoryLoading(false); });
            }}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Filter by email address…" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="h-8 w-52 text-sm" />
            <Select value={historyType} onValueChange={setHistoryType}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="submission">Form submissions</SelectItem>
                <SelectItem value="email_received">Received emails</SelectItem>
                <SelectItem value="email_sent">Sent emails</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="message">Messages</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {historyLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground"><Zap className="mx-auto mb-2 h-5 w-5 animate-pulse" />Loading history…</div>
          ) : historyEvents.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <div className="font-medium">No history yet</div>
              <div className="text-sm text-muted-foreground">Email, SMS, call, and form activity will appear here.</div>
            </CardContent></Card>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
              {historyEvents.map((ev) => {
                const meta = HISTORY_TYPE_META[ev.type] ?? HISTORY_TYPE_META.message;
                const Icon = meta.icon;
                return (
                  <div key={ev.id} className="relative flex gap-4 pb-4 pl-12">
                    <div className={cn("absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background", meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 rounded-xl border bg-card p-3 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{ev.title}</div>
                          {ev.description && <div className="text-[12px] text-muted-foreground">{ev.description}</div>}
                          {ev.contact_email && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <button className="hover:underline hover:text-primary" onClick={() => setHistorySearch(ev.contact_email!)}>{ev.contact_name ?? ev.contact_email}</button>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", meta.color)}>{meta.label}</span>
                          <div className="mt-1 text-[11px] text-muted-foreground">{new Date(ev.timestamp).toLocaleString()}</div>
                          {ev.status && <div className="text-[11px] text-muted-foreground capitalize">{ev.status}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ WIZARD TAB ══ */}
      {tab === "wizard" && (
        <div className="max-w-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">Email Setup Wizard</h2>
              <p className="text-sm text-muted-foreground">Get your email system configured step by step. Use the AI Agent to help with any step.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
              <Link href="/admin/agent" target="_blank"><Bot className="h-3.5 w-3.5 text-primary" />Ask AI Agent</Link>
            </Button>
          </div>

          <Accordion type="multiple" defaultValue={["smtp"]} className="space-y-2">

            <AccordionItem value="smtp" className="rounded-xl border bg-card overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">1</div>
                  <div>
                    <div className="font-semibold text-sm">Configure SMTP</div>
                    <div className="text-[12px] text-muted-foreground">Add your Hostinger SMTP credentials for outbound email</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t">
                <div className="pt-3 space-y-3 text-sm">
                  <p>Add these environment variables to your Coolify deployment:</p>
                  <div className="rounded-lg bg-muted p-3 font-mono text-[12px] space-y-1">
                    <div>SMTP_HOST=smtp.hostinger.com</div>
                    <div>SMTP_PORT=465</div>
                    <div>SMTP_USER=hello@ctrlp.io</div>
                    <div>SMTP_PASS=••••••••</div>
                    <div>SMTP_FROM="Ctrl+P &lt;hello@ctrlp.io&gt;"</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild><Link href="/admin/settings">Open Settings</Link></Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-primary" asChild>
                      <Link href="/admin/agent" target="_blank"><Bot className="h-3.5 w-3.5" />Get AI help</Link>
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="template" className={cn("rounded-xl border bg-card overflow-hidden", templates.length > 0 && "border-green-500/40")}>
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold", templates.length > 0 ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>
                    {templates.length > 0 ? <Check className="h-3.5 w-3.5" /> : "2"}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Create your first email template</div>
                    <div className="text-[12px] text-muted-foreground">
                      {templates.length > 0 ? `${templates.length} template${templates.length !== 1 ? "s" : ""} created ✓` : "Use the Template Editor to build a branded email"}
                    </div>
                  </div>
                  {templates.length > 0 && <Badge className="ml-auto mr-2 bg-green-500/20 text-green-700 border-green-500/30">Done</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t">
                <div className="pt-3 space-y-3 text-sm">
                  <p>Build email templates for order confirmations, newsletters, quotes, and campaigns using the visual drag-and-drop builder or HTML editor.</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setTab("editor")}>Open Template Editor</Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-primary" asChild>
                      <Link href="/admin/agent" target="_blank"><Bot className="h-3.5 w-3.5" />Generate template with AI</Link>
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="contact" className={cn("rounded-xl border bg-card overflow-hidden", submissions.length > 0 && "border-green-500/40")}>
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold", submissions.length > 0 ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>
                    {submissions.length > 0 ? <Check className="h-3.5 w-3.5" /> : "3"}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Contact form integration</div>
                    <div className="text-[12px] text-muted-foreground">
                      {submissions.length > 0 ? `${submissions.length} submission${submissions.length !== 1 ? "s" : ""} received ✓` : "Wire up my.controlp.io/contact to capture leads"}
                    </div>
                  </div>
                  {submissions.length > 0 && <Badge className="ml-auto mr-2 bg-green-500/20 text-green-700 border-green-500/30">Done</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t">
                <div className="pt-3 space-y-3 text-sm">
                  <p>The contact form at <code className="font-mono text-xs bg-muted px-1 rounded">/contact</code> is already wired up — submissions are stored in the database and appear in the Form Submissions tab.</p>
                  <p className="text-muted-foreground">To automatically email yourself when a new submission arrives, set up the "Notify admin" automation in the Automations tab.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setTab("submissions")}>View Submissions</Button>
                    <Button size="sm" variant="outline" onClick={() => setTab("automations")}>Set Up Automation</Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="automation" className={cn("rounded-xl border bg-card overflow-hidden", automations.some((a) => a.enabled) && "border-green-500/40")}>
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold", automations.some((a) => a.enabled) ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>
                    {automations.some((a) => a.enabled) ? <Check className="h-3.5 w-3.5" /> : "4"}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Enable automations</div>
                    <div className="text-[12px] text-muted-foreground">
                      {automations.filter((a) => a.enabled).length > 0 ? `${automations.filter((a) => a.enabled).length} automation${automations.filter((a) => a.enabled).length !== 1 ? "s" : ""} active ✓` : "Turn on order confirmations, follow-ups, and more"}
                    </div>
                  </div>
                  {automations.some((a) => a.enabled) && <Badge className="ml-auto mr-2 bg-green-500/20 text-green-700 border-green-500/30">Done</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t">
                <div className="pt-3 space-y-3 text-sm">
                  <p>7 pre-built automations are ready to go — order confirmations, welcome emails, shipping notifications, and more. Enable them in the Automations tab and connect your email templates.</p>
                  <div className="grid gap-1.5">
                    {automations.slice(0, 4).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-1.5">
                        <span className="text-[12px] font-medium">{a.name}</span>
                        <button onClick={async () => {
                          await adminPost("/api/admin/communications/automations", { id: a.id, enabled: !a.enabled }, "PATCH");
                          setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, enabled: !x.enabled } : x));
                        }} className="flex items-center gap-1 text-[12px]">
                          {a.enabled
                            ? <><ToggleRight className="h-4 w-4 text-green-600" /><span className="text-green-700">On</span></>
                            : <><ToggleLeft className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Off</span></>}
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setTab("automations")}>Manage All Automations</Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="test" className="rounded-xl border bg-card overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">5</div>
                  <div>
                    <div className="font-semibold text-sm">Send a test email</div>
                    <div className="text-[12px] text-muted-foreground">Verify SMTP is working with a quick test</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t">
                <div className="pt-3 space-y-3 text-sm">
                  <p>Send a test email to <code className="font-mono text-xs bg-muted px-1 rounded">jwaters@qallus.co</code> to confirm your SMTP configuration is working.</p>
                  <Button size="sm" onClick={() => setTab("send")}>Go to Send Email</Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="inbox" className="rounded-xl border bg-card overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">6</div>
                  <div>
                    <div className="font-semibold text-sm">Configure inbox sync</div>
                    <div className="text-[12px] text-muted-foreground">Sync incoming emails from your Hostinger inbox</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t">
                <div className="pt-3 space-y-3 text-sm">
                  <p>To see incoming replies in the Inbox tab, set up email forwarding or IMAP sync from Hostinger. Forwarded emails need to POST to:</p>
                  <div className="rounded-lg bg-muted p-3 font-mono text-[12px]">/api/email/webhook</div>
                  <p className="text-muted-foreground text-[12px]">Alternatively, configure Postmark, SendGrid, or Mailgun webhooks to forward inbound email to this endpoint.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild><Link href="/admin/settings">Settings</Link></Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-primary" asChild>
                      <Link href="/admin/agent" target="_blank"><Bot className="h-3.5 w-3.5" />Ask AI for setup help</Link>
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      )}
    </div>
  );
}
