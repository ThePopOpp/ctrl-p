"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Bell, Box, CalendarClock, CreditCard, FileCheck2,
  Home, IdCard, LogOut, MessageSquare, Moon, Search, Settings, Sun, Truck, UserCircle, X,
  type LucideIcon,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Shared Types ───────────────────────────────────────────────────────────

export type CustomerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  profile_photo_url?: string | null;
  role: string;
  status: string;
  created_at?: string | null;
};

export type CustomerOrder = {
  id: string;
  order_number: string | null;
  status: string;
  production_status: string;
  payment_status: string;
  total: number | string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_notes: string | null;
  due_at: string | null;
  created_at: string | null;
};

export type CustomerOrderItem = {
  id: string;
  order_id: string;
  quantity: number | null;
  unit_price: number | string | null;
  line_total: number | string | null;
  proof_required: boolean;
  products?: { id: string; name: string | null; category: string | null } | null;
};

export type CustomerPayment = {
  id: string;
  order_id: string | null;
  amount: number | string | null;
  status: string;
  provider: string | null;
  method: string | null;
  currency: string | null;
  invoice_number?: string | null;
  invoice_due_at?: string | null;
  payment_link_url?: string | null;
  received_at: string | null;
  created_at: string | null;
};

export type CustomerMessage = {
  id: string;
  order_id: string | null;
  subject: string | null;
  body: string | null;
  channel: string;
  direction: string;
  read_at: string | null;
  sent_at: string | null;
  created_at: string | null;
};

export type CustomerArtwork = {
  id: string;
  order_id: string | null;
  filename: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  thumbnail_url?: string | null;
  review_status?: string | null;
  proof_version?: number | null;
  admin_comments?: string | null;
  customer_comments?: string | null;
  created_at: string | null;
};

export type CustomerDesignDraft = {
  id: string;
  product_id: string | null;
  product_key: string | null;
  product_label: string | null;
  title: string | null;
  status: string | null;
  preview_svg?: string | null;
  preview_image_url?: string | null;
  order_id?: string | null;
  order_item_id?: string | null;
  last_saved_at: string | null;
  created_at: string | null;
  products?: { id: string; name: string | null; slug: string | null; category: string | null } | null;
};

export type CustomerProof = {
  id: string;
  order_item_id: string;
  proof_url: string | null;
  revision_number: number | null;
  status?: string | null;
  admin_comments?: string | null;
  customer_comments?: string | null;
  sent_at: string | null;
  customer_approved_at: string | null;
  created_at: string | null;
};

export type CustomerShipment = {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string | null;
  shipped_at: string | null;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
};

export type CustomerBooking = {
  id: string;
  title: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  appointment_type_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  notes: string | null;
  created_at: string | null;
};

export type CustomerData = {
  profile: CustomerProfile;
  orders: CustomerOrder[];
  orderItems: CustomerOrderItem[];
  payments: CustomerPayment[];
  messages: CustomerMessage[];
  artworkFiles: CustomerArtwork[];
  designDrafts: CustomerDesignDraft[];
  proofs: CustomerProof[];
  shipments: CustomerShipment[];
};

// ─── Utility Functions ───────────────────────────────────────────────────────

const _money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function amount(value: number | string | null | undefined) {
  return _money.format(Number(value || 0));
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function statusTone(value: string | null | undefined) {
  const s = String(value || "");
  if (["paid", "approved", "completed", "delivered"].includes(s)) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["failed", "cancelled", "rejected", "refunded", "revision_requested"].includes(s)) return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

export const customerNavItems: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Overview", icon: Home, href: "/dashboard/customer" },
  { label: "Profile", icon: UserCircle, href: "/dashboard/customer/profile" },
  { label: "Orders", icon: Box, href: "/dashboard/customer/orders" },
  { label: "Invoices", icon: CreditCard, href: "/dashboard/customer/invoices" },
  { label: "Artwork", icon: FileCheck2, href: "/dashboard/customer/artwork" },
  { label: "Bookings", icon: CalendarClock, href: "/dashboard/customer/bookings" },
  { label: "My Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/customer/messages" },
  { label: "Shipping", icon: Truck, href: "/dashboard/customer/shipping" },
  { label: "Settings", icon: Settings, href: "/dashboard/customer/settings" },
];

// ─── Shared session hook ─────────────────────────────────────────────────────

export function useCustomerSession() {
  const router = useRouter();
  const [data, setData] = useState<CustomerData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("controlp_customer_theme");
    if (stored === "light" || stored === "dark") setThemeState(stored);
  }, []);

  useEffect(() => {
    async function load() {
      const db = getSupabaseBrowserClient();
      const session = db ? (await db.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        router.replace("/login?redirect=/dashboard/customer");
        return;
      }
      const headers = { authorization: `Bearer ${session.access_token}` };
      const [dashRes, bookingsRes] = await Promise.all([
        fetch("/api/dashboard/customer", { headers }),
        fetch("/api/dashboard/customer/bookings", { headers }),
      ]);
      const payload = await dashRes.json().catch(() => ({}));
      if (!dashRes.ok) {
        setErrorMessage(payload.error || "Could not load your dashboard.");
        setState("denied");
        return;
      }
      const dashData = payload as CustomerData;
      setData(dashData);
      setMessages(dashData.messages ?? []);
      setState("ready");
      const bPayload = await bookingsRes.json().catch(() => ({}));
      if (bookingsRes.ok) setBookings(bPayload.bookings ?? []);
    }
    load();
  }, [router]);

  const getToken = useCallback(async () => {
    const db = getSupabaseBrowserClient();
    return (await db?.auth.getSession())?.data.session?.access_token ?? null;
  }, []);

  function setTheme(next: "light" | "dark") {
    setThemeState(next);
    window.localStorage.setItem("controlp_customer_theme", next);
  }

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  return { data, setData, state, errorMessage, theme, setTheme, messages, setMessages, bookings, getToken, signOut };
}

