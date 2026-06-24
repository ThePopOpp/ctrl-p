"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlignLeft, Archive, ArrowRight, Bot, BookOpen, Calendar,
  ChevronLeft, ChevronRight, Edit2, Facebook,
  GripVertical, Image, Instagram, Layers, LayoutGrid,
  LayoutList, Linkedin, List, LogOut, Mail, Minus, Moon,
  Pin, Plus, Send, Sun, Trash2, Type, Video, X, Zap,
} from "lucide-react";

import { getCurrentAdminProfile } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AdminUser, ContentItem, ContentStatus, ContentType, GalleryItem } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ─────────────────────────────────────────────────────────────────────

type BlockType = "p" | "h1" | "h2" | "h3" | "img" | "video" | "quote" | "list" | "hr";
type ContentBlock = { id: string; type: BlockType; content: string; alt?: string; caption?: string };

type ViewMode = "cards" | "list" | "table" | "calendar";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<ContentType, { label: string; color: string; icon: React.ElementType }> = {
  blog_post:          { label: "Blog Post",   color: "bg-blue-500/15 text-blue-700 dark:text-blue-300",    icon: BookOpen },
  email_template:     { label: "Email",        color: "bg-purple-500/15 text-purple-700 dark:text-purple-300", icon: Mail },
  social_facebook:    { label: "Facebook",     color: "bg-sky-500/15 text-sky-700 dark:text-sky-300",       icon: Facebook },
  social_linkedin:    { label: "LinkedIn",     color: "bg-blue-600/15 text-blue-800 dark:text-blue-200",    icon: Linkedin },
  social_instagram:   { label: "Instagram",    color: "bg-pink-500/15 text-pink-700 dark:text-pink-300",    icon: Instagram },
  social_pinterest:   { label: "Pinterest",    color: "bg-red-500/15 text-red-700 dark:text-red-300",       icon: Pin },
};

const STATUS_META: Record<ContentStatus, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  published: { label: "Published", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  archived:  { label: "Archived",  color: "bg-muted/60 text-muted-foreground" },
};

const SOCIAL_CHAR_LIMIT: Partial<Record<ContentType, number>> = {
  social_facebook: 500,
  social_linkedin: 700,
  social_instagram: 2200,
  social_pinterest: 500,
};

const CONVERT_OPTIONS: ContentType[] = [
  "email_template", "social_facebook", "social_linkedin", "social_instagram", "social_pinterest",
];

