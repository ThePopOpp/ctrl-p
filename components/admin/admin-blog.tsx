"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Archive, BookOpen, Bot, Calendar, CalendarClock,
  ChevronLeft, ChevronRight, Edit2, EyeOff, GripVertical, Image,
  LayoutGrid, LayoutList, Layers, LogOut, Mail, Minus, Moon,
  Plus, Send, Share2, Sun, Trash2, Type, Video, X, Zap,
} from "lucide-react";

import { getCurrentAdminProfile } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ContentItem, ContentStatus, GalleryItem } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "cards" | "list" | "table" | "calendar";
type EditorTab = "simple" | "html" | "wysiwyg";
type Page = "list" | "editor";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ContentStatus, string> = {
  draft:     "bg-muted text-muted-foreground",
  scheduled: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  published: "bg-green-500/15 text-green-700 dark:text-green-300",
  archived:  "bg-muted/60 text-muted-foreground",
};

// ─── Blog Block Builder types & helpers ───────────────────────────────────────

type BlogBlockType = "heading" | "paragraph" | "image" | "video" | "quote" | "code" | "button" | "divider" | "spacer" | "columns" | "columns3" | "columns4";

type BlogBlockProps = {
  // Text
  level?: "h1" | "h2" | "h3";
  content?: string; fontSize?: number; color?: string;
  align?: "left" | "center" | "right";
  // Image
  src?: string; alt?: string; caption?: string; linkUrl?: string; imgWidth?: string;
  // Video
  videoUrl?: string;
  // Quote / Code
  author?: string; language?: string;
  // Button
  buttonText?: string; buttonUrl?: string; buttonBgColor?: string; buttonColor?: string;
  // Spacer / Divider
  height?: number; padTop?: number; padBottom?: number;
  // Columns
  col1?: string; col2?: string; col3?: string; col4?: string; colGap?: number;
  // Section (per-block spacing + background)
  marginTop?: number; marginBottom?: number;
  paddingTop?: number; paddingBottom?: number; paddingSide?: number;
  bgColor?: string;
};

type BlogBlock = { id: string; type: BlogBlockType; props: BlogBlockProps };

const BLOG_BLOCK_DEFS: { type: BlogBlockType; label: string; icon: React.ElementType; defaults: BlogBlockProps }[] = [
  { type: "heading",   label: "Heading",    icon: Type,      defaults: { level: "h2", content: "Section Heading", color: "#0f1f1a", fontSize: 28, align: "left" } },
  { type: "paragraph", label: "Paragraph",  icon: AlignLeft, defaults: { content: "Your paragraph text here.", color: "#333333", fontSize: 16, align: "left" } },
  { type: "image",     label: "Image",      icon: Image,     defaults: { src: "", alt: "", caption: "", imgWidth: "100%", align: "center" } },
  { type: "video",     label: "Video",      icon: Video,     defaults: { videoUrl: "" } },
  { type: "quote",     label: "Quote",      icon: AlignRight, defaults: { content: "An inspiring quote or callout.", author: "", align: "left" } },
  { type: "button",    label: "Button",     icon: Send,      defaults: { buttonText: "Click Here", buttonUrl: "#", buttonBgColor: "#2f6848", buttonColor: "#ffffff", align: "center" } },
  { type: "columns",   label: "2 Columns",  icon: Layers,    defaults: { col1: "Left column content.", col2: "Right column content.", colGap: 24 } },
  { type: "columns3",  label: "3 Columns",  icon: Layers,    defaults: { col1: "Column 1.", col2: "Column 2.", col3: "Column 3.", colGap: 20 } },
  { type: "columns4",  label: "4 Columns",  icon: Layers,    defaults: { col1: "Col 1.", col2: "Col 2.", col3: "Col 3.", col4: "Col 4.", colGap: 16 } },
  { type: "code",      label: "Code",       icon: Minus,     defaults: { content: "// your code here", language: "javascript" } },
  { type: "divider",   label: "Divider",    icon: Minus,     defaults: { padTop: 16, padBottom: 16 } },
  { type: "spacer",    label: "Spacer",     icon: Minus,     defaults: { height: 40 } },
];

function blogUid() { return Math.random().toString(36).slice(2, 9); }