// ─── CustomerShell layout ────────────────────────────────────────────────────

type ShellProps = {
  children: React.ReactNode;
  profile: CustomerProfile | null | undefined;
  unreadCount: number;
  upcomingBookingsCount: number;
  theme: "light" | "dark";
  onThemeChange: () => void;
  onSignOut: () => void;
  activePage: string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  state: "loading" | "ready" | "denied";
  errorMessage?: string;
  messages?: CustomerMessage[];
  onOpenNotifications?: () => void;
  notifOpen?: boolean;
  notifRef?: React.RefObject<HTMLDivElement | null>;
  onCloseNotif?: () => void;
};

export function CustomerShell({
  children,
  profile,
  unreadCount,
  upcomingBookingsCount,
  theme,
  onThemeChange,
  onSignOut,
  activePage,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  state,
  errorMessage = "",
  messages = [],
  onOpenNotifications,
  notifOpen = false,
  notifRef,
  onCloseNotif,
}: ShellProps) {
  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
        <a className="mb-5 block px-2" href="/dashboard/customer">
          <img src="/logos/logo-lime-light.svg" alt="ControlP.io" className="h-auto w-[140px] dark:hidden" />
          <img src="/logos/logo-lime-dark.svg" alt="ControlP.io" className="hidden h-auto w-[140px] dark:block" />
          <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Customer</div>
        </a>
        <nav className="space-y-1">
          {customerNavItems.map(({ label, icon: Icon, href }) => (
            <a
              key={label}
              href={href}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                activePage === label && "bg-accent font-medium text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {label === "Bookings" && upcomingBookingsCount > 0 && (
                <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{upcomingBookingsCount}</Badge>
              )}
              {label === "Messages" && unreadCount > 0 && (
                <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{unreadCount}</Badge>
              )}
            </a>
          ))}
        </nav>
        {profile && (
          <div className="absolute bottom-3 left-3 right-3 rounded-xl border bg-background/55 p-2">
            <div className="flex items-center gap-2">
              {profile.profile_photo_url
                ? <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={profile.profile_photo_url} alt="" />
                : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{(profile.full_name || profile.email || "C").slice(0, 1).toUpperCase()}</div>
              }
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{profile.full_name || "Customer"}</div>
                <div className="truncate text-xs text-muted-foreground">{profile.company || profile.email || "ControlP.io"}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
        <div className="flex h-12 items-center gap-3 px-5">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">{activePage}</span></div>
          <div className="ml-auto flex items-center gap-2">
            {onSearchChange && (
              <div className="relative hidden w-[340px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder={searchPlaceholder} value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
              </div>
            )}
            {onOpenNotifications && (
              <div ref={notifRef} className="relative">
                <Button variant="outline" size="icon" className="relative h-8 w-8" aria-label="Notifications" onClick={onOpenNotifications}>
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
                {notifOpen && (
                  <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-card shadow-xl">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div className="text-sm font-semibold">Notifications</div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCloseNotif}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {messages.slice(0, 8).map((msg) => (
                        <div key={msg.id} className={cn("border-b px-4 py-3 last:border-0", !msg.read_at && msg.direction === "outbound" && "bg-primary/5")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium">{msg.subject || human(msg.channel)}</div>
                              <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{msg.body || "No body."}</div>
                            </div>
                            {!msg.read_at && msg.direction === "outbound" && <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{fmtDate(msg.created_at)}</div>
                        </div>
                      ))}
                      {!messages.length && <div className="px-4 py-6 text-center text-xs text-muted-foreground">No notifications yet.</div>}
                    </div>
                    <div className="border-t px-4 py-2">
                      <a href="/dashboard/customer/messages" className="block text-center text-xs text-primary hover:underline">View all messages →</a>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Toggle theme" onClick={onThemeChange}>
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="outline" className="h-8 text-xs" onClick={onSignOut}><LogOut className="h-4 w-4" />Sign out</Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
        {state === "loading" && (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading your dashboard...</div>
        )}
        {state === "denied" && (
          <div className="rounded-xl border border-red-500/30 bg-card p-6">
            <div className="font-semibold text-red-600 dark:text-red-300">Dashboard unavailable</div>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <Button className="mt-4" asChild><a href="/login?redirect=/dashboard/customer">Go to login</a></Button>
          </div>
        )}
        {state === "ready" && children}
      </main>
    </div>
  );
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

export function StatusBadge({ value }: { value: string }) {
  return <Badge className={`border ${statusTone(value)}`}>{human(value)}</Badge>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}
