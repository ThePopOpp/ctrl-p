"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, Calculator, ChevronRight, Moon, PackageCheck, Plus, Search, Send, Sun, Truck } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData, previewShippingRate, saveAdminShipment } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, Shipment } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const shipmentStatuses = ["label_created", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "delivered", "exception", "returned"];
const carriers = ["ups", "usps", "other"];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function dateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function statusTone(status: string | null | undefined) {
  if (["delivered"].includes(status || "")) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["shipped", "in_transit", "out_for_delivery", "ready_to_ship"].includes(status || "")) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (["exception", "returned"].includes(status || "")) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

export function AdminShipping() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }
      setAuthState("allowed");
      setData(await loadAdminDashboardData());
    }
    boot();
  }, []);

  async function refresh(openShipmentId?: string) {
    const next = await loadAdminDashboardData();
    setData(next);
    if (openShipmentId) setSelectedShipment(next.shipments.find((shipment) => shipment.id === openShipmentId) ?? null);
  }

  const orders = data?.orders ?? [];
  const shipments = data?.shipments ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const products = data?.products ?? [];
  const orderItems = data?.orderItems ?? [];
  const artworkFiles = data?.artworkFiles ?? [];
  const proofs = data?.proofs ?? [];
  const productionJobs = data?.productionJobs ?? [];

  const visibleShipments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shipments;
    return shipments.filter((shipment) => {
      const order = orders.find((item) => item.id === shipment.order_id);
      return [shipment.carrier, shipment.tracking_number, shipment.status, order?.order_number, order?.customer_email, order?.company, order?.users?.full_name].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [orders, query, shipments]);

  const readyOrders = orders.filter((order) => ["ready", "completed"].includes(order.production_status) || ["ready_to_ship", "ready_for_pickup"].includes(order.status));
  const inTransit = shipments.filter((shipment) => ["shipped", "in_transit", "out_for_delivery"].includes(shipment.status || ""));
  const delivered = shipments.filter((shipment) => shipment.status === "delivered");
  const exceptions = shipments.filter((shipment) => ["exception", "returned"].includes(shipment.status || ""));

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-4 flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div><div><div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div><div className="text-sm font-semibold">Super Admin</div></div></div>
          <nav className="space-y-4">{adminNavGroups.map((group) => <div key={group.label}><div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div><div className="space-y-0.5">{group.items.map(([label, Icon, href]) => <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}><Icon className="h-4 w-4" />{label}{label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}{label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}{label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}</Link>)}</div></div>)}</nav>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]"><div className="flex h-12 items-center gap-3 px-5"><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Super Admin</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">Shipping</span></div><div className="ml-auto flex items-center gap-2"><div className="relative hidden w-[380px] md:block"><Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search tracking, orders, customers..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button></div></div></header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/shipments">Go to login</a></Button></CardContent></Card>}
          {authState === "allowed" && <>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h1 className="text-[25px] font-semibold tracking-tight">Shipping command center</h1><p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Create USPS and UPS shipping records, quote rates, add tracking, and notify customers while keeping orders, payments, products, artwork, proofs, and production connected.</p></div><div className="flex gap-2"><Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add tracking</Button><Button variant="outline" onClick={() => setQuoteOpen(true)}><Calculator className="h-4 w-4" /> Shipping quote</Button></div></div>
            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><ShippingStat label="Ready" value={String(readyOrders.length)} hint="Orders ready to ship" /><ShippingStat label="Shipments" value={String(shipments.length)} hint="Tracking records" /><ShippingStat label="In transit" value={String(inTransit.length)} hint="USPS / UPS moving" /><ShippingStat label="Delivered" value={String(delivered.length)} hint="Completed deliveries" /><ShippingStat label="Exceptions" value={String(exceptions.length)} hint="Needs follow-up" /></section>
            <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
              <Card><CardHeader className="pb-3"><CardTitle className="text-base">Tracking activity</CardTitle><CardDescription>Click a shipment to update tracking and status.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="pl-4">Tracking</TableHead><TableHead>Order / customer</TableHead><TableHead>Carrier</TableHead><TableHead>Status</TableHead><TableHead>ETA</TableHead><TableHead className="pr-4">Shipped</TableHead></TableRow></TableHeader><TableBody>{visibleShipments.map((shipment) => { const order = orders.find((item) => item.id === shipment.order_id); return <TableRow key={shipment.id} className="cursor-pointer hover:bg-accent/45" onClick={() => setSelectedShipment(shipment)}><TableCell className="pl-4"><div className="font-mono text-xs">{shipment.tracking_number || "No tracking"}</div><div className="text-xs text-muted-foreground">{shipment.tracking_url ? "Tracking link ready" : "No link"}</div></TableCell><TableCell><div className="font-mono text-xs">#{order?.order_number || shipment.order_id.slice(0, 8)}</div><div className="text-xs text-muted-foreground">{order?.users?.full_name || order?.company || order?.customer_email || "Customer not linked"}</div></TableCell><TableCell>{human(shipment.carrier)}</TableCell><TableCell><Badge className={cn("border", statusTone(shipment.status))}>{human(shipment.status)}</Badge></TableCell><TableCell>{formatDate(shipment.estimated_delivery_at)}</TableCell><TableCell className="pr-4">{formatDate(shipment.shipped_at)}</TableCell></TableRow>; })}{!visibleShipments.length && <TableRow><TableCell colSpan={6} className="p-6 text-center text-muted-foreground">No shipments found.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
              <div className="space-y-4"><Card><CardHeader className="pb-3"><CardTitle className="text-base">Connected operations</CardTitle></CardHeader><CardContent className="space-y-2"><MiniRow title="Products" detail="Shipping uses product weight and dimensions next" value={String(products.length)} /><MiniRow title="Artwork/proofs" detail="Proofed orders move to shipping" value={String(artworkFiles.length + proofs.length)} /><MiniRow title="Production" detail="Ready jobs become shipment candidates" value={String(productionJobs.length)} /><MiniRow title="Payments" detail="Paid orders are safest to ship" value={String(payments.length)} /></CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="text-base">Carrier setup</CardTitle><CardDescription>Use env vars for live prices</CardDescription></CardHeader><CardContent className="space-y-2"><MiniRow title="UPS" detail="UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER" value="Ready" /><MiniRow title="USPS" detail="USPS_CLIENT_ID, USPS_CLIENT_SECRET" value="Ready" /></CardContent></Card></div>
            </section>
          </>}
        </main>

        <ShipmentSheet open={createOpen || Boolean(selectedShipment)} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setSelectedShipment(null); } }} shipment={selectedShipment} data={data} onSaved={refresh} />
        <RateSheet open={quoteOpen} onOpenChange={setQuoteOpen} />
      </div>
    </div>
  );
}

function ShippingStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function ShipmentSheet({ open, onOpenChange, shipment, data, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; shipment: Shipment | null; data: AdminDashboardData | null; onSaved: (id?: string) => Promise<void> }) {
  const orders = data?.orders ?? [];
  const [orderId, setOrderId] = useState("none");
  const [carrier, setCarrier] = useState("ups");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [status, setStatus] = useState("label_created");
  const [shippedAt, setShippedAt] = useState("");
  const [eta, setEta] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrderId(shipment?.order_id || orders[0]?.id || "none");
    setCarrier(shipment?.carrier || "ups");
    setTrackingNumber(shipment?.tracking_number || "");
    setTrackingUrl(shipment?.tracking_url || "");
    setStatus(shipment?.status || "label_created");
    setShippedAt(dateInput(shipment?.shipped_at));
    setEta(dateInput(shipment?.estimated_delivery_at));
    setDeliveredAt(dateInput(shipment?.delivered_at));
    setMessage("");
  }, [open, orders, shipment]);

  const selectedOrder = orders.find((order) => order.id === orderId);

  async function save() {
    if (orderId === "none") {
      setMessage("Select an order before saving tracking.");
      return;
    }
    setSaving(true);
    setMessage("Saving shipment...");
    try {
      const next = await saveAdminShipment({ shipmentId: shipment?.id, orderId, carrier, trackingNumber, trackingUrl, status, shippedAt, estimatedDeliveryAt: eta, deliveredAt, notifyEmail, notifySms });
      await onSaved(next.id);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save shipment.");
    } finally {
      setSaving(false);
    }
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="overflow-y-auto sm:max-w-[60rem]"><SheetHeader><SheetTitle>{shipment ? "Update tracking" : "Add tracking"}</SheetTitle><SheetDescription>Connect tracking to the customer, order, products, payments, production, artwork, and messages.</SheetDescription></SheetHeader><div className="mt-6 space-y-4"><div className="grid gap-3 sm:grid-cols-3"><FieldSelect label="Order" value={orderId} onChange={setOrderId} items={orders.map((order) => ({ value: order.id, label: `#${order.order_number || order.id.slice(0, 8)} - ${order.users?.full_name || order.customer_email || "Customer"}` }))} placeholder="Select order" /><FieldSelect label="Carrier" value={carrier} onChange={setCarrier} items={carriers.map((item) => ({ value: item, label: human(item) }))} /><FieldSelect label="Status" value={status} onChange={setStatus} items={shipmentStatuses.map((item) => ({ value: item, label: human(item) }))} /></div><div className="grid gap-3 sm:grid-cols-2"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Tracking number</div><Input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Tracking URL</div><Input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="Auto-created for UPS/USPS if blank" /></div></div><div className="grid gap-3 sm:grid-cols-3"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Shipped date</div><Input type="date" value={shippedAt} onChange={(event) => setShippedAt(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Estimated delivery</div><Input type="date" value={eta} onChange={(event) => setEta(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Delivered date</div><Input type="date" value={deliveredAt} onChange={(event) => setDeliveredAt(event.target.value)} /></div></div><div className="grid gap-3 sm:grid-cols-2"><LinkedMeta label="Customer" value={selectedOrder?.users?.full_name || selectedOrder?.company || selectedOrder?.customer_email || "Not selected"} subvalue={selectedOrder?.customer_phone || selectedOrder?.customer_email || undefined} /><LinkedMeta label="Payment / production" value={selectedOrder ? `${human(selectedOrder.payment_status)} / ${human(selectedOrder.production_status)}` : "Not selected"} subvalue="Shipping update syncs order status" /></div><div className="flex flex-wrap gap-2"><Button type="button" variant={notifyEmail ? "default" : "outline"} onClick={() => setNotifyEmail(!notifyEmail)}><Send className="h-4 w-4" /> Email tracking</Button><Button type="button" variant={notifySms ? "default" : "outline"} onClick={() => setNotifySms(!notifySms)}><Send className="h-4 w-4" /> SMS tracking</Button></div>{message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}<div className="flex gap-2"><Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save tracking"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button></div></div></SheetContent></Sheet>;
}

function RateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [carrier, setCarrier] = useState("ups");
  const [service, setService] = useState("Ground");
  const [weight, setWeight] = useState("2");
  const [length, setLength] = useState("12");
  const [width, setWidth] = useState("9");
  const [height, setHeight] = useState("3");
  const [fromZip, setFromZip] = useState("85226");
  const [toZip, setToZip] = useState("");
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(false);

  async function quoteRate() {
    setLoading(true);
    setQuote("Quoting shipping...");
    try {
      const result = await previewShippingRate({ carrier, service, weightLbs: Number(weight), lengthIn: Number(length), widthIn: Number(width), heightIn: Number(height), postalCodeFrom: fromZip, postalCodeTo: toZip });
      setQuote(`${result.rate.carrier.toUpperCase()} ${result.rate.service}: $${result.rate.amount.toFixed(2)} ${result.rate.currency}, about ${result.rate.estimatedDays} days. ${result.rate.note}`);
    } catch (error) {
      setQuote(error instanceof Error ? error.message : "Could not quote shipping.");
    } finally {
      setLoading(false);
    }
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="overflow-y-auto sm:max-w-[60rem]"><SheetHeader><SheetTitle>Shipping quote</SheetTitle><SheetDescription>Estimate UPS or USPS pricing. Add carrier API credentials for live rates in the next integration step.</SheetDescription></SheetHeader><div className="mt-6 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><FieldSelect label="Carrier" value={carrier} onChange={setCarrier} items={["ups", "usps"].map((item) => ({ value: item, label: human(item) }))} /><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Service</div><Input value={service} onChange={(event) => setService(event.target.value)} /></div></div><div className="grid gap-3 sm:grid-cols-4"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Weight lbs</div><Input value={weight} onChange={(event) => setWeight(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Length</div><Input value={length} onChange={(event) => setLength(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Width</div><Input value={width} onChange={(event) => setWidth(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Height</div><Input value={height} onChange={(event) => setHeight(event.target.value)} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">From ZIP</div><Input value={fromZip} onChange={(event) => setFromZip(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">To ZIP</div><Input value={toZip} onChange={(event) => setToZip(event.target.value)} /></div></div>{quote && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{quote}</div>}<div className="flex gap-2"><Button onClick={quoteRate} disabled={loading}><Calculator className="h-4 w-4" /> {loading ? "Quoting..." : "Quote shipping"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div></div></SheetContent></Sheet>;
}

function MiniRow({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
}

function FieldSelect({ label, value, onChange, items, placeholder }: { label: string; value: string; onChange: (value: string) => void; items: { value: string; label: string }[]; placeholder?: string }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{placeholder && <SelectItem value="none">{placeholder}</SelectItem>}{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}

function LinkedMeta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return <div className="rounded-lg border bg-secondary/25 px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm font-medium">{value}</div>{subvalue && <div className="mt-1 break-words text-xs text-muted-foreground">{subvalue}</div>}</div>;
}