const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ElementType }[] = [
  { type: "p",     label: "Paragraph",   icon: AlignLeft },
  { type: "h1",    label: "Heading 1",   icon: Type },
  { type: "h2",    label: "Heading 2",   icon: Type },
  { type: "h3",    label: "Heading 3",   icon: Type },
  { type: "img",   label: "Image",       icon: Image },
  { type: "video", label: "Video Embed", icon: Video },
  { type: "quote", label: "Quote",       icon: List },
  { type: "list",  label: "Bullet List", icon: LayoutList },
  { type: "hr",    label: "Divider",     icon: Minus },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function csvToArray(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function blocksToHtml(blocks: ContentBlock[]) {
  return blocks.map((b) => {
    switch (b.type) {
      case "h1": return `<h1>${b.content}</h1>`;
      case "h2": return `<h2>${b.content}</h2>`;
      case "h3": return `<h3>${b.content}</h3>`;
      case "img": return `<figure><img src="${b.content}" alt="${b.alt || ""}" />${b.caption ? `<figcaption>${b.caption}</figcaption>` : ""}</figure>`;
      case "video": return `<div class="video-embed"><iframe src="${b.content}" frameborder="0" allowfullscreen></iframe>${b.caption ? `<p>${b.caption}</p>` : ""}</div>`;
      case "quote": return `<blockquote>${b.content}</blockquote>`;
      case "list": return `<ul>${b.content.split("\n").filter(Boolean).map((i) => `<li>${i}</li>`).join("")}</ul>`;
      case "hr": return `<hr />`;
      default: return `<p>${b.content}</p>`;
    }
  }).join("\n");
}

function htmlToBlocks(html: string): ContentBlock[] {
  if (!html.trim()) return [{ id: uid(), type: "p", content: "" }];
  if (typeof window === "undefined") return [{ id: uid(), type: "p", content: html }];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: ContentBlock[] = [];
  doc.body.childNodes.forEach((node) => {
    const el = node as Element;
    const tag = el.tagName?.toLowerCase();
    const id = uid();
    if (tag === "h1") blocks.push({ id, type: "h1", content: el.textContent || "" });
    else if (tag === "h2") blocks.push({ id, type: "h2", content: el.textContent || "" });
    else if (tag === "h3") blocks.push({ id, type: "h3", content: el.textContent || "" });
    else if (tag === "blockquote") blocks.push({ id, type: "quote", content: el.textContent || "" });
    else if (tag === "hr") blocks.push({ id, type: "hr", content: "" });
    else if (tag === "figure") {
      const img = el.querySelector("img");
      const cap = el.querySelector("figcaption");
      if (img) blocks.push({ id, type: "img", content: img.getAttribute("src") || "", alt: img.getAttribute("alt") || "", caption: cap?.textContent || "" });
    } else if (tag === "ul" || tag === "ol") {
      const items = Array.from(el.querySelectorAll("li")).map((li) => li.textContent || "");
      blocks.push({ id, type: "list", content: items.join("\n") });
    } else if (el.textContent?.trim()) {
      blocks.push({ id, type: "p", content: el.textContent.trim() });
    }
  });
  return blocks.length ? blocks : [{ id: uid(), type: "p", content: "" }];
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
  if (!res.ok) throw new Error(String(json.error || "Request failed"));
  return json;
}

async function fetchItems(type = "all", status = "all"): Promise<ContentItem[]> {
  const db = getSupabaseBrowserClient();
  const token = (await db?.auth.getSession())?.data.session?.access_token;
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (status !== "all") params.set("status", status);
  const res = await fetch(`/api/admin/content?${params}`, {
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json().catch(() => ({ items: [] })) as { items?: ContentItem[] };
  return (json.items ?? []) as ContentItem[];
}

function handleSignOut() {
  const db = getSupabaseBrowserClient();
  db?.auth.signOut().then(() => { window.location.href = "/login"; });
}

// ─── Block Editor ──────────────────────────────────────────────────────────────

function BlockEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (b: ContentBlock[]) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function update(id: string, patch: Partial<ContentBlock>) {
    onChange(blocks.map((b) => b.id === id ? { ...b, ...patch } : b));
  }
  function remove(id: string) { onChange(blocks.filter((b) => b.id !== id)); }
  function addBlock(type: BlockType) {
    onChange([...blocks, { id: uid(), type, content: "" }]);
    setAddOpen(false);
  }
  function drop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) return;
    const next = [...blocks];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
    setDragIdx(null);
    setDropIdx(null);
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <div
          key={block.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => { e.preventDefault(); setDropIdx(i); }}
          onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
          onDrop={() => drop(i)}
          className={cn(
            "group flex gap-2 rounded-lg border bg-card/50 p-2 transition-all",
            dropIdx === i && dragIdx !== i && "border-primary/60 bg-primary/5",
          )}
        >
          <div className="flex flex-col gap-1 pt-1">
            <button type="button" className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing">
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-1.5">
            {block.type === "hr" ? (
              <div className="my-2 border-t border-border" />
            ) : block.type === "img" ? (
              <div className="space-y-1.5">
                <Input placeholder="Image URL" value={block.content} onChange={(e) => update(block.id, { content: e.target.value })} className="text-sm" />
                <div className="flex gap-2">
                  <Input placeholder="Alt text" value={block.alt || ""} onChange={(e) => update(block.id, { alt: e.target.value })} className="text-xs" />
                  <Input placeholder="Caption (optional)" value={block.caption || ""} onChange={(e) => update(block.id, { caption: e.target.value })} className="text-xs" />
                </div>
                {block.content && <img src={block.content} alt={block.alt} className="mt-1 max-h-[120px] rounded object-cover" />}
              </div>
            ) : block.type === "video" ? (
              <div className="space-y-1.5">
                <Input placeholder="Video embed URL (YouTube, Vimeo, etc.)" value={block.content} onChange={(e) => update(block.id, { content: e.target.value })} className="text-sm" />
                <Input placeholder="Caption (optional)" value={block.caption || ""} onChange={(e) => update(block.id, { caption: e.target.value })} className="text-xs" />
              </div>
            ) : block.type === "list" ? (
              <Textarea
                placeholder="One item per line"
                value={block.content}
                onChange={(e) => update(block.id, { content: e.target.value })}
                className={cn("min-h-[80px] resize-none text-sm")}
              />
            ) : (
              <Textarea
                placeholder={block.type === "quote" ? "Quote text…" : block.type === "h1" ? "Heading 1…" : block.type === "h2" ? "Heading 2…" : block.type === "h3" ? "Heading 3…" : "Paragraph text…"}
                value={block.content}
                onChange={(e) => update(block.id, { content: e.target.value })}
                className={cn(
                  "min-h-[52px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0",
                  block.type === "h1" && "text-2xl font-bold",
                  block.type === "h2" && "text-xl font-semibold",
                  block.type === "h3" && "text-lg font-medium",
                  block.type === "quote" && "border-l-2 border-primary/40 pl-3 italic",
                )}
              />
            )}
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">{block.type}</span>
            <button type="button" onClick={() => remove(block.id)} className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-red-500 group-hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Add block */}
      <div className="relative">
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setAddOpen(!addOpen)}>
          <Plus className="h-3.5 w-3.5" /> Add block
        </Button>
        {addOpen && (
          <div className="absolute left-0 top-8 z-10 w-52 rounded-lg border bg-card shadow-lg">
            {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
              <button key={type} type="button" onClick={() => addBlock(type)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-accent">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ items, month, onMonth }: { items: ContentItem[]; month: Date; onMonth: (d: Date) => void }) {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);
  const byDay: Record<number, ContentItem[]> = {};
  items.forEach((item) => {
    const d = item.published_at ? new Date(item.published_at) : null;
    if (d && d.getFullYear() === year && d.getMonth() === mon) {
      const day = d.getDate();
      (byDay[day] ??= []).push(item);
    }
  });
  const today = new Date();

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onMonth(new Date(year, mon - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onMonth(new Date(year, mon + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, ci) => {
          const isToday = day !== null && today.getDate() === day && today.getMonth() === mon && today.getFullYear() === year;
          const dayItems = day ? (byDay[day] ?? []) : [];
          return (
            <div key={ci} className={cn("min-h-[80px] bg-card p-1.5", !day && "bg-muted/30")}>
              {day && (
                <>
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[12px]", isToday && "bg-primary text-primary-foreground font-semibold")}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => {
                      const meta = TYPE_META[item.content_type];
                      return (
                        <div key={item.id} className={cn("truncate rounded px-1 py-0.5 text-[10px] font-medium", meta.color)}>{item.title}</div>
                      );
                    })}
                    {dayItems.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div>}
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

// ─── Type Badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ContentType }) {
  const { label, color, icon: Icon } = TYPE_META[type];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", color)}><Icon className="h-3 w-3" />{label}</span>;
}

function StatusBadge({ status }: { status: ContentStatus }) {
  const { label, color } = STATUS_META[status];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", color)}>{label}</span>;
}

// ─── Main Component ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  content_type: "blog_post" as ContentType,
  title: "", slug: "", subject: "", preheader: "", excerpt: "",
  featured_image_url: "", video_url: "", image_url: "",
  hashtags: "", tags: "", categories: "",
  status: "draft" as ContentStatus,
  published_at: "", meta_title: "", meta_description: "", author_id: "", source_id: "",
};

export function AdminContent() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msgCount, setMsgCount] = useState(0);

  // View / filter
  const [view, setView] = useState<ViewMode>("cards");
  const [activeType, setActiveType] = useState<"all" | ContentType>("all");
  const [query, setQuery] = useState("");
  const [calMonth, setCalMonth] = useState(() => new Date());

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [editorTab, setEditorTab] = useState<"visual" | "html">("visual");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [htmlContent, setHtmlContent] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [convertOpen, setConvertOpen] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile) { setAuthState("denied"); return; }
      if (profile.role !== "super_admin" && profile.role !== "admin") { setAuthState("denied"); return; }
      setAuthState("allowed");
      const itemsData = await fetchItems();
      setItems(itemsData);
      setLoading(false);
    }
    boot();
  }, []);

  const visibleItems = items.filter((item) => {
    if (activeType !== "all" && item.content_type !== activeType) return false;
    if (query && !item.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  function openNew(type: ContentType = "blog_post", fromItem?: ContentItem) {
    setEditItem(null);
    const initialContent = fromItem ? fromItem.content : "";
    setBlocks(htmlToBlocks(initialContent));
    setHtmlContent(initialContent);
    setGallery(fromItem?.gallery ?? []);
    setForm({
      ...EMPTY_FORM,
      content_type: type,
      title: fromItem ? `${TYPE_META[type].label}: ${fromItem.title}` : "",
      source_id: fromItem?.id ?? "",
      subject: fromItem?.title ?? "",
      categories: (fromItem?.categories ?? []).join(", "),
      tags: (fromItem?.tags ?? []).join(", "),
    });
    setEditorTab("visual");
    setEditorOpen(true);
  }

  function openEdit(item: ContentItem) {
    setEditItem(item);
    setBlocks(htmlToBlocks(item.content));
    setHtmlContent(item.content);
    setGallery(item.gallery ?? []);
    setForm({
      content_type: item.content_type,
      title: item.title,
      slug: item.slug ?? "",
      subject: item.subject ?? "",
      preheader: item.preheader ?? "",
      excerpt: item.excerpt ?? "",
      featured_image_url: item.featured_image_url ?? "",
      video_url: item.video_url ?? "",
      image_url: item.image_url ?? "",
      hashtags: (item.hashtags ?? []).join(", "),
      tags: (item.tags ?? []).join(", "),
      categories: (item.categories ?? []).join(", "),
      status: item.status,
      published_at: item.published_at ? item.published_at.slice(0, 16) : "",
      meta_title: item.meta_title ?? "",
      meta_description: item.meta_description ?? "",
      author_id: item.author_id ?? "",
      source_id: item.source_id ?? "",
    });
    setEditorTab("visual");
    setEditorOpen(true);
  }

  function switchEditorTab(tab: "visual" | "html") {
    if (tab === "html") setHtmlContent(blocksToHtml(blocks));
    if (tab === "visual") setBlocks(htmlToBlocks(htmlContent));
    setEditorTab(tab);
  }

  async function save(statusOverride?: ContentStatus) {
    setSaving(true);
    const content = editorTab === "html" ? htmlContent : blocksToHtml(blocks);
    const payload = {
      ...form,
      id: editItem?.id,
      content,
      gallery,
      tags: csvToArray(form.tags),
      categories: csvToArray(form.categories),
      hashtags: csvToArray(form.hashtags),
      status: statusOverride ?? form.status,
      published_at: form.published_at || null,
      author_id: form.author_id || null,
      source_id: form.source_id || null,
    };
    try {
      const result = await apiCall(editItem ? "PATCH" : "POST", payload) as { item: ContentItem };
      setItems((prev) => editItem
        ? prev.map((i) => i.id === editItem.id ? result.item : i)
        : [result.item, ...prev]
      );
      setEditorOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this content item?")) return;
    await apiCall("DELETE", { id });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function setStatus(id: string, status: ContentStatus) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const result = await apiCall("PATCH", {
      ...item,
      gallery: item.gallery,
      tags: item.tags,
      categories: item.categories,
      hashtags: item.hashtags,
      status,
    }) as { item: ContentItem };
    setItems((prev) => prev.map((i) => i.id === id ? result.item : i));
  }

  const charLimit = SOCIAL_CHAR_LIMIT[form.content_type];
  const currentContent = editorTab === "html" ? htmlContent : blocksToHtml(blocks);
  const charCount = currentContent.replace(/<[^>]+>/g, "").length;

  function addGalleryItem() { setGallery([...gallery, { url: "", alt: "", caption: "" }]); }
  function removeGalleryItem(i: number) { setGallery(gallery.filter((_, idx) => idx !== i)); }
  function updateGalleryItem(i: number, patch: Partial<GalleryItem>) {
    setGallery(gallery.map((g, idx) => idx === i ? { ...g, ...patch } : g));
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">

        {/* Sidebar */}
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
                {group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}>
                      <Icon className="h-4 w-4" />{label}
                      {label === "Messages" && msgCount > 0 && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{msgCount}</Badge>}
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

        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>Super Admin</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">Content</span>
            </div>
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
              <Zap className="mr-2 h-4 w-4 animate-pulse text-primary" /> Loading…
            </div>
          )}
          {authState === "denied" && (
            <div className="flex h-[calc(100vh-48px)] items-center justify-center p-6">
              <Card className="max-w-md border-red-500/30">
                <CardContent className="p-5">
                  <div className="font-semibold text-red-600">Admin access required</div>
                  <Button className="mt-4" asChild><a href="/admin">Back to dashboard</a></Button>
                </CardContent>
              </Card>
            </div>
          )}
          {authState === "allowed" && (
            <div className="p-5">
              {/* Page header */}
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold">Content</h1>
                  <p className="text-sm text-muted-foreground">Blog posts, email templates, and social media cards.</p>
                </div>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openNew()}>
                  <Plus className="h-3.5 w-3.5" /> New Content
                </Button>
              </div>

              {/* Stats */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {(["all", "blog_post", "email_template", "social_facebook", "social_linkedin", "social_instagram"] as const).map((t) => {
                  const count = t === "all" ? items.length : items.filter((i) => i.content_type === t).length;
                  const meta = t === "all" ? null : TYPE_META[t];
                  return (
                    <button key={t} onClick={() => setActiveType(t)} className={cn("rounded-lg border p-3 text-left transition-colors hover:border-primary/40", activeType === t && "border-primary/60 bg-primary/5")}>
                      <div className="text-xl font-bold">{count}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{meta?.label ?? "All Content"}</div>
                    </button>
                  );
                })}
              </div>

              {/* Toolbar */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Input placeholder="Search content…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-[220px] text-sm" />
                <div className="ml-auto flex items-center gap-1">
                  {(["cards", "list", "table", "calendar"] as ViewMode[]).map((v) => {
                    const icons: Record<ViewMode, React.ElementType> = { cards: LayoutGrid, list: LayoutList, table: Layers, calendar: Calendar };
                    const Icon = icons[v];
                    return (
                      <Button key={v} variant="outline" size="icon" className={cn("h-8 w-8", view === v && "border-primary/60 bg-primary/10")} onClick={() => setView(v)}>
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* ── Cards view ── */}
              {view === "cards" && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {visibleItems.map((item) => (
                    <div key={item.id} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                      <div className="relative h-36 bg-muted">
                        {item.featured_image_url
                          ? <img src={item.featured_image_url} alt={item.title} className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center"><BookOpen className="h-8 w-8 text-muted-foreground/30" /></div>}
                        <div className="absolute left-2 top-2 flex gap-1">
                          <TypeBadge type={item.content_type} />
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="mb-1 line-clamp-2 text-sm font-semibold">{item.title}</div>
                        {item.excerpt && <p className="mb-2 line-clamp-2 text-[12px] text-muted-foreground">{item.excerpt}</p>}
                        <div className="text-[11px] text-muted-foreground">
                          {item.published_at ? new Date(item.published_at).toLocaleDateString() : new Date(item.created_at!).toLocaleDateString()}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Button variant="outline" size="sm" className="h-6 gap-1 text-[11px]" onClick={() => openEdit(item)}>
                            <Edit2 className="h-3 w-3" /> Edit
                          </Button>
                          <div className="relative">
                            <Button variant="outline" size="sm" className="h-6 gap-1 text-[11px]" onClick={() => setConvertOpen(convertOpen === item.id ? null : item.id)}>
                              <ArrowRight className="h-3 w-3" /> Convert
                            </Button>
                            {convertOpen === item.id && (
                              <div className="absolute left-0 top-7 z-10 w-44 rounded-lg border bg-card shadow-lg">
                                {CONVERT_OPTIONS.map((ct) => {
                                  const m = TYPE_META[ct]; const Icon = m.icon;
                                  return (
                                    <button key={ct} type="button" onClick={() => { openNew(ct, item); setConvertOpen(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-accent">
                                      <Icon className="h-3.5 w-3.5" />{m.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => deleteItem(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loading && visibleItems.length === 0 && (
                    <div className="col-span-full py-16 text-center text-sm text-muted-foreground">No content yet. <button className="text-primary underline" onClick={() => openNew()}>Create your first post.</button></div>
                  )}
                </div>
              )}

              {/* ── List view ── */}
              {view === "list" && (
                <div className="divide-y rounded-xl border bg-card">
                  {visibleItems.map((item) => {
                    const meta = TYPE_META[item.content_type]; const Icon = meta.icon;
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.color)}><Icon className="h-3.5 w-3.5" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {item.categories?.length > 0 && <span>{item.categories.join(", ")}</span>}
                            <span>{item.published_at ? new Date(item.published_at).toLocaleDateString() : new Date(item.created_at!).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => deleteItem(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                  {!loading && visibleItems.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">No content found.</div>
                  )}
                </div>
              )}

              {/* ── Table view ── */}
              {view === "table" && (
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 text-left">Title</th>
                        <th className="px-4 py-2.5 text-left">Type</th>
                        <th className="px-4 py-2.5 text-left">Status</th>
                        <th className="px-4 py-2.5 text-left">Categories</th>
                        <th className="px-4 py-2.5 text-left">Date</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visibleItems.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="max-w-[260px] truncate px-4 py-2.5 font-medium">{item.title}</td>
                          <td className="px-4 py-2.5"><TypeBadge type={item.content_type} /></td>
                          <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                          <td className="max-w-[160px] truncate px-4 py-2.5 text-muted-foreground">{(item.categories ?? []).join(", ") || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{item.published_at ? new Date(item.published_at).toLocaleDateString() : new Date(item.created_at!).toLocaleDateString()}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {item.status !== "published" && <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setStatus(item.id, "published")}><Send className="mr-1 h-3 w-3" />Publish</Button>}
                              {item.status !== "archived" && <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setStatus(item.id, "archived")}><Archive className="mr-1 h-3 w-3" />Archive</Button>}
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!loading && visibleItems.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">No content found.</div>
                  )}
                </div>
              )}

              {/* ── Calendar view ── */}
              {view === "calendar" && (
                <CalendarView items={visibleItems} month={calMonth} onMonth={setCalMonth} />
              )}
            </div>
          )}
        </main>

        {/* ── Editor Sheet ── */}
        <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
          <SheetContent className="flex w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <SheetHeader className="shrink-0 border-b px-5 py-3.5">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-base">{editItem ? "Edit Content" : "New Content"}</SheetTitle>
                {editItem && <TypeBadge type={editItem.content_type} />}
              </div>
            </SheetHeader>

            <div className="flex flex-1 overflow-hidden">
              {/* ── Editor main column ── */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Content type selector (new only) */}
                {!editItem && (
                  <div className="shrink-0 border-b bg-muted/30 px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(TYPE_META) as ContentType[]).map((ct) => {
                        const { label, color, icon: Icon } = TYPE_META[ct];
                        return (
                          <button key={ct} type="button" onClick={() => setForm((f) => ({ ...f, content_type: ct }))} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium border transition-all", form.content_type === ct ? "border-primary/60 " + color : "border-transparent bg-muted text-muted-foreground hover:border-border")}>
                            <Icon className="h-3 w-3" />{label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Editor tabs */}
                <div className="shrink-0 border-b bg-muted/20 px-5">
                  <div className="flex gap-1 py-2">
                    {([["visual", "Visual"] , ["html", "HTML"]] as const).map(([tab, label]) => (
                      <button key={tab} type="button" onClick={() => switchEditorTab(tab)} className={cn("rounded px-3 py-1 text-[12px] font-medium transition-colors", editorTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {label}
                      </button>
                    ))}
                    {charLimit && (
                      <span className={cn("ml-auto flex items-center text-[11px]", charCount > charLimit ? "text-red-500" : "text-muted-foreground")}>
                        {charCount} / {charLimit} chars
                      </span>
                    )}
                  </div>
                </div>

                {/* Editor content */}
                <div className="flex-1 overflow-y-auto p-5">
                  {/* Title */}
                  <div className="mb-4">
                    <Input
                      placeholder={form.content_type === "email_template" ? "Template name…" : "Title…"}
                      value={form.title}
                      onChange={(e) => setForm((f) => ({
                        ...f, title: e.target.value,
                        slug: f.slug || slugify(e.target.value),
                      }))}
                      className="border-0 bg-transparent px-0 text-xl font-bold shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Email template extra fields */}
                  {form.content_type === "email_template" && (
                    <div className="mb-4 space-y-2 rounded-lg border bg-card/50 p-3">
                      <Input placeholder="Subject line *" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="text-sm" />
                      <Input placeholder="Preheader text (preview text shown in inbox)" value={form.preheader} onChange={(e) => setForm((f) => ({ ...f, preheader: e.target.value }))} className="text-sm" />
                    </div>
                  )}

                  {/* Visual block editor */}
                  {editorTab === "visual" && <BlockEditor blocks={blocks} onChange={setBlocks} />}

                  {/* HTML editor */}
                  {editorTab === "html" && (
                    <Textarea
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      className="min-h-[400px] font-mono text-[12px]"
                      placeholder="<p>Enter HTML content…</p>"
                    />
                  )}
                </div>
              </div>

              {/* ── Sidebar panel ── */}
              <div className="w-[260px] shrink-0 overflow-y-auto border-l bg-card/40 px-4 py-4 space-y-5">

                {/* Publish / Actions */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Publish</p>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ContentStatus }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  {(form.status === "scheduled" || form.status === "published") && (
                    <Input
                      type="datetime-local"
                      value={form.published_at}
                      onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  )}
                  <div className="flex gap-1.5 pt-1">
                    <Button size="sm" className="flex-1 h-7 text-xs" disabled={saving} onClick={() => save()}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    {form.status !== "published" && (
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" disabled={saving} onClick={() => save("published")}>
                        <Send className="h-3 w-3" /> Publish
                      </Button>
                    )}
                  </div>
                  {editItem && (
                    <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-red-500 hover:text-red-600" onClick={() => { deleteItem(editItem.id); setEditorOpen(false); }}>
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>

                {/* Blog post fields */}
                {form.content_type === "blog_post" && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Permalink</p>
                    <Input placeholder="slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} className="h-8 font-mono text-xs" />
                    <Input placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} className="h-8 text-xs" />
                  </div>
                )}

                {/* Social card fields */}
                {form.content_type.startsWith("social_") && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Social</p>
                    <Input placeholder="Image URL" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} className="h-8 text-xs" />
                    <Input placeholder="Hashtags (comma separated)" value={form.hashtags} onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))} className="h-8 text-xs" />
                  </div>
                )}

                {/* Author */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Author</p>
                  <Input placeholder="Author name or ID" value={form.author_id} onChange={(e) => setForm((f) => ({ ...f, author_id: e.target.value }))} className="h-8 text-xs" />
                </div>

                {/* Taxonomy */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
                  <Input placeholder="Print, Signs, Wraps…" value={form.categories} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))} className="h-8 text-xs" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                  <Input placeholder="banner, vinyl, outdoor…" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="h-8 text-xs" />
                </div>

                {/* Media */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Featured Image</p>
                  <Input placeholder="https://…" value={form.featured_image_url} onChange={(e) => setForm((f) => ({ ...f, featured_image_url: e.target.value }))} className="h-8 text-xs" />
                  {form.featured_image_url && <img src={form.featured_image_url} alt="preview" className="rounded object-cover w-full h-28" />}
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Video URL</p>
                  <Input placeholder="YouTube / Vimeo URL" value={form.video_url} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} className="h-8 text-xs" />
                </div>

                {/* Gallery */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gallery</p>
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={addGalleryItem}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                  {gallery.map((g, gi) => (
                    <div key={gi} className="rounded border bg-background/50 p-2 space-y-1">
                      <div className="flex items-center gap-1">
                        <Input placeholder="Image URL" value={g.url} onChange={(e) => updateGalleryItem(gi, { url: e.target.value })} className="h-6 text-[11px]" />
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeGalleryItem(gi)}><X className="h-3 w-3" /></Button>
                      </div>
                      <Input placeholder="Alt text" value={g.alt} onChange={(e) => updateGalleryItem(gi, { alt: e.target.value })} className="h-6 text-[11px]" />
                    </div>
                  ))}
                </div>

                {/* SEO (blog only) */}
                {form.content_type === "blog_post" && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SEO</p>
                    <Input placeholder="Meta title" value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} className="h-8 text-xs" />
                    <Textarea placeholder="Meta description" value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} className="min-h-[60px] resize-none text-xs" />
                  </div>
                )}

                {/* Convert to (blog posts only) */}
                {(editItem?.content_type === "blog_post" || form.content_type === "blog_post") && editItem && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Convert to</p>
                    <div className="space-y-1">
                      {CONVERT_OPTIONS.map((ct) => {
                        const m = TYPE_META[ct]; const Icon = m.icon;
                        return (
                          <Button key={ct} type="button" variant="outline" size="sm" className="w-full justify-start h-7 gap-1.5 text-xs" onClick={() => { openNew(ct, editItem); }}>
                            <Icon className="h-3.5 w-3.5" />{m.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Agent */}
                <div>
                  <Button variant="outline" size="sm" className="w-full h-7 gap-1.5 text-xs" asChild>
                    <Link href={`/admin/agent`} target="_blank">
                      <Bot className="h-3.5 w-3.5 text-primary" />Write with AI Agent
                    </Link>
                  </Button>
                </div>

              </div>
            </div>
          </SheetContent>
        </Sheet>

      </div>
    </div>
  );
}
