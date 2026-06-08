"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, MessageSquare, Package, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  CustomerShell,
  EmptyState,
  StatusBadge,
  amount,
  fmtDate,
  human,
  useCustomerSession,
} from "@/components/dashboard/customer-shell";

export function CustomerOrders() {
  const { data, state, errorMessage, theme, setTheme, messages, setMessages, bookings, getToken, signOut } = useCustomerSession();
  const [query, setQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  async function openNotifications() {
    setNotifOpen((o) => !o);
    const unread = messages.filter((m) => !m.read_at && m.direction === "outbound");
    if (!unread.length) return;
    setMessages((prev) => prev.map((m) => (!m.read_at && m.direction === "outbound" ? { ...m, read_at: new Date().toISOString() } : m)));
    const token = await getToken();
    if (!token) return;
    await fetch("/api/dashboard/customer/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: unread.map((m) => m.id) }),
    }).catch(() => null);
  }

  const orders = data?.orders ?? [];
  const orderItems = data?.orderItems ?? [];
  const payments = data?.payments ?? [];
  const shipments = data?.shipments ?? [];

  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, typeof orderItems>();
    for (const item of orderItems) {
      const list = map.get(item.order_id) ?? [];
      list.push(item);
      map.set(item.order_id, list);
    }
    return map;
  }, [orderItems]);

  const visibleOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((o) =>
      !needle || [o.order_number, o.status, o.production_status, o.payment_status].some((v) => String(v || "").toLowerCase().includes(needle))
    );
  }, [orders, query]);

  function openComposeForOrder(orderId: string, subject: string, body?: string) {
    const params = new URLSearchParams({ orderId, subject });
    if (body) params.set("body", body);
    window.location.href = `/dashboard/customer/messages?${params.toString()}`;
  }

  return (
    <CustomerShell
      profile={data?.profile}
      unreadCount={unreadMessages.length}
      upcomingBookingsCount={upcomingBookings.length}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      onSignOut={signOut}
      activePage="Orders"
      state={state}
      errorMessage={errorMessage}
      messages={messages}
      onOpenNotifications={openNotifications}
      notifOpen={notifOpen}
      notifRef={notifRef}
      onCloseNotif={() => setNotifOpen(false)}
      searchQuery={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search orders, status..."
    >
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Orders</CardTitle>
                <CardDescription>Click any row to see line items and details.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/customer">← Overview</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6 pl-4" />
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="hidden md:table-cell">Production</TableHead>
                  <TableHead className="hidden sm:table-cell">Due</TableHead>
                  <TableHead className="pr-4 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const items = itemsByOrder.get(order.id) ?? [];
                  return (
                    <>
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-accent/40"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        <TableCell className="pl-4 text-muted-foreground">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">#{order.order_number || order.id.slice(0, 8)}</TableCell>
                        <TableCell><StatusBadge value={order.status} /></TableCell>
                        <TableCell><StatusBadge value={order.payment_status} /></TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{human(order.production_status)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{fmtDate(order.due_at)}</TableCell>
                        <TableCell className="pr-4 text-right font-semibold">{amount(order.total)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${order.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="px-4 pb-4 pt-2">
                            {items.length > 0 && (
                              <div className="mb-3">
                                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Items</div>
                                <div className="space-y-1.5">
                                  {items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border bg-background/60 px-3 py-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="font-medium">{item.products?.name || "Item"}</span>
                                        {item.products?.category && <span className="text-xs text-muted-foreground">· {item.products.category}</span>}
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-muted-foreground">×{item.quantity ?? 1}</span>
                                        <span>{amount(item.line_total ?? (Number(item.unit_price || 0) * Number(item.quantity || 1)))}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Order details</div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between"><span className="text-muted-foreground">Placed</span><span>{fmtDate(order.created_at)}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Est. completion</span><span>{fmtDate(order.due_at)}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Production</span><span>{human(order.production_status)}</span></div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Shipping</span>
                                    <span>{shipments.find((s) => s.order_id === order.id) ? human(shipments.find((s) => s.order_id === order.id)!.status || "pending") : "Not shipped"}</span>
                                  </div>
                                  {Number((order as unknown as Record<string, unknown>).discount_amount || 0) > 0 && (
                                    <>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{amount((order as unknown as Record<string, unknown>).subtotal as number | string | null | undefined)}</span></div>
                                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Discount</span><span>-{amount((order as unknown as Record<string, unknown>).discount_amount as number | string | null | undefined)}</span></div>
                                    </>
                                  )}
                                </div>
                              </div>
                              {order.customer_notes && (
                                <div>
                                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
                                  <div className="rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">{order.customer_notes}</div>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openComposeForOrder(order.id, `Question about order #${order.order_number || order.id.slice(0, 8)}`)}>
                                <MessageSquare className="h-3.5 w-3.5" />Message support
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openComposeForOrder(order.id, `Reorder request — #${order.order_number || order.id.slice(0, 8)}`, `Hi, I'd like to reorder #${order.order_number || order.id.slice(0, 8)}. Please confirm availability and pricing.`)}>
                                <RotateCcw className="h-3.5 w-3.5" />Request reorder
                              </Button>
                              {(() => {
                                const pmt = payments.find((p) => p.order_id === order.id && p.payment_link_url);
                                return pmt ? (
                                  <Button size="sm" variant="outline" className="gap-1.5" asChild>
                                    <a href={pmt.payment_link_url!} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" />Receipt</a>
                                  </Button>
                                ) : null;
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                {!visibleOrders.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-6 text-center text-muted-foreground">
                      {query ? "No orders match your search." : "No orders yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </CustomerShell>
  );
}
