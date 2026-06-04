"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight, Moon, Search, Send, Sun, Upload } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData, updateAdminArtworkReview, uploadAdminArtwork } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, ArtworkFile, Proof } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const reviewStatuses = ["waiting_for_file_review", "needs_changes", "proof_sent", "approved", "rejected", "in_production"];

type ArtworkRecord =
  | { kind: "artwork"; id: string; artwork: ArtworkFile; proof?: never }
  | { kind: "proof"; id: string; proof: Proof; artwork?: never };

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)).replace(",", "");
}

function fileSize(value: number | string | null | undefined) {
  const bytes = Number(value || 0);
  if (!bytes) return "Unknown";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function statusTone(status: string) {
  if (["approved", "in_production"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["proof_sent", "waiting_for_file_review"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (["needs_changes", "rejected"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

export function AdminArtwork() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ArtworkRecord | null>(null);

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

  async function refresh(openRecord?: { kind: "artwork" | "proof"; id: string }) {
    const next = await loadAdminDashboardData();
    setData(next);
    if (openRecord?.kind === "artwork") {
      const artwork = next.artworkFiles.find((item) => item.id === openRecord.id);
      setSelectedRecord(artwork ? { kind: "artwork", id: artwork.id, artwork } : null);
    }
    if (openRecord?.kind === "proof") {
      const proof = next.proofs.find((item) => item.id === openRecord.id);
      setSelectedRecord(proof ? { kind: "proof", id: proof.id, proof } : null);
    }
  }

  const orders = data?.orders ?? [];
  const orderItems = data?.orderItems ?? [];
  const users = data?.users ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const jobs = data?.productionJobs ?? [];
  const artworkFiles = data?.artworkFiles ?? [];
  const proofs = data?.proofs ?? [];
  const drafts = data?.designDrafts ?? [];
  const products = data?.products ?? [];

  const records: ArtworkRecord[] = useMemo(() => [
    ...artworkFiles.map((artwork) => ({ kind: "artwork" as const, id: artwork.id, artwork })),
    ...proofs.map((proof) => ({ kind: "proof" as const, id: proof.id, proof })),
  ].sort((a, b) => {
    const aDate = a.kind === "artwork" ? a.artwork.created_at : a.proof.created_at;
    const bDate = b.kind === "artwork" ? b.artwork.created_at : b.proof.created_at;
    return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime();
  }), [artworkFiles, proofs]);

  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => {
      const link = getRecordLinks(record, { orders, orderItems, users });
      return [
        record.kind,
        record.kind === "artwork" ? record.artwork.filename : `Proof v${record.proof.revision_number || 1}`,
        record.kind === "artwork" ? record.artwork.review_status : record.proof.status,
        link.order?.order_number,
        link.user?.full_name,
        link.user?.email,
        link.item?.products?.name,
        link.item?.products?.category,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [orderItems, orders, query, records, users]);

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-5 px-2">
            <a href="/admin">
              <img src="/logos/logo-lime-light.svg" alt="ControlP.io" className="h-auto w-[140px] dark:hidden" />
              <img src="/logos/logo-lime-dark.svg" alt="ControlP.io" className="hidden h-auto w-[140px] dark:block" />
            </a>
            <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Super Admin</div>
          </div>
          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}>
                      <Icon className="h-4 w-4" />{label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Super Admin</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">Artwork</span></div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block"><Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search artwork, proofs, customers..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/artwork">Go to login</a></Button></CardContent></Card>}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Artwork and proof command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Review customer uploads, send proofs, monitor design drafts, and connect files to customers, orders, products, payments, production, messages, and shipping handoff.</p>
                </div>
                <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /> Upload proof</Button>
              </div>

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <ArtworkStat label="Files" value={String(artworkFiles.length)} hint="Customer and admin uploads" />
                <ArtworkStat label="Proofs" value={String(proofs.length)} hint="Approval documents" />
                <ArtworkStat label="Needs review" value={String(artworkFiles.filter((item) => item.review_status === "waiting_for_file_review").length)} hint="Prepress queue" />
                <ArtworkStat label="Design drafts" value={String(drafts.length)} hint="Online designer saves" />
                <ArtworkStat label="Approved" value={String(artworkFiles.filter((item) => item.review_status === "approved").length + proofs.filter((item) => item.status === "approved").length)} hint="Ready for production" />
              </section>

              <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Artwork queue</CardTitle><CardDescription>Click a file or proof to review details and update approval status.</CardDescription></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead className="pl-4">File / proof</TableHead><TableHead>Order / customer</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Size</TableHead><TableHead className="pr-4">Created</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {visibleRecords.map((record) => {
                          const link = getRecordLinks(record, { orders, orderItems, users });
                          const title = record.kind === "artwork" ? record.artwork.filename : `Proof v${record.proof.revision_number || 1}`;
                          const status = record.kind === "artwork" ? record.artwork.review_status || "waiting_for_file_review" : record.proof.status || "proof_sent";
                          return (
                            <TableRow key={`${record.kind}-${record.id}`} className="cursor-pointer hover:bg-accent/45" onClick={() => setSelectedRecord(record)}>
                              <TableCell className="pl-4"><div className="font-medium">{title}</div><div className="text-xs text-muted-foreground">{human(record.kind)}</div></TableCell>
                              <TableCell><div className="font-mono text-xs">#{link.order?.order_number || "No order"}</div><div className="text-xs text-muted-foreground">{link.user?.full_name || link.order?.customer_email || "Customer not linked"}</div></TableCell>
                              <TableCell><div className="font-medium">{link.item?.products?.name || "No product"}</div><div className="text-xs text-muted-foreground">{link.item?.products?.category || "No category"}</div></TableCell>
                              <TableCell><Badge className={cn("border", statusTone(status))}>{human(status)}</Badge></TableCell>
                              <TableCell>{record.kind === "artwork" ? fileSize(record.artwork.file_size_bytes) : `Revision ${record.proof.revision_number || 1}`}</TableCell>
                              <TableCell className="pr-4">{formatDate(record.kind === "artwork" ? record.artwork.created_at : record.proof.created_at)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {!visibleRecords.length && <TableRow><TableCell colSpan={6} className="p-6 text-center text-muted-foreground">No artwork or proofs found.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card><CardHeader className="pb-3"><CardTitle className="text-base">Design queue</CardTitle><CardDescription>Saved online designer work</CardDescription></CardHeader><CardContent className="space-y-2">{drafts.slice(0, 6).map((draft) => {
                    const user = users.find((item) => item.id === draft.user_id);
                    const product = products.find((item) => item.id === draft.product_id);
                    return <MiniRow key={draft.id} title={draft.title || "Untitled design"} detail={`${user?.full_name || user?.email || "Customer"} - ${product?.name || "Product"}`} value={formatDate(draft.last_saved_at)} />;
                  })}{!drafts.length && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No saved drafts yet.</div>}</CardContent></Card>
                  <Card><CardHeader className="pb-3"><CardTitle className="text-base">Operational links</CardTitle></CardHeader><CardContent className="space-y-2">
                    <MiniRow title="Production jobs" detail="Artwork statuses update matching jobs" value={String(jobs.length)} />
                    <MiniRow title="Messages" detail="Proof uploads create dashboard notices" value={String(messages.length)} />
                    <MiniRow title="Payments" detail="Connected through order records" value={String(payments.length)} />
                  </CardContent></Card>
                </div>
              </section>
            </>
          )}
        </main>

        <UploadArtworkSheet open={uploadOpen} onOpenChange={setUploadOpen} data={data} onUploaded={refresh} />
        <ArtworkReviewSheet record={selectedRecord} data={data} open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)} onSaved={refresh} />
      </div>
    </div>
  );
}

function getRecordLinks(record: ArtworkRecord, data: { orders: AdminDashboardData["orders"]; orderItems: AdminDashboardData["orderItems"]; users: AdminDashboardData["users"] }) {
  const orderItemId = record.kind === "artwork" ? record.artwork.order_item_id : record.proof.order_item_id;
  const item = data.orderItems.find((line) => line.id === orderItemId) ?? null;
  const orderId = record.kind === "artwork" ? record.artwork.order_id || item?.order_id : item?.order_id;
  const order = data.orders.find((candidate) => candidate.id === orderId) ?? null;
  const userId = record.kind === "artwork" ? record.artwork.user_id || order?.user_id : order?.user_id;
  const user = data.users.find((candidate) => candidate.id === userId) ?? null;
  return { item, order, user };
}

function ArtworkStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function MiniRow({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
}

function UploadArtworkSheet({ open, onOpenChange, data, onUploaded }: { open: boolean; onOpenChange: (open: boolean) => void; data: AdminDashboardData | null; onUploaded: (record?: { kind: "artwork" | "proof"; id: string }) => Promise<void> }) {
  const orders = data?.orders ?? [];
  const orderItems = data?.orderItems ?? [];
  const users = data?.users ?? [];
  const [mode, setMode] = useState<"artwork" | "proof">("proof");
  const [orderId, setOrderId] = useState("none");
  const [orderItemId, setOrderItemId] = useState("none");
  const [status, setStatus] = useState("proof_sent");
  const [file, setFile] = useState<File | null>(null);
  const [dpi, setDpi] = useState("");
  const [colorMode, setColorMode] = useState("CMYK");
  const [adminComments, setAdminComments] = useState("");
  const [customerComments, setCustomerComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrderId(orders[0]?.id || "none");
    setOrderItemId("none");
    setStatus(mode === "proof" ? "proof_sent" : "waiting_for_file_review");
    setMessage("");
  }, [mode, open, orders]);

  const selectedOrder = orders.find((order) => order.id === orderId);
  const selectedItems = orderItems.filter((item) => item.order_id === orderId);
  const selectedUser = users.find((user) => user.id === selectedOrder?.user_id);

  async function upload() {
    if (!file || orderId === "none" || orderItemId === "none") {
      setMessage("Choose an order, line item, and file before uploading.");
      return;
    }
    setSaving(true);
    setMessage("Uploading file...");
    try {
      const result = await uploadAdminArtwork({
        mode,
        file,
        orderId,
        orderItemId,
        userId: selectedOrder?.user_id || "",
        status,
        adminComments,
        customerComments,
        dpi,
        colorMode,
      });
      const uploaded = result.proof ? { kind: "proof" as const, id: result.proof.id } : result.artwork ? { kind: "artwork" as const, id: result.artwork.id } : undefined;
      await onUploaded(uploaded);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload file.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader><SheetTitle>Upload artwork or proof</SheetTitle><SheetDescription>Add customer artwork or a proof PDF/image and connect it to the order, customer, product, and production queue.</SheetDescription></SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Type" value={mode} onChange={(value) => setMode(value as "artwork" | "proof")} items={[{ value: "proof", label: "Proof" }, { value: "artwork", label: "Artwork file" }]} />
            <FieldSelect label="Order" value={orderId} onChange={(value) => { setOrderId(value); setOrderItemId("none"); }} items={orders.map((order) => ({ value: order.id, label: `#${order.order_number || order.id.slice(0, 8)} - ${order.users?.full_name || order.customer_email || "Customer"}` }))} placeholder="Select order" />
            <FieldSelect label="Line item / product" value={orderItemId} onChange={setOrderItemId} items={selectedItems.map((item) => ({ value: item.id, label: `${item.products?.name || "Product"} - Qty ${item.quantity || 1}` }))} placeholder="Select line item" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Review status" value={status} onChange={setStatus} items={reviewStatuses.map((item) => ({ value: item, label: human(item) }))} />
            <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">DPI</div><Input value={dpi} onChange={(event) => setDpi(event.target.value)} placeholder="300" /></div>
            <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Color mode</div><Input value={colorMode} onChange={(event) => setColorMode(event.target.value)} placeholder="CMYK" /></div>
          </div>
          <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">File</div><Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><LinkedMeta label="Customer" value={selectedUser?.full_name || selectedOrder?.customer_email || "Not selected"} subvalue={selectedOrder?.customer_phone || selectedUser?.email || undefined} /><LinkedMeta label="Order status" value={selectedOrder ? `${human(selectedOrder.status)} / ${human(selectedOrder.production_status)}` : "Not selected"} subvalue="Artwork updates production status automatically" /></div>
          <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Admin notes</div><Textarea value={adminComments} onChange={(event) => setAdminComments(event.target.value)} placeholder="Proof notes, file issues, bleed, DPI, color, finishing details..." /></div>
          <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer-facing comments</div><Textarea value={customerComments} onChange={(event) => setCustomerComments(event.target.value)} placeholder="Optional note visible to customer." /></div>
          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}
          <div className="flex gap-2"><Button className="flex-1" onClick={upload} disabled={saving}>{saving ? "Uploading..." : mode === "proof" ? "Upload and send proof" : "Upload artwork"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ArtworkReviewSheet({ record, data, open, onOpenChange, onSaved }: { record: ArtworkRecord | null; data: AdminDashboardData | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (record?: { kind: "artwork" | "proof"; id: string }) => Promise<void> }) {
  const [status, setStatus] = useState("waiting_for_file_review");
  const [adminComments, setAdminComments] = useState("");
  const [customerComments, setCustomerComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const links = record && data ? getRecordLinks(record, data) : null;

  useEffect(() => {
    if (!record) return;
    setStatus(record.kind === "artwork" ? record.artwork.review_status || "waiting_for_file_review" : record.proof.status || "proof_sent");
    setAdminComments(record.kind === "artwork" ? record.artwork.admin_comments || "" : record.proof.admin_comments || "");
    setCustomerComments(record.kind === "artwork" ? record.artwork.customer_comments || "" : record.proof.customer_comments || "");
    setMessage("");
  }, [record]);

  async function save() {
    if (!record) return;
    setSaving(true);
    setMessage("Saving review...");
    try {
      await updateAdminArtworkReview({ type: record.kind, id: record.id, status, adminComments, customerComments });
      await onSaved({ kind: record.kind, id: record.id });
      setMessage("Review saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save review.");
    } finally {
      setSaving(false);
    }
  }

  if (!record) return null;
  const title = record.kind === "artwork" ? record.artwork.filename : `Proof v${record.proof.revision_number || 1}`;
  const path = record.kind === "artwork" ? record.artwork.storage_path : record.proof.storage_path;
  const proofUrl = record.kind === "proof" ? record.proof.proof_url : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{human(record.kind)} connected to {links?.order?.order_number ? `order #${links.order.order_number}` : "an order line item"}</SheetDescription></SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><LinkedMeta label="Customer" value={links?.user?.full_name || links?.order?.customer_email || "Not linked"} subvalue={links?.user?.company || links?.order?.customer_phone || undefined} /><LinkedMeta label="Product" value={links?.item?.products?.name || "No product"} subvalue={links?.item?.products?.category || undefined} /><LinkedMeta label="Storage" value={path} subvalue={record.kind === "artwork" ? fileSize(record.artwork.file_size_bytes) : proofUrl} /></div>
          <FieldSelect label="Review status" value={status} onChange={setStatus} items={reviewStatuses.map((item) => ({ value: item, label: human(item) }))} />
          <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Admin notes</div><Textarea value={adminComments} onChange={(event) => setAdminComments(event.target.value)} /></div>
          <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer-facing comments</div><Textarea value={customerComments} onChange={(event) => setCustomerComments(event.target.value)} /></div>
          {proofUrl && <Button variant="outline" asChild><a href={proofUrl} target="_blank" rel="noreferrer">Open proof</a></Button>}
          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}
          <div className="flex gap-2"><Button onClick={save} disabled={saving}><Send className="h-4 w-4" /> {saving ? "Saving..." : "Save review"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldSelect({ label, value, onChange, items, placeholder }: { label: string; value: string; onChange: (value: string) => void; items: { value: string; label: string }[]; placeholder?: string }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{placeholder && <SelectItem value="none">{placeholder}</SelectItem>}{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}

function LinkedMeta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return <div className="rounded-lg border bg-secondary/25 px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm font-medium">{value}</div>{subvalue && <div className="mt-1 break-words text-xs text-muted-foreground">{subvalue}</div>}</div>;
}