function blogBlockToHtml(block: BlogBlock): string {
  const { type, props } = block;
  if (type === "spacer") return `<div style="height:${props.height ?? 40}px;"></div>`;

  const textStyle = [
    props.align && `text-align:${props.align}`,
    props.color && `color:${props.color}`,
    props.fontSize && `font-size:${props.fontSize}px`,
  ].filter(Boolean).join(";");

  let inner = "";
  switch (type) {
    case "heading":
      inner = `<${props.level ?? "h2"} style="${textStyle};margin:0;">${props.content ?? ""}</${props.level ?? "h2"}>`;
      break;
    case "paragraph":
      inner = `<p style="${textStyle};line-height:1.7;margin:0;">${props.content ?? ""}</p>`;
      break;
    case "image": {
      const img = `<img src="${props.src ?? ""}" alt="${props.alt ?? ""}" style="max-width:${props.imgWidth ?? "100%"};height:auto;display:block;${props.align === "center" ? "margin:0 auto;" : ""}" />`;
      inner = `${props.linkUrl ? `<a href="${props.linkUrl}">${img}</a>` : img}${props.caption ? `<p style="text-align:center;color:#666;font-size:13px;margin:6px 0 0;">${props.caption}</p>` : ""}`;
      break;
    }
    case "video":
      inner = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;"><iframe src="${props.videoUrl ?? ""}" style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:8px;" frameborder="0" allowfullscreen></iframe></div>`;
      break;
    case "quote":
      inner = `<blockquote style="border-left:4px solid #2f6848;padding:1em 1.5em;background:#f0f7f3;border-radius:0 8px 8px 0;margin:0;"><p style="margin:0;font-style:italic;${textStyle}">${props.content ?? ""}</p>${props.author ? `<cite style="display:block;margin-top:0.5em;font-size:13px;color:#666;">— ${props.author}</cite>` : ""}</blockquote>`;
      break;
    case "code":
      inner = `<pre style="background:#1a1a2e;color:#e0e0e0;padding:1.5em;border-radius:8px;overflow-x:auto;font-size:14px;margin:0;"><code class="language-${props.language ?? "javascript"}">${(props.content ?? "").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</code></pre>`;
      break;
    case "button":
      inner = `<div style="text-align:${props.align ?? "center"};"><a href="${props.buttonUrl ?? "#"}" style="display:inline-block;padding:14px 28px;background:${props.buttonBgColor ?? "#2f6848"};color:${props.buttonColor ?? "#fff"};text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;">${props.buttonText ?? "Click Here"}</a></div>`;
      break;
    case "columns":
      inner = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${props.colGap ?? 24}px;"><div>${props.col1 ?? ""}</div><div>${props.col2 ?? ""}</div></div>`;
      break;
    case "columns3":
      inner = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:${props.colGap ?? 20}px;"><div>${props.col1 ?? ""}</div><div>${props.col2 ?? ""}</div><div>${props.col3 ?? ""}</div></div>`;
      break;
    case "columns4":
      inner = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:${props.colGap ?? 16}px;"><div>${props.col1 ?? ""}</div><div>${props.col2 ?? ""}</div><div>${props.col3 ?? ""}</div><div>${props.col4 ?? ""}</div></div>`;
      break;
    case "divider":
      inner = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />`;
      break;
    default: return "";
  }

  const mt = props.marginTop ?? 0;
  const mb = props.marginBottom ?? 24;
  const pt = props.paddingTop ?? 0;
  const pb = props.paddingBottom ?? 0;
  const ps = props.paddingSide ?? 0;
  const sectionStyle = [
    `margin-top:${mt}px`,
    `margin-bottom:${mb}px`,
    props.bgColor && `background:${props.bgColor}`,
    `padding:${pt}px ${ps}px ${pb}px`,
    props.bgColor && `border-radius:4px`,
  ].filter(Boolean).join(";");
  return `<div style="${sectionStyle}">${inner}</div>`;
}

function blogBlocksToHtml(blocks: BlogBlock[], maxWidth?: string): string {
  const body = blocks.map(blogBlockToHtml).join("\n");
  if (!maxWidth) return body;
  return `<div style="max-width:${maxWidth};margin:0 auto;">${body}</div>`;
}

// ─── Blog block preview (center panel) ────────────────────────────────────────

function BlogBlockPreview({ block }: { block: BlogBlock }) {
  const { type, props } = block;
  const ta = props.align as React.CSSProperties["textAlign"];
  const ts: React.CSSProperties = { textAlign: ta, color: props.color, fontSize: props.fontSize };
  const colStyle = (bg?: string): React.CSSProperties => ({ background: bg ?? "#f0f7f3", borderRadius: 6, padding: 8, fontSize: 13, minHeight: 40 });

  switch (type) {
    case "heading":
      return props.level === "h1" ? <h1 style={{ ...ts, margin: 0 }}>{props.content || "Heading"}</h1>
           : props.level === "h3" ? <h3 style={{ ...ts, margin: 0 }}>{props.content || "Heading"}</h3>
           :                        <h2 style={{ ...ts, margin: 0 }}>{props.content || "Heading"}</h2>;
    case "paragraph":
      return <p style={{ ...ts, lineHeight: 1.7, margin: 0 }}>{props.content || "Paragraph text…"}</p>;
    case "image":
      return props.src
        ? <div style={{ textAlign: ta }}><img src={props.src} alt={props.alt ?? ""} style={{ maxWidth: props.imgWidth ?? "100%", height: "auto" }} />{props.caption && <p style={{ textAlign: "center", color: "#666", fontSize: 13, marginTop: 4 }}>{props.caption}</p>}</div>
        : <div className="flex h-14 items-center justify-center rounded border-2 border-dashed text-sm text-muted-foreground"><Image className="mr-2 h-4 w-4" />Set image URL in settings</div>;
    case "video":
      return <div className="flex h-14 items-center justify-center rounded border-2 border-dashed text-sm text-muted-foreground"><Video className="mr-2 h-4 w-4" />{props.videoUrl || "Set video URL in settings"}</div>;
    case "quote":
      return <blockquote style={{ borderLeft: "4px solid #2f6848", padding: "0.75em 1em", margin: 0, background: "#f0f7f3", borderRadius: "0 8px 8px 0" }}><p style={{ margin: 0, fontStyle: "italic", color: props.color }}>{props.content || "Quote text…"}</p>{props.author && <cite style={{ display: "block", marginTop: 4, fontSize: 13, color: "#666" }}>— {props.author}</cite>}</blockquote>;
    case "code":
      return <pre style={{ background: "#1a1a2e", color: "#e0e0e0", padding: "0.75em 1em", borderRadius: 8, margin: 0, fontSize: 13, overflowX: "auto" }}><code>{props.content || "// code here"}</code></pre>;
    case "button":
      return <div style={{ textAlign: ta ?? "center" }}><span style={{ display: "inline-block", padding: "10px 24px", background: props.buttonBgColor ?? "#2f6848", color: props.buttonColor ?? "#fff", borderRadius: 6, fontWeight: 600, fontSize: 15 }}>{props.buttonText || "Click Here"}</span></div>;
    case "columns":
      return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: props.colGap ?? 12 }}><div style={colStyle()}>{props.col1 || "Column 1"}</div><div style={colStyle()}>{props.col2 || "Column 2"}</div></div>;
    case "columns3":
      return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: props.colGap ?? 10 }}>{[props.col1||"Col 1", props.col2||"Col 2", props.col3||"Col 3"].map((c,i) => <div key={i} style={colStyle()}>{c}</div>)}</div>;
    case "columns4":
      return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: props.colGap ?? 8 }}>{[props.col1||"Col 1", props.col2||"Col 2", props.col3||"Col 3", props.col4||"Col 4"].map((c,i) => <div key={i} style={colStyle()} className="text-[11px]">{c}</div>)}</div>;
    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: `${props.padTop ?? 4}px 0 ${props.padBottom ?? 4}px` }} />;
    case "spacer":
      return <div style={{ height: props.height ?? 40, background: "repeating-linear-gradient(45deg,transparent,transparent 4px,#f0f0f0 4px,#f0f0f0 8px)", borderRadius: 4 }} />;
    default: return null;
  }
}

// ─── Blog block settings (right panel) ────────────────────────────────────────

function BlogBlockSettings({ block, onChange }: { block: BlogBlock; onChange: (props: Partial<BlogBlockProps>) => void }) {
  const p = block.props;
  const lbl = (t: string) => <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t}</span>;
  const ic = "h-7 text-xs";

  const alignButtons = (val: string | undefined) => (
    <div className="flex gap-1">
      {(["left", "center", "right"] as const).map((a) => (
        <Button key={a} size="icon" variant="outline" className={cn("h-7 w-7", val === a && "border-primary bg-primary/10")} onClick={() => onChange({ align: a })}>
          {a === "left" ? <AlignLeft className="h-3.5 w-3.5" /> : a === "center" ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}
        </Button>
      ))}
    </div>
  );
  const colorPicker = (label: string, key: keyof BlogBlockProps, fallback: string) => (
    <div>{lbl(label)}<div className="flex gap-1"><input type="color" value={String(p[key] ?? fallback)} onChange={(e) => onChange({ [key]: e.target.value } as Partial<BlogBlockProps>)} className="h-7 w-8 cursor-pointer rounded border p-0.5" /><Input className={ic} value={String(p[key] ?? "")} onChange={(e) => onChange({ [key]: e.target.value } as Partial<BlogBlockProps>)} /></div></div>
  );

  // Section spacing — shown at bottom of every block
  const sectionControls = (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Section</div>
      <div className="grid grid-cols-2 gap-1">
        <div>{lbl("Margin top")}<Input className={ic} type="number" value={p.marginTop ?? 0} onChange={(e) => onChange({ marginTop: +e.target.value || 0 })} /></div>
        <div>{lbl("Margin btm")}<Input className={ic} type="number" value={p.marginBottom ?? 24} onChange={(e) => onChange({ marginBottom: +e.target.value || 0 })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div>{lbl("Pad top")}<Input className={ic} type="number" value={p.paddingTop ?? 0} onChange={(e) => onChange({ paddingTop: +e.target.value || 0 })} /></div>
        <div>{lbl("Pad bottom")}<Input className={ic} type="number" value={p.paddingBottom ?? 0} onChange={(e) => onChange({ paddingBottom: +e.target.value || 0 })} /></div>
      </div>
      <div>{lbl("Pad sides")}<Input className={ic} type="number" value={p.paddingSide ?? 0} onChange={(e) => onChange({ paddingSide: +e.target.value || 0 })} /></div>
      <div>{lbl("Background")}<div className="flex gap-1"><input type="color" value={p.bgColor ?? "#ffffff"} onChange={(e) => onChange({ bgColor: e.target.value })} className="h-7 w-8 cursor-pointer rounded border p-0.5" /><Input className={ic} value={p.bgColor ?? ""} onChange={(e) => onChange({ bgColor: e.target.value || undefined })} placeholder="none" /></div></div>
    </div>
  );

  return (
    <div className="space-y-3 text-xs">
      {block.type === "heading" && <>
        <div>{lbl("Level")}<Select value={p.level ?? "h2"} onValueChange={(v) => onChange({ level: v as "h1"|"h2"|"h3" })}><SelectTrigger className={ic}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="h1">H1 — Page title</SelectItem><SelectItem value="h2">H2 — Section</SelectItem><SelectItem value="h3">H3 — Sub-section</SelectItem></SelectContent></Select></div>
        <div>{lbl("Text")}<Textarea className="min-h-[60px] resize-none text-xs" value={p.content ?? ""} onChange={(e) => onChange({ content: e.target.value })} /></div>
        <div>{lbl("Font size (px)")}<Input className={ic} type="number" value={p.fontSize ?? 28} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })} /></div>
        {colorPicker("Color", "color", "#0f1f1a")}
        <div>{lbl("Align")}{alignButtons(p.align)}</div>
      </>}
      {block.type === "paragraph" && <>
        <div>{lbl("Text")}<Textarea className="min-h-[100px] resize-none text-xs" value={p.content ?? ""} onChange={(e) => onChange({ content: e.target.value })} /></div>
        <div>{lbl("Font size (px)")}<Input className={ic} type="number" value={p.fontSize ?? 16} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })} /></div>
        {colorPicker("Color", "color", "#333333")}
        <div>{lbl("Align")}{alignButtons(p.align)}</div>
      </>}
      {block.type === "image" && <>
        <div>{lbl("Image URL")}<Input className={ic} value={p.src ?? ""} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://…" /></div>
        <div>{lbl("Alt text")}<Input className={ic} value={p.alt ?? ""} onChange={(e) => onChange({ alt: e.target.value })} /></div>
        <div>{lbl("Caption")}<Input className={ic} value={p.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} /></div>
        <div>{lbl("Link URL")}<Input className={ic} value={p.linkUrl ?? ""} onChange={(e) => onChange({ linkUrl: e.target.value })} placeholder="https://…" /></div>
        <div>{lbl("Width (px or %)")}<Input className={ic} value={p.imgWidth ?? "100%"} onChange={(e) => onChange({ imgWidth: e.target.value })} placeholder="100%" /></div>
        <div>{lbl("Align")}{alignButtons(p.align)}</div>
      </>}
      {block.type === "video" && <>
        <div>{lbl("Embed URL")}<Input className={ic} value={p.videoUrl ?? ""} onChange={(e) => onChange({ videoUrl: e.target.value })} placeholder="https://www.youtube.com/embed/…" /></div>
        <p className="text-[11px] text-muted-foreground">Paste a YouTube or Vimeo embed URL.</p>
      </>}
      {block.type === "quote" && <>
        <div>{lbl("Quote text")}<Textarea className="min-h-[80px] resize-none text-xs" value={p.content ?? ""} onChange={(e) => onChange({ content: e.target.value })} /></div>
        <div>{lbl("Author")}<Input className={ic} value={p.author ?? ""} onChange={(e) => onChange({ author: e.target.value })} placeholder="Author name" /></div>
      </>}
      {block.type === "code" && <>
        <div>{lbl("Code")}<Textarea className="min-h-[120px] resize-none font-mono text-xs" value={p.content ?? ""} onChange={(e) => onChange({ content: e.target.value })} /></div>
        <div>{lbl("Language")}<Input className={ic} value={p.language ?? "javascript"} onChange={(e) => onChange({ language: e.target.value })} placeholder="javascript" /></div>
      </>}
      {block.type === "button" && <>
        <div>{lbl("Button text")}<Input className={ic} value={p.buttonText ?? ""} onChange={(e) => onChange({ buttonText: e.target.value })} /></div>
        <div>{lbl("URL")}<Input className={ic} value={p.buttonUrl ?? ""} onChange={(e) => onChange({ buttonUrl: e.target.value })} placeholder="https://…" /></div>
        {colorPicker("Button color", "buttonBgColor", "#2f6848")}
        {colorPicker("Text color", "buttonColor", "#ffffff")}
        <div>{lbl("Align")}{alignButtons(p.align)}</div>
      </>}
      {(block.type === "columns" || block.type === "columns3" || block.type === "columns4") && <>
        <div>{lbl("Column gap (px)")}<Input className={ic} type="number" value={p.colGap ?? (block.type === "columns4" ? 16 : block.type === "columns3" ? 20 : 24)} onChange={(e) => onChange({ colGap: parseInt(e.target.value) })} /></div>
        <div>{lbl("Column 1")}<Textarea className="min-h-[60px] resize-none text-xs" value={p.col1 ?? ""} onChange={(e) => onChange({ col1: e.target.value })} placeholder="Column 1 content…" /></div>
        <div>{lbl("Column 2")}<Textarea className="min-h-[60px] resize-none text-xs" value={p.col2 ?? ""} onChange={(e) => onChange({ col2: e.target.value })} placeholder="Column 2 content…" /></div>
        {(block.type === "columns3" || block.type === "columns4") && <div>{lbl("Column 3")}<Textarea className="min-h-[60px] resize-none text-xs" value={p.col3 ?? ""} onChange={(e) => onChange({ col3: e.target.value })} placeholder="Column 3 content…" /></div>}
        {block.type === "columns4" && <div>{lbl("Column 4")}<Textarea className="min-h-[60px] resize-none text-xs" value={p.col4 ?? ""} onChange={(e) => onChange({ col4: e.target.value })} placeholder="Column 4 content…" /></div>}
      </>}
      {block.type === "divider" && <>
        <div>{lbl("Space above (px)")}<Input className={ic} type="number" value={p.padTop ?? 16} onChange={(e) => onChange({ padTop: parseInt(e.target.value) })} /></div>
        <div>{lbl("Space below (px)")}<Input className={ic} type="number" value={p.padBottom ?? 16} onChange={(e) => onChange({ padBottom: parseInt(e.target.value) })} /></div>
      </>}
      {block.type === "spacer" && <>
        <div>{lbl("Height (px)")}<Input className={ic} type="number" value={p.height ?? 40} onChange={(e) => onChange({ height: parseInt(e.target.value) })} /></div>
      </>}
      {sectionControls}
    </div>
  );
}

const EMPTY_FORM = {
  title: "", slug: "", excerpt: "", featured_image_url: "",
  video_url: "", tags: "", categories: "", author_id: "Jeremy Waters",
  status: "draft" as ContentStatus,
  publish_date: "", publish_hour: "08", publish_minute: "00", publish_ampm: "AM",
  meta_title: "", meta_description: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function csvToArray(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

async function apiCall(method: string, body: Record<string, unknown>) {
  const db = getSupabaseBrowserClient();
  const token = (await db?.auth.getSession())?.data.session?.access_token;
  const res = await fetch("/api/admin/content", {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error ?? "Request failed"));
  return json;
}

async function fetchPosts(): Promise<ContentItem[]> {
  const db = getSupabaseBrowserClient();
  const token = (await db?.auth.getSession())?.data.session?.access_token;
  const res = await fetch("/api/admin/content?type=blog_post", {
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json().catch(() => ({ items: [] })) as { items?: ContentItem[] };
  return json.items ?? [];
}

function handleSignOut() {
  const db = getSupabaseBrowserClient();
  db?.auth.signOut().then(() => { window.location.href = "/login"; });
}

// ─── Calendar subcomponent ─────────────────────────────────────────────────────

function CalendarView({ posts, month, onMonth }: { posts: ContentItem[]; month: Date; onMonth: (d: Date) => void }) {
  const year = month.getFullYear(), mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);
  const byDay: Record<number, ContentItem[]> = {};
  posts.forEach((p) => {
    const d = p.published_at ? new Date(p.published_at) : null;
    if (d && d.getFullYear() === year && d.getMonth() === mon) (byDay[d.getDate()] ??= []).push(p);
  });
  const today = new Date();
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onMonth(new Date(year, mon - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onMonth(new Date(year, mon + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, ci) => {
          const isToday = day !== null && today.getDate() === day && today.getMonth() === mon && today.getFullYear() === year;
          const dayPosts = day ? (byDay[day] ?? []) : [];
          return (
            <div key={ci} className={cn("min-h-[80px] bg-card p-1.5", !day && "bg-muted/30")}>
              {day && (
                <>
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[12px]", isToday && "bg-primary text-primary-foreground font-semibold")}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayPosts.slice(0, 2).map((p) => (
                      <div key={p.id} className={cn("truncate rounded px-1 py-0.5 text-[10px] font-medium", STATUS_STYLE[p.status])}>{p.title}</div>
                    ))}
                    {dayPosts.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayPosts.length - 2}</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AdminBlog() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [posts, setPosts] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Navigation
  const [page, setPage] = useState<Page>("list");
  const [editPost, setEditPost] = useState<ContentItem | null>(null);

  // List state
  const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>("all");
  const [view, setView] = useState<ViewMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [calMonth, setCalMonth] = useState(() => new Date());

  // Editor state
  const [editorTab, setEditorTab] = useState<EditorTab>("simple");
  const [blogBlocks, setBlogBlocks] = useState<BlogBlock[]>([]);
  const [selectedBlogBlockId, setSelectedBlogBlockId] = useState<string | null>(null);
  const [blogDragIdx, setBlogDragIdx] = useState<number | null>(null);
  const [blogDropIdx, setBlogDropIdx] = useState<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<string>("full");
  const [htmlContent, setHtmlContent] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [showAdvancedUrl, setShowAdvancedUrl] = useState(false);
  const wysiwygRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
        setAuthState("denied"); return;
      }
      setAuthState("allowed");
      setPosts(await fetchPosts());
      setLoading(false);
    }
    boot();
  }, []);

  const visiblePosts = posts.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const counts = {
    published: posts.filter((p) => p.status === "published").length,
    draft:     posts.filter((p) => p.status === "draft").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    archived:  posts.filter((p) => p.status === "archived").length,
  };

  function buildPublishedAt() {
    if (!form.publish_date) return null;
    let h = parseInt(form.publish_hour, 10);
    const m = parseInt(form.publish_minute, 10);
    if (form.publish_ampm === "PM" && h !== 12) h += 12;
    if (form.publish_ampm === "AM" && h === 12) h = 0;
    return `${form.publish_date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }

  const selectedBlogBlock = blogBlocks.find((b) => b.id === selectedBlogBlockId) ?? null;

  function addBlogBlock(type: BlogBlockType, defaults: BlogBlockProps) {
    const block: BlogBlock = { id: blogUid(), type, props: { ...defaults } };
    setBlogBlocks((prev) => [...prev, block]);
    setSelectedBlogBlockId(block.id);
  }
  function removeBlogBlock(id: string) {
    setBlogBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlogBlockId === id) setSelectedBlogBlockId(null);
  }
  function updateBlogBlockProps(id: string, props: Partial<BlogBlockProps>) {
    setBlogBlocks((prev) => prev.map((b) => b.id === id ? { ...b, props: { ...b.props, ...props } } : b));
  }
  function moveBlogBlock(from: number, to: number) {
    const next = [...blogBlocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBlogBlocks(next);
  }

  function openNew() {
    setEditPost(null);
    setForm(EMPTY_FORM);
    setBlogBlocks([]);
    setSelectedBlogBlockId(null);
    setHtmlContent("");
    setGallery([]);
    setEditorTab("simple");
    setPage("editor");
  }

  function openEdit(post: ContentItem) {
    setEditPost(post);
    const pub = post.published_at ? new Date(post.published_at) : null;
    let h = pub ? pub.getHours() : 8;
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    setForm({
      title: post.title, slug: post.slug ?? "", excerpt: post.excerpt ?? "",
      featured_image_url: post.featured_image_url ?? "", video_url: post.video_url ?? "",
      tags: (post.tags ?? []).join(", "), categories: (post.categories ?? []).join(", "),
      author_id: post.author_id ?? "Jeremy Waters", status: post.status,
      publish_date: pub ? pub.toISOString().slice(0, 10) : "",
      publish_hour: String(h).padStart(2, "0"), publish_minute: pub ? String(pub.getMinutes()).padStart(2, "0") : "00",
      publish_ampm: ampm, meta_title: post.meta_title ?? "", meta_description: post.meta_description ?? "",
    });
    setBlogBlocks([]);
    setSelectedBlogBlockId(null);
    setHtmlContent(post.content);
    setGallery(post.gallery ?? []);
    setEditorTab("html");
    setPage("editor");
  }

  function getContent() {
    if (editorTab === "wysiwyg") return wysiwygRef.current?.innerHTML ?? "";
    if (editorTab === "html") return htmlContent;
    const mw = canvasWidth === "full" ? undefined : canvasWidth === "wide" ? "1200px" : canvasWidth === "article" ? "880px" : "640px";
    return blogBlocksToHtml(blogBlocks, mw);
  }

  async function save(statusOverride?: ContentStatus) {
    if (!form.title.trim()) { alert("Title is required."); return; }
    setSaving(true);
    try {
      const result = await apiCall(editPost ? "PATCH" : "POST", {
        id: editPost?.id, content_type: "blog_post",
        title: form.title, slug: form.slug || slugify(form.title),
        excerpt: form.excerpt || null, featured_image_url: form.featured_image_url || null,
        video_url: form.video_url || null, tags: csvToArray(form.tags),
        categories: csvToArray(form.categories), author_id: form.author_id || null,
        status: statusOverride ?? form.status, published_at: buildPublishedAt(),
        meta_title: form.meta_title || null, meta_description: form.meta_description || null,
        content: getContent(), gallery, hashtags: [],
      }) as { item: ContentItem };
      setPosts((prev) => editPost ? prev.map((p) => p.id === editPost.id ? result.item : p) : [result.item, ...prev]);
      setEditPost(result.item);
      setForm((f) => ({ ...f, status: result.item.status }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function changeStatus(id: string, status: ContentStatus) {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const result = await apiCall("PATCH", {
      ...post, gallery: post.gallery, tags: post.tags, categories: post.categories, hashtags: post.hashtags, status,
    }) as { item: ContentItem };
    setPosts((prev) => prev.map((p) => p.id === id ? result.item : p));
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this blog post permanently?")) return;
    await apiCall("DELETE", { id });
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (editPost?.id === id) { setEditPost(null); setPage("list"); }
  }

  async function emailBlog(post: ContentItem) {
    try {
      await apiCall("POST", {
        content_type: "email_template", source_id: post.id,
        title: `Email: ${post.title}`, subject: post.title, content: post.content,
        status: "draft", tags: post.tags, categories: post.categories, hashtags: [], gallery: [],
      });
      alert("Email template created! Find it in Communications → Email → Templates.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create email template");
    }
  }

  function addGalleryItem() { setGallery([...gallery, { url: "", alt: "", caption: "" }]); }
  function removeGalleryItem(i: number) { setGallery(gallery.filter((_, idx) => idx !== i)); }
  function updateGalleryItem(i: number, patch: Partial<GalleryItem>) {
    setGallery(gallery.map((g, idx) => idx === i ? { ...g, ...patch } : g));
  }

  function doWysiwyg(cmd: string, val?: string) {
    wysiwygRef.current?.focus();
    document.execCommand(cmd, false, val);
  }

  const vicons: Record<ViewMode, React.ElementType> = { cards: LayoutGrid, list: LayoutList, table: Layers, calendar: Calendar };

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">

        {/* ── Sidebar ── */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]">
            <a href="/admin">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
            </a>
          </div>
          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {group.label !== "Main" && (
                  <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
                )}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}>
                      <Icon className="h-4 w-4" />{label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JW</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">Jeremy Waters</div>
                <div className="truncate text-[10px] text-muted-foreground">Owner — Super Admin</div>
              </div>
              <button onClick={handleSignOut} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>

        {/* ── Header ── */}
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            {page === "editor" && (
              <button onClick={() => { setPage("list"); setEditPost(null); }} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <ChevronLeft className="h-3.5 w-3.5" />Back to Blog Posts
              </button>
            )}
            {page === "list" && (
              <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                <span>Super Admin</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">Blog Posts</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                <Link href="/admin/agent"><Bot className="h-3.5 w-3.5 text-primary" />AI Agent</Link>
              </Button>
              <AdminNotificationBell />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="lg:pl-[238px]">
          {authState === "checking" && (
            <div className="flex h-[calc(100vh-48px)] items-center justify-center text-sm text-muted-foreground">
              <Zap className="mr-2 h-4 w-4 animate-pulse text-primary" />Loading…
            </div>
          )}
          {authState === "denied" && (
            <div className="flex h-[calc(100vh-48px)] items-center justify-center p-6">
              <div className="font-semibold text-red-600">Admin access required.</div>
            </div>
          )}

          {/* ══ LIST PAGE ══ */}
          {authState === "allowed" && page === "list" && (
            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Blog Posts</h1>
                  <p className="text-sm text-muted-foreground">Create, schedule, deploy, hide, archive, and convert posts into email templates.</p>
                </div>
                <Button onClick={openNew} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" />New post</Button>
              </div>

              {/* Stats cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Published", value: counts.published, sub: "Live posts",           icon: Send,         s: "published" as ContentStatus },
                  { label: "Drafts",    value: counts.draft,     sub: "Needs review",          icon: BookOpen,     s: "draft"     as ContentStatus },
                  { label: "Scheduled", value: counts.scheduled, sub: "Future publish dates",  icon: CalendarClock, s: "scheduled" as ContentStatus },
                  { label: "Archived",  value: counts.archived,  sub: "Hidden from public",    icon: Archive,      s: "archived"  as ContentStatus },
                ].map(({ label, value, sub, icon: Icon, s }) => (
                  <div key={label} onClick={() => setStatusFilter(s)} className="cursor-pointer rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[12px] text-muted-foreground">{label}</div>
                        <div className="my-1 text-3xl font-bold">{value}</div>
                        <div className="text-[11px] text-muted-foreground">{sub}</div>
                      </div>
                      <Icon className="h-5 w-5 text-muted-foreground/30 mt-1" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {(["all", "draft", "scheduled", "published", "archived"] as const).map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)} className={cn("rounded-full border px-3 py-1 text-[12px] font-medium capitalize transition-all", statusFilter === s ? "border-primary/60 bg-primary/10 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:border-border")}>
                      {s === "all" ? `All (${posts.length})` : `${s} (${posts.filter((p) => p.status === s).length})`}
                    </button>
                  ))}
                </div>
                <Input placeholder="Search posts…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-[180px] text-sm ml-auto" />
                <div className="flex items-center gap-1">
                  {(["cards","list","table","calendar"] as ViewMode[]).map((v) => {
                    const Icon = vicons[v];
                    return (
                      <Button key={v} variant="outline" size="icon" className={cn("h-8 w-8", view === v && "border-primary/60 bg-primary/10")} onClick={() => setView(v)}>
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* ── Cards ── */}
              {view === "cards" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  {visiblePosts.map((post) => (
                    <div key={post.id} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                      <div className="relative h-52 overflow-hidden bg-muted">
                        {post.featured_image_url
                          ? <img src={post.featured_image_url} alt={post.title} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                          : <div className="flex h-full items-center justify-center"><BookOpen className="h-12 w-12 text-muted-foreground/20" /></div>}
                        <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[12px] font-medium text-gray-800 shadow hover:bg-white">View</button>
                          <button className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[12px] font-medium text-gray-800 shadow hover:bg-white"><Share2 className="h-3 w-3" />Share</button>
                        </div>
                        <div className="absolute left-3 top-3">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", STATUS_STYLE[post.status])}>{post.status}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="mb-0.5 text-base font-bold leading-snug">{post.title}</div>
                        <div className="mb-1 text-[12px] text-muted-foreground">
                          {post.slug && <span className="font-mono">{post.slug}</span>}
                          {post.author_id && <span> — {post.author_id}</span>}
                        </div>
                        {post.excerpt && <p className="mb-2 line-clamp-2 text-[13px] text-muted-foreground">{post.excerpt}</p>}
                        {(post.categories?.length ?? 0) > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1">
                            {(post.categories ?? []).map((c) => <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{c}</span>)}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[12px]" onClick={() => openEdit(post)}><Edit2 className="h-3 w-3" />Edit</Button>
                          <Button size="sm" className="h-7 gap-1 text-[12px]" onClick={() => changeStatus(post.id, "published")}><Zap className="h-3 w-3" />Deploy</Button>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[12px]" onClick={() => changeStatus(post.id, "draft")}><EyeOff className="h-3 w-3" />Hide</Button>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[12px]" onClick={() => changeStatus(post.id, "archived")}><Archive className="h-3 w-3" />Archive</Button>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[12px]" onClick={() => emailBlog(post)}><Mail className="h-3 w-3" />Email Blog</Button>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px] text-red-500 hover:text-red-600" onClick={() => deletePost(post.id)}><Trash2 className="h-3 w-3" />Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loading && visiblePosts.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                      <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                      <div className="mb-1 font-medium">No blog posts yet</div>
                      <div className="mb-4 text-sm text-muted-foreground">Write your first post to get started.</div>
                      <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />New post</Button>
                    </div>
                  )}
                </div>
              )}

              {/* ── List ── */}
              {view === "list" && (
                <div className="divide-y rounded-xl border bg-card">
                  {visiblePosts.map((post) => (
                    <div key={post.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-muted">
                        {post.featured_image_url ? <img src={post.featured_image_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="m-auto mt-3.5 h-5 w-5 text-muted-foreground/30" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{post.title}</div>
                        <div className="text-[12px] text-muted-foreground">{(post.categories ?? []).join(", ")} {post.published_at ? `· ${new Date(post.published_at).toLocaleDateString()}` : ""}</div>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[post.status])}>{post.status}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(post)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/70" onClick={() => changeStatus(post.id, "published")}><Zap className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeStatus(post.id, "draft")}><EyeOff className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => emailBlog(post)}><Mail className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deletePost(post.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                  {!loading && visiblePosts.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No posts found.</div>}
                </div>
              )}

              {/* ── Table ── */}
              {view === "table" && (
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {["Title", "Status", "Category", "Tags", "Date", "Actions"].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visiblePosts.map((post) => (
                        <tr key={post.id} className="hover:bg-muted/20">
                          <td className="max-w-[220px] px-4 py-2.5 font-medium truncate">{post.title}</td>
                          <td className="px-4 py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[post.status])}>{post.status}</span></td>
                          <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{(post.categories ?? []).join(", ") || "—"}</td>
                          <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{(post.tags ?? []).join(", ") || "—"}</td>
                          <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                            {(post.published_at ? new Date(post.published_at) : new Date(post.created_at!)).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => openEdit(post)}><Edit2 className="mr-1 h-3 w-3" />Edit</Button>
                              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary" onClick={() => changeStatus(post.id, "published")}><Zap className="mr-1 h-3 w-3" />Deploy</Button>
                              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => changeStatus(post.id, "draft")}><EyeOff className="mr-1 h-3 w-3" />Hide</Button>
                              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => emailBlog(post)}><Mail className="mr-1 h-3 w-3" />Email</Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deletePost(post.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!loading && visiblePosts.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No posts found.</div>}
                </div>
              )}

              {/* ── Calendar ── */}
              {view === "calendar" && <CalendarView posts={visiblePosts} month={calMonth} onMonth={setCalMonth} />}
            </div>
          )}

          {/* ══ EDITOR PAGE ══ */}
          {authState === "allowed" && page === "editor" && (
            <div className="p-5 space-y-5">
              <div>
                <h1 className="text-2xl font-bold">{editPost ? "Edit Blog Post" : "New Blog Post"}</h1>
                <p className="text-sm text-muted-foreground">Create a public post and optionally convert it into an email template or social media cards.</p>
              </div>

              {/* Core fields */}
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 text-sm font-semibold">Create post</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: f.slug || slugify(e.target.value) }))} placeholder="Post title" className="h-9" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Slug</p>
                    <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} placeholder="post-url-slug" className="h-9 font-mono text-sm" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Author</p>
                    <Input value={form.author_id} onChange={(e) => setForm((f) => ({ ...f, author_id: e.target.value }))} className="h-9" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Publish Date</p>
                    <div className="flex items-center gap-1">
                      <Input type="date" value={form.publish_date} onChange={(e) => setForm((f) => ({ ...f, publish_date: e.target.value }))} className="h-9 flex-1 text-sm" />
                      <Select value={form.publish_hour} onValueChange={(v) => setForm((f) => ({ ...f, publish_hour: v }))}>
                        <SelectTrigger className="h-9 w-16 text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={form.publish_minute} onValueChange={(v) => setForm((f) => ({ ...f, publish_minute: v }))}>
                        <SelectTrigger className="h-9 w-16 text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{["00","15","30","45"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={form.publish_ampm} onValueChange={(v) => setForm((f) => ({ ...f, publish_ampm: v }))}>
                        <SelectTrigger className="h-9 w-16 text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                    <Input value={form.categories} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))} placeholder="Announcements, Tips, News…" className="h-9" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ContentStatus }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                    <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="banners, vinyl, signage…" className="h-9" />
                  </div>
                </div>
              </div>

              {/* Media */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2"><Image className="h-4 w-4 text-primary/70" /><span className="text-sm font-semibold">Featured image</span></div>
                  <p className="mb-2 text-[12px] text-primary">Upload the main image for this post.</p>
                  <Input placeholder="https://…" value={form.featured_image_url} onChange={(e) => setForm((f) => ({ ...f, featured_image_url: e.target.value }))} className="h-7 text-xs mb-2" />
                  {form.featured_image_url && <img src={form.featured_image_url} alt="preview" className="mb-2 h-24 w-full rounded object-cover" />}
                  <Button variant="outline" size="sm" className="h-7 w-full gap-1 text-xs"><Image className="h-3.5 w-3.5" />Choose file</Button>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Image className="h-4 w-4 text-primary/70" /><span className="text-sm font-semibold">Image gallery</span></div>
                    <button onClick={addGalleryItem} className="rounded p-0.5 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="mb-2 text-[12px] text-primary">Upload one or more gallery images.</p>
                  {gallery.map((g, gi) => (
                    <div key={gi} className="mb-1 flex items-center gap-1">
                      <Input placeholder="URL" value={g.url} onChange={(e) => updateGalleryItem(gi, { url: e.target.value })} className="h-6 text-[11px]" />
                      <button onClick={() => removeGalleryItem(gi)} className="shrink-0 rounded p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="mt-2 h-7 w-full gap-1 text-xs"><Image className="h-3.5 w-3.5" />Choose file</Button>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2"><Video className="h-4 w-4 text-primary/70" /><span className="text-sm font-semibold">Video</span></div>
                  <p className="mb-2 text-[12px] text-primary">Upload a video file for this post.</p>
                  <Input placeholder="https://youtube.com/embed/…" value={form.video_url} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} className="h-7 text-xs mb-2" />
                  <Button variant="outline" size="sm" className="h-7 w-full gap-1 text-xs"><Video className="h-3.5 w-3.5" />Choose file</Button>
                </div>
              </div>

              {/* Advanced URL fallbacks */}
              <button onClick={() => setShowAdvancedUrl(!showAdvancedUrl)} className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                <span>Advanced URL fallbacks</span>
                {showAdvancedUrl ? <ChevronLeft className="h-4 w-4 rotate-90" /> : <ChevronLeft className="h-4 w-4 -rotate-90" />}
              </button>
              {showAdvancedUrl && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Meta Title</p>
                    <Input value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} placeholder="SEO page title" className="h-8" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Meta Description</p>
                    <Textarea value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} placeholder="SEO description" className="min-h-[60px] resize-none text-sm" />
                  </div>
                </div>
              )}

              {/* Excerpt */}
              <div>
                <p className="mb-1.5 text-sm font-semibold">Excerpt</p>
                <Textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary shown in post listings…" className="min-h-[80px] resize-none" />
              </div>

              {/* Content editor */}
              <div>
                <div className="mb-2">
                  <div className="text-sm font-semibold">Post content editor</div>
                  <div className="text-[12px] text-muted-foreground">Use Simple Builder for styled blocks, Advanced HTML for full control, or WYSIWYG for direct editing.</div>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  {(["simple", "html", "wysiwyg"] as EditorTab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        if (t === "html" && editorTab === "simple") { const mw = canvasWidth === "full" ? undefined : canvasWidth === "wide" ? "1200px" : canvasWidth === "article" ? "880px" : "640px"; setHtmlContent(blogBlocksToHtml(blogBlocks, mw)); }
                        if (t === "wysiwyg" && wysiwygRef.current) { const mw = canvasWidth === "full" ? undefined : canvasWidth === "wide" ? "1200px" : canvasWidth === "article" ? "880px" : "640px"; wysiwygRef.current.innerHTML = editorTab === "simple" ? blogBlocksToHtml(blogBlocks, mw) : htmlContent; }
                        setEditorTab(t);
                      }}
                      className={cn(
                        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                        editorTab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t === "simple" ? "Block Builder" : t === "html" ? "Advanced HTML" : "WYSIWYG"}
                    </button>
                  ))}
                </div>

                {/* Block Builder (Simple) */}
                {editorTab === "simple" && (
                  <div className="overflow-hidden rounded-xl border">
                    {/* Toolbar: canvas width selector */}
                    <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Canvas width</span>
                      <div className="flex gap-1">
                        {([
                          { id: "full", label: "Full" },
                          { id: "wide", label: "Wide (1200)" },
                          { id: "article", label: "Article (880)" },
                          { id: "narrow", label: "Narrow (640)" },
                        ] as const).map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => setCanvasWidth(id)}
                            className={cn("rounded px-2 py-0.5 text-[11px] font-medium transition-colors", canvasWidth === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
                          >{label}</button>
                        ))}
                      </div>
                      <span className="ml-auto text-[10px] text-muted-foreground">{blogBlocks.length} block{blogBlocks.length !== 1 ? "s" : ""}</span>
                    </div>

                    <div className="flex h-[680px]">
                      {/* Left: block library */}
                      <div className="w-44 shrink-0 overflow-y-auto border-r bg-muted/20 p-2">
                        <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Blocks</div>
                        <div className="space-y-1">
                          {BLOG_BLOCK_DEFS.map(({ type, label, icon: Icon, defaults }) => (
                            <button
                              key={type}
                              onClick={() => addBlogBlock(type, defaults)}
                              className="flex w-full items-center gap-2 rounded-lg border border-transparent bg-card px-2 py-2 text-[12px] font-medium transition-colors hover:border-primary/30 hover:bg-accent"
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Center: canvas */}
                      <div className="flex-1 overflow-y-auto bg-white dark:bg-background">
                        <div className={cn("min-h-full p-6", canvasWidth !== "full" && "flex justify-center")}>
                          <div className={cn("w-full", canvasWidth === "wide" && "max-w-[1200px]", canvasWidth === "article" && "max-w-[880px]", canvasWidth === "narrow" && "max-w-[640px]")}>
                            {blogBlocks.length === 0 ? (
                              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
                                <Type className="h-10 w-10 opacity-20" />
                                <div className="text-center">
                                  <div className="text-sm font-medium">Start building your post</div>
                                  <div className="text-xs">Click blocks on the left to add them.</div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {blogBlocks.map((block, idx) => (
                                  <div
                                    key={block.id}
                                    draggable
                                    onDragStart={() => setBlogDragIdx(idx)}
                                    onDragOver={(e) => { e.preventDefault(); setBlogDropIdx(idx); }}
                                    onDrop={() => {
                                      if (blogDragIdx !== null && blogDragIdx !== idx) moveBlogBlock(blogDragIdx, idx);
                                      setBlogDragIdx(null); setBlogDropIdx(null);
                                    }}
                                    onDragEnd={() => { setBlogDragIdx(null); setBlogDropIdx(null); }}
                                    onClick={() => setSelectedBlogBlockId(block.id)}
                                    className={cn(
                                      "group relative cursor-pointer rounded-lg border-2 p-3 transition-colors",
                                      selectedBlogBlockId === block.id ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/30",
                                      blogDropIdx === idx && blogDragIdx !== null && "border-primary/60 bg-primary/10",
                                    )}
                                  >
                                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeBlogBlock(block.id); }}
                                      className="absolute right-1 top-1 rounded p-0.5 opacity-0 hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                    <BlogBlockPreview block={block} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: settings */}
                      <div className="w-64 shrink-0 overflow-y-auto border-l bg-muted/10 p-3">
                        {selectedBlogBlock ? (
                          <>
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground capitalize">{selectedBlogBlock.type.replace(/(\d)/, " $1")}</span>
                              <button onClick={() => setSelectedBlogBlockId(null)} className="rounded p-0.5 hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                            </div>
                            <BlogBlockSettings block={selectedBlogBlock} onChange={(props) => updateBlogBlockProps(selectedBlogBlock.id, props)} />
                          </>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Layers className="h-8 w-8 opacity-20" />
                            <div className="text-center text-[11px]">Select a block to edit its settings</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Advanced HTML */}
                {editorTab === "html" && (
                  <div className="overflow-hidden rounded-xl border">
                    <Textarea
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      className="min-h-[400px] resize-none rounded-xl border-0 font-mono text-[13px] leading-relaxed focus-visible:ring-0"
                      placeholder="<p>Write raw HTML here…</p>"
                    />
                  </div>
                )}

                {/* WYSIWYG */}
                {editorTab === "wysiwyg" && (
                  <div className="overflow-hidden rounded-xl border">
                    <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
                      {[["Bold","bold"],["Italic","italic"],["Underline","underline"]].map(([l, c]) => (
                        <button key={c} onMouseDown={(e) => { e.preventDefault(); doWysiwyg(c); }} className="rounded border bg-muted px-2 py-1 text-[12px] font-medium hover:bg-accent">{l}</button>
                      ))}
                      {[["Left","justifyLeft"],["Center","justifyCenter"],["Right","justifyRight"]].map(([l, c]) => (
                        <button key={c} onMouseDown={(e) => { e.preventDefault(); doWysiwyg(c); }} className="rounded border bg-muted px-2 py-1 text-[12px] hover:bg-accent">{l}</button>
                      ))}
                      {[["H2","<h2>"],["H3","<h3>"],["P","<p>"]].map(([l, v]) => (
                        <button key={l} onMouseDown={(e) => { e.preventDefault(); doWysiwyg("formatBlock", v); }} className="rounded border bg-muted px-2 py-1 text-[12px] hover:bg-accent">{l}</button>
                      ))}
                      <button onMouseDown={(e) => { e.preventDefault(); doWysiwyg("insertUnorderedList"); }} className="rounded border bg-muted px-2 py-1 text-[12px] hover:bg-accent">List</button>
                      <button onMouseDown={(e) => { e.preventDefault(); doWysiwyg("insertHorizontalRule"); }} className="rounded border bg-muted px-2 py-1 text-[12px] hover:bg-accent">Divider</button>
                      <button onMouseDown={(e) => { e.preventDefault(); const u = window.prompt("Link URL:"); if (u) doWysiwyg("createLink", u); }} className="rounded border bg-muted px-2 py-1 text-[12px] hover:bg-accent">Link</button>
                    </div>
                    <div ref={wysiwygRef} contentEditable suppressContentEditableWarning className="min-h-[320px] p-4 text-sm leading-relaxed focus:outline-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                <Button disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save Draft"}</Button>
                <Button variant="outline" disabled={saving} onClick={() => save("scheduled")}><CalendarClock className="mr-2 h-4 w-4" />Schedule</Button>
                <Button variant="outline" disabled={saving} className="border-primary/40 text-primary" onClick={() => save("published")}><Zap className="mr-2 h-4 w-4" />Deploy</Button>
                {editPost && (
                  <>
                    <Button variant="outline" onClick={() => emailBlog(editPost)}><Mail className="mr-2 h-4 w-4" />Email Blog</Button>
                    <Button variant="outline" onClick={() => changeStatus(editPost.id, "archived")}><Archive className="mr-2 h-4 w-4" />Archive</Button>
                    <Button variant="ghost" className="ml-auto text-red-500 hover:text-red-600" onClick={() => deletePost(editPost.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                  </>
                )}
              </div>

              {/* AI Agent link */}
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                <Bot className="h-5 w-5 shrink-0 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Write with AI Agent</div>
                  <div className="text-[12px] text-muted-foreground">Use the AI Agent to generate content, suggest titles, and optimize for SEO.</div>
                </div>
                <Button size="sm" variant="outline" asChild><Link href="/admin/agent" target="_blank">Open Agent</Link></Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
