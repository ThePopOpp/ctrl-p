"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CircleDollarSign, Palette, Pencil, ShoppingBag, Upload, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  order_id: string | null;
  design_draft_id: string | null;
  user_id: string | null;
  meta: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  const cls = "h-4 w-4";
  if (type === "new_order") return <ShoppingBag className={cls} />;
  if (type === "design_submitted") return <Palette className={cls} />;
  if (type === "custom_design_request") return <Pencil className={cls} />;
  if (type === "file_uploaded") return <Upload className={cls} />;
  if (type === "payment_received") return <CircleDollarSign className={cls} />;
  return <Bell className={cls} />;
}

function notifIconColor(type: string) {
  if (type === "new_order") return "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400";
  if (type === "custom_design_request") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
  if (type === "design_submitted") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (type === "file_uploaded") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function notifLink(n: AdminNotification) {
  if (n.type === "new_order") return "/admin/orders";
  if (n.type === "design_submitted" || n.type === "custom_design_request") return "/admin/artwork";
  if (n.type === "file_uploaded") return "/admin/artwork";
  if (n.type === "payment_received") return "/admin/payments";
  return "/admin";
}

export function AdminNotificationBell() {
  const [notifs, setNotifs] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifs.filter((n) => !n.read_at).length;

  async function load() {
    const db = getSupabaseBrowserClient();
    if (!db) return;
    const result = await db
      .from("admin_notifications")
      .select("id, type, title, body, order_id, design_draft_id, user_id, meta, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!result.error) setNotifs((result.data ?? []) as AdminNotification[]);
  }

  async function markAllRead() {
    const db = getSupabaseBrowserClient();
    if (!db) return;
    const now = new Date().toISOString();
    await db.from("admin_notifications").update({ read_at: now }).is("read_at", null);
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
  }

  async function markOneRead(id: string) {
    const db = getSupabaseBrowserClient();
    if (!db) return;
    const now = new Date().toISOString();
    await db.from("admin_notifications").update({ read_at: now }).eq("id", id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
  }

  // Initial load + realtime subscription
  useEffect(() => {
    load();
    const db = getSupabaseBrowserClient();
    if (!db) return;
    const channel = db
      .channel("admin-notification-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload: { new: Record<string, unknown> }) => {
          setNotifs((prev) => [payload.new as unknown as AdminNotification, ...prev].slice(0, 30));
        }
      )
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  function handleToggle() {
    setOpen((was) => {
      if (!was && unreadCount > 0) markAllRead();
      return !was;
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label="Notifications"
        className="relative h-8 w-8"
        onClick={handleToggle}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[360px] overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[440px] overflow-y-auto divide-y">
            {notifs.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            )}
            {notifs.map((n) => (
              <a
                key={n.id}
                href={notifLink(n)}
                onClick={() => { if (!n.read_at) markOneRead(n.id); setOpen(false); }}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50",
                  !n.read_at && "bg-primary/5"
                )}
              >
                <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", notifIconColor(n.type))}>
                  <NotifIcon type={n.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-snug">{n.title}</div>
                  {n.body && (
                    <div className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">{n.body}</div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</div>
                </div>
                {!n.read_at && (
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
