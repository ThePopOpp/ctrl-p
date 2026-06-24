"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlignLeft, Archive, BookOpen, Bot, Calendar, CalendarClock,
  ChevronLeft, ChevronRight, Edit2, EyeOff, Image,
  LayoutGrid, LayoutList, Layers, LogOut, Mail, Moon,
  Plus, Send, Share2, Sun, Trash2, Video, X, Zap,
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

const TOOLBAR_SNIPPETS = [
  { label: "Row",       html: '<div style="display:block;width:100%;padding:8px 0;">\n  \n</div>' },
  { label: "2 Columns", html: '<div style="display:flex;gap:20px;">\n  <div style="flex:1;">Column 1</div>\n  <div style="flex:1;">Column 2</div>\n</div>' },
  { label: "Text",      html: "<p>Your text here</p>" },
  { label: "Bold Text", html: "<p><strong>Bold text here</strong></p>" },
  { label: "Italic",    html: "<p><em>Italic text here</em></p>" },
  { label: "Left",      html: '<div style="text-align:left;">Left-aligned content</div>' },
  { label: "Center",    html: '<div style="text-align:center;">Centered content</div>' },
  { label: "Right",     html: '<div style="text-align:right;">Right-aligned content</div>' },
  { label: "Image",     html: '<img src="your-image-url" alt="Description" style="max-width:100%;height:auto;" />' },
  { label: "Link",      html: '<a href="https://your-url.com">Link text</a>' },
  { label: "Button",    html: '<a href="https://your-url.com" style="display:inline-block;padding:12px 24px;background:#2f6848;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;">Click Here</a>' },
  { label: "Divider",   html: '<hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />' },
];

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
  const [simpleContent, setSimpleContent] = useState("<p>Build your post content here...</p>");
  const [htmlContent, setHtmlContent] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [fontSize, setFontSize] = useState("18");
  const [textColor, setTextColor] = useState("#0f1f1a");
  const [btnColor, setBtnColor] = useState("#2f6848");
  const [showAdvancedUrl, setShowAdvancedUrl] = useState(false);
  const simpleRef = useRef<HTMLTextAreaElement>(null);
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

  function openNew() {
    setEditPost(null);
    setForm(EMPTY_FORM);
    setSimpleContent("<p>Build your post content here...</p>");
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
    setSimpleContent(post.content);
    setHtmlContent(post.content);
    setGallery(post.gallery ?? []);
    setEditorTab("simple");
    setPage("editor");
  }

  function getContent() {
    if (editorTab === "wysiwyg") return wysiwygRef.current?.innerHTML ?? "";
    if (editorTab === "html") return htmlContent;
    return simpleContent;
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

  function insertSnippet(raw: string) {
    const snippet = raw
      .replace("Your text here", `<span style="font-size:${fontSize}px;color:${textColor};">Your text here</span>`)
      .replace(/#2f6848/g, btnColor);
    const ta = simpleRef.current;
    if (!ta) { setSimpleContent((c) => c + "\n" + snippet); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = ta.value.slice(0, start) + snippet + ta.value.slice(end);
    setSimpleContent(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + snippet.length; }, 0);
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
            <div className="p-5 space-y-5 max-w-5xl">
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
                        if (t === "html") setHtmlContent(simpleContent);
                        if (t === "simple" && editorTab === "html") setSimpleContent(htmlContent);
                        if (t === "wysiwyg" && wysiwygRef.current) wysiwygRef.current.innerHTML = simpleContent;
                        setEditorTab(t);
                      }}
                      className={cn(
                        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                        editorTab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t === "simple" ? "Simple Builder" : t === "html" ? "Advanced HTML" : "WYSIWYG"}
                    </button>
                  ))}
                </div>

                {/* Simple Builder */}
                {(editorTab === "simple" || editorTab === "html") && (
                  <div className="overflow-hidden rounded-xl border">
                    {editorTab === "simple" && (
                      <>
                        <div className="flex flex-wrap items-center gap-4 border-b px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <span className="text-muted-foreground">Font size</span>
                            <Input value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="h-7 w-12 text-center text-xs" />
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <span className="text-muted-foreground">Text color</span>
                            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded border p-0.5" />
                            <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-7 w-20 font-mono text-xs" />
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <span className="text-muted-foreground">Button color</span>
                            <input type="color" value={btnColor} onChange={(e) => setBtnColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded border p-0.5" />
                            <Input value={btnColor} onChange={(e) => setBtnColor(e.target.value)} className="h-7 w-20 font-mono text-xs" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
                          {TOOLBAR_SNIPPETS.map(({ label, html }) => (
                            <button key={label} onClick={() => insertSnippet(html)} className="rounded border bg-muted px-2 py-1 text-[12px] font-medium hover:bg-accent transition-colors">
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <Textarea
                      ref={simpleRef}
                      value={editorTab === "simple" ? simpleContent : htmlContent}
                      onChange={(e) => editorTab === "simple" ? setSimpleContent(e.target.value) : setHtmlContent(e.target.value)}
                      className="min-h-[320px] resize-none rounded-none rounded-b-xl border-0 font-mono text-[13px] leading-relaxed focus-visible:ring-0"
                      placeholder="<p>Build your post content here...</p>"
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
                    <div ref={wysiwygRef} contentEditable suppressContentEditableWarning className="min-h-[320px] p-4 text-sm leading-relaxed focus:outline-none" dangerouslySetInnerHTML={{ __html: simpleContent }} />
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
