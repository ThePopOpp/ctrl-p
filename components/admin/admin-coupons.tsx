"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronRight, Moon, Pencil, Plus, Sun, Tag, Trash2 } from "lucide-react";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { getCurrentAdminProfile } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type CouponOrder = {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string;
  total: number | string | null;
  discount_amount: number | string | null;
  customer_email: string | null;
  created_at: string;
};

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number | string;
  min_order_total: number | string | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

async function getAdminToken() {
  const db = getSupabaseBrowserClient();
  const session = await db?.auth.getSession();
  return session?.data.session?.access_token || "";
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = await getAdminToken();
  const res = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

function human(value: string | null | undefined) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function CouponForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Coupon>;
  onSave: (data: Partial<Coupon>) => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [discountType, setDiscountType] = useState(initial?.discount_type || "percentage");
  const [discountValue, setDiscountValue] = useState(String(initial?.discount_value || ""));
  const [minOrderTotal, setMinOrderTotal] = useState(String(initial?.min_order_total || ""));
  const [maxUses, setMaxUses] = useState(String(initial?.max_uses || ""));
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at ? new Date(initial.expires_at).toISOString().slice(0, 10) : "");
  const [active, setActive] = useState(initial?.active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!code.trim()) { setError("Code is required."); return; }
    if (!discountValue || Number(discountValue) <= 0) { setError("Discount value must be greater than zero."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_order_total: minOrderTotal ? Number(minOrderTotal) : null,
        max_uses: maxUses ? Number(maxUses) : null,
        expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        active,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save coupon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Code *</div>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" className="font-mono uppercase" disabled={!!initial?.id} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div>
          <Select value={active ? "active" : "inactive"} onValueChange={(v) => setActive(v === "active")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Description</div>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional internal note" />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Discount type</div>
          <Select value={discountType} onValueChange={setDiscountType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed amount ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            Discount value {discountType === "percentage" ? "(%)" : "($)"}
          </div>
          <Input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} inputMode="decimal" placeholder={discountType === "percentage" ? "20" : "10.00"} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Minimum order ($)</div>
          <Input value={minOrderTotal} onChange={(e) => setMinOrderTotal(e.target.value)} inputMode="decimal" placeholder="Optional" />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Max uses</div>
          <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="Unlimited" />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Expiry date</div>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>
      {error && <div className="rounded-lg border bg-background/35 p-3 text-sm text-destructive">{error}</div>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={saving}>{saving ? "Saving..." : initial?.id ? "Update coupon" : "Create coupon"}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function AdminCoupons() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [notice, setNotice] = useState("");
  const [expandedCouponId, setExpandedCouponId] = useState<string | null>(null);
  const [couponOrders, setCouponOrders] = useState<Record<string, CouponOrder[]>>({});
  const [couponOrdersLoading, setCouponOrdersLoading] = useState<Record<string, boolean>>({});

  async function loadCouponOrders(couponId: string) {
    if (couponOrders[couponId]) return;
    setCouponOrdersLoading((prev) => ({ ...prev, [couponId]: true }));
    try {
      const data = await apiFetch(`/api/admin/coupons/${couponId}/orders`);
      setCouponOrders((prev) => ({ ...prev, [couponId]: data.orders ?? [] }));
    } catch {
      setCouponOrders((prev) => ({ ...prev, [couponId]: [] }));
    } finally {
      setCouponOrdersLoading((prev) => ({ ...prev, [couponId]: false }));
    }
  }

  function toggleCouponExpand(couponId: string) {
    if (expandedCouponId === couponId) {
      setExpandedCouponId(null);
    } else {
      setExpandedCouponId(couponId);
      loadCouponOrders(couponId);
    }
  }

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }
      setAuthState("allowed");
      loadCoupons();
    }
    boot();
  }, []);

  async function loadCoupons() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/coupons");
      setCoupons(data.coupons ?? []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(couponData: Partial<Coupon>) {
    if (editingCoupon?.id) {
      await apiFetch("/api/admin/coupons", {
        method: "PATCH",
        body: JSON.stringify({ id: editingCoupon.id, ...couponData }),
      });
      setNotice("Coupon updated.");
    } else {
      await apiFetch("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify(couponData),
      });
      setNotice("Coupon created.");
    }
    setSheetOpen(false);
    setEditingCoupon(null);
    await loadCoupons();
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/coupons?id=${coupon.id}`, { method: "DELETE" });
      setNotice(`Coupon "${coupon.code}" deleted.`);
      await loadCoupons();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete coupon.");
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await apiFetch("/api/admin/coupons", {
        method: "PATCH",
        body: JSON.stringify({ id: coupon.id, active: !coupon.active }),
      });
      await loadCoupons();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update coupon.");
    }
  }

  const activeCoupons = coupons.filter((c) => c.active);
  const inactiveCoupons = coupons.filter((c) => !c.active);

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]"><a href="/admin"><img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" /><img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" /></a></div>
          <nav className="space-y-4">{adminNavGroups.map((group) => <div key={group.label}>{group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}<div className="space-y-0.5">{group.items.map(([label, Icon, href]) => <Link href={href} key={label} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}><Icon className="h-4 w-4" />{label}</Link>)}</div></div>)}</nav>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JW</div>
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">Jeremy Waters</div><div className="truncate text-[10px] text-muted-foreground">Owner - Super Admin</div></div>
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <span className="hidden text-xs text-muted-foreground md:block">Super Admin</span>
            <span className="hidden text-muted-foreground md:block text-xs">/</span>
            <span className="hidden text-xs font-medium text-foreground md:block">Coupons</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/coupons">Go to login</a></Button></CardContent></Card>}

          {authState === "allowed" && (
            <>
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Coupon codes</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Create and manage discount coupons for customers and manual orders.</p>
                </div>
                <Button onClick={() => { setEditingCoupon(null); setSheetOpen(true); }}>
                  <Plus className="h-4 w-4" />Create coupon
                </Button>
              </div>

              {notice && <div className="mb-4 rounded-lg border bg-secondary/35 px-3 py-2 text-sm text-muted-foreground">{notice}</div>}

              <section className="mb-4 grid gap-3 md:grid-cols-3">
                <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total coupons</div><div className="mt-2 text-[22px] font-semibold">{coupons.length}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active</div><div className="mt-2 text-[22px] font-semibold">{activeCoupons.length}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total uses</div><div className="mt-2 text-[22px] font-semibold">{coupons.reduce((s, c) => s + (c.uses_count || 0), 0)}</div></CardContent></Card>
              </section>

              {loading ? (
                <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading coupons...</CardContent></Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" />All coupons</CardTitle>
                    <CardDescription>Click the edit icon to modify a coupon, or toggle to activate/deactivate.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Code</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Restrictions</TableHead>
                          <TableHead>Uses</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="pr-4 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coupons.map((coupon) => {
                          const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
                          const isExhausted = coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses;
                          const isExpanded = expandedCouponId === coupon.id;
                          const orders = couponOrders[coupon.id] ?? [];
                          const ordersLoading = couponOrdersLoading[coupon.id];
                          return (
                            <>
                            <TableRow key={coupon.id} className="cursor-pointer hover:bg-accent/30" onClick={() => toggleCouponExpand(coupon.id)}>
                              <TableCell className="pl-4">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                  <div>
                                    <div className="font-mono text-sm font-semibold">{coupon.code}</div>
                                    {coupon.description && <div className="text-xs text-muted-foreground">{coupon.description}</div>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `${money.format(Number(coupon.discount_value))} off`}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {coupon.min_order_total ? `Min ${money.format(Number(coupon.min_order_total))}` : "No minimum"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {coupon.uses_count}{coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ""}
                                {isExhausted && <Badge className="ml-2 border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300 text-[10px]">Exhausted</Badge>}
                              </TableCell>
                              <TableCell className="text-sm">
                                {coupon.expires_at ? (
                                  <span className={cn(isExpired && "text-destructive")}>
                                    {new Date(coupon.expires_at).toLocaleDateString()}
                                    {isExpired && " (expired)"}
                                  </span>
                                ) : "Never"}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => toggleActive(coupon)} className={cn("rounded-full border px-2 py-0.5 text-xs font-medium transition-colors", coupon.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20" : "border-border bg-secondary text-muted-foreground hover:bg-accent")}>
                                  {coupon.active ? "Active" : "Inactive"}
                                </button>
                              </TableCell>
                              <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => { setEditingCoupon(coupon); setSheetOpen(true); }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => handleDelete(coupon)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${coupon.id}-orders`} className="bg-muted/20 hover:bg-muted/20">
                                <TableCell colSpan={7} className="px-6 pb-4 pt-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Orders using this coupon</div>
                                  {ordersLoading ? (
                                    <div className="text-sm text-muted-foreground">Loading orders...</div>
                                  ) : orders.length ? (
                                    <div className="space-y-1.5">
                                      {orders.map((order) => (
                                        <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2 text-sm">
                                          <div className="font-mono text-xs font-medium">#{order.order_number || order.id.slice(0, 8)}</div>
                                          <div className="min-w-0 flex-1 truncate text-muted-foreground">{order.customer_email || "Guest"}</div>
                                          <div className="text-emerald-600 dark:text-emerald-400 text-xs">-{money.format(Number(order.discount_amount || 0))}</div>
                                          <Badge className={cn("border text-xs", order.payment_status === "paid" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-secondary text-secondary-foreground")}>{human(order.payment_status)}</Badge>
                                          <div className="font-semibold">{money.format(Number(order.total || 0))}</div>
                                          <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</div>
                                        </div>
                                      ))}
                                      <div className="pt-1 text-xs text-muted-foreground">
                                        Total discount given: {money.format(orders.reduce((s, o) => s + Number(o.discount_amount || 0), 0))}
                                        &nbsp;&bull;&nbsp;Revenue from these orders: {money.format(orders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + Number(o.total || 0), 0))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">No orders have used this coupon yet.</div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                            </>
                          );
                        })}
                        {!coupons.length && (
                          <TableRow><TableCell colSpan={7} className="p-6 text-center text-muted-foreground">No coupons yet. Create one to get started.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </main>

        <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setEditingCoupon(null); }}>
          <SheetContent className="overflow-y-auto sm:max-w-[480px]">
            <SheetHeader>
              <SheetTitle>{editingCoupon ? `Edit: ${editingCoupon.code}` : "Create coupon"}</SheetTitle>
              <SheetDescription>
                {editingCoupon ? "Update the coupon settings below." : "Add a new discount coupon for customers and manual orders."}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <CouponForm
                initial={editingCoupon || undefined}
                onSave={handleSave}
                onCancel={() => { setSheetOpen(false); setEditingCoupon(null); }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
