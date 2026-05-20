"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Image, LogOut, MessageSquare, Palette, Save, Search, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type DesignerJob = {
  id: string;
  order_id: string;
  order_item_id: string | null;
  status: string;
  priority: number | null;
  station: string | null;
  due_at: string | null;
  notes: string | null;
  orders?: { order_number?: string | null; status?: string | null; production_status?: string | null; payment_status?: string | null; due_at?: string | null } | null;
  order_items?: { quantity?: number | null; products?: { name?: string | null; category?: string | null } | null } | null;
};

type DesignerArtwork = {
  id: string;
  order_id: string | null;
  order_item_id: string | null;
  filename: string;
  review_status?: string | null;
  proof_version?: number | null;
  admin_comments?: string | null;
  customer_comments?: string | null;
  created_at: string | null;
};

type DesignerProof = {
  id: string;
  order_item_id: string;
  proof_url: string | null;
  revision_number: number | null;
  status?: string | null;
  customer_comments?: string | null;
  admin_comments?: string | null;
  sent_at: string | null;
  customer_approved_at: string | null;
  created_at: string | null;
};

type DesignerData = {
  profile: { full_name: string | null; email: string | null; company: string | null };
  jobs: DesignerJob[];
  artworkFiles: DesignerArtwork[];
  proofs: DesignerProof[];
  messages: { id: string; subject: string | null; body: string | null; channel: string; created_at: string | null }[];
};

const navItems: { label: string; icon: LucideIcon }[] = [
  { label: "Queue", icon: Palette },
  { label: "Artwork", icon: Image },
  { label: "Proofs", icon: FileCheck2 },
  { label: "Messages", icon: MessageSquare },
];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function tone(value: string | null | undefined) {
  const status = String(value || "");
  if (["approved", "proof_approved", "print_ready", "completed"].includes(status)) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["needs_changes", "rejected", "on_hold"].includes(status)) return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
}

async function token() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Sign in again before using the designer dashboard.");
  return session.access_token;
}

export function DesignerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DesignerData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ type: "job" | "artwork" | "proof"; record: DesignerJob | DesignerArtwork | DesignerProof } | null>(null);

  async function load() {
    const db = getSupabaseBrowserClient();
    const session = db ? (await db.auth.getSession()).data.session : null;
    if (!session?.access_token) {
      router.replace("/login?redirect=/dashboard/designer");
      return;
    }
    const response = await fetch("/api/dashboard/designer", { headers: { authorization: `Bearer ${session.access_token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Could not load designer dashboard.");
      setState("denied");
      return;
    }
    setData(payload as DesignerData);
    setState("ready");
  }

  useEffect(() => { load(); }, []);

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  const jobs = data?.jobs ?? [];
  const artwork = data?.artworkFiles ?? [];
  const proofs = data?.proofs ?? [];
  const messages = data?.messages ?? [];
  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => !needle || [job.orders?.order_number, job.status, job.order_items?.products?.name, job.station].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [jobs, query]);

  return <div className="dark min-h-screen bg-background text-foreground"><aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block"><div className="mb-5 flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div><div><div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div><div className="text-sm font-semibold">Designer</div></div></div><nav className="space-y-1">{navItems.map(({ label, icon: Icon }) => <a key={label} href={`#${label.toLowerCase()}`} className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"><Icon className="h-4 w-4" />{label}</a>)}</nav></aside><header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]"><div className="flex h-12 items-center gap-3 px-5"><div className="text-xs text-muted-foreground">Designer <span className="mx-2">/</span><span className="font-medium text-foreground">Dashboard</span></div><div className="ml-auto flex items-center gap-2"><div className="relative hidden w-[360px] md:block"><Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search jobs, proofs, artwork..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button variant="outline" className="h-8 text-xs" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button></div></div></header><main className="px-4 py-5 lg:pl-[258px] lg:pr-6">{state === "loading" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading designer dashboard...</CardContent></Card>}{state === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Designer access unavailable</div><p className="mt-2 text-sm text-muted-foreground">{message}</p></CardContent></Card>}{state === "ready" && data && <><div className="mb-5"><h1 className="text-[25px] font-semibold tracking-tight">{data.profile.full_name || "Designer"} workspace</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Review assigned design work, upload proof context, update artwork status, and keep proof queues moving.</p></div><section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Stat label="Design queue" value={String(jobs.length)} hint="Assigned + open jobs" /><Stat label="Artwork files" value={String(artwork.length)} hint="Connected files" /><Stat label="Proofs" value={String(proofs.length)} hint="Proof revisions" /><Stat label="Messages" value={String(messages.length)} hint="Recent communication" /></section><section className="mb-5 grid gap-4 xl:grid-cols-[1fr_380px]"><Card id="queue"><CardHeader className="pb-3"><CardTitle className="text-base">Design queue</CardTitle><CardDescription>Assigned jobs and unassigned design-needed work.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="pl-4">Order</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Priority</TableHead></TableRow></TableHeader><TableBody>{visibleJobs.map((job) => <TableRow key={job.id} className="cursor-pointer" onClick={() => setSelected({ type: "job", record: job })}><TableCell className="pl-4 font-mono text-xs">#{job.orders?.order_number || job.order_id.slice(0, 8)}</TableCell><TableCell>{job.order_items?.products?.name || "No product"}</TableCell><TableCell><Status value={job.status} /></TableCell><TableCell>{date(job.due_at || job.orders?.due_at)}</TableCell><TableCell className="text-right">{job.priority || 100}</TableCell></TableRow>)}{!visibleJobs.length && <TableRow><TableCell colSpan={5} className="p-6 text-center text-muted-foreground">No design jobs found.</TableCell></TableRow>}</TableBody></Table></CardContent></Card><Card id="messages"><CardHeader className="pb-3"><CardTitle className="text-base">Messages</CardTitle></CardHeader><CardContent className="space-y-2">{messages.slice(0, 8).map((item) => <MiniRow key={item.id} title={item.subject || human(item.channel)} detail={item.body || "No body"} value={date(item.created_at)} />)}{!messages.length && <Empty text="No designer messages yet." />}</CardContent></Card></section><section className="grid gap-4 xl:grid-cols-2"><Card id="artwork"><CardHeader className="pb-3"><CardTitle className="text-base">Artwork review</CardTitle></CardHeader><CardContent className="space-y-2">{artwork.slice(0, 8).map((file) => <button key={file.id} className="block w-full text-left" onClick={() => setSelected({ type: "artwork", record: file })}><MiniRow title={file.filename} detail={file.customer_comments || file.admin_comments || "No comments"} value={human(file.review_status)} /></button>)}{!artwork.length && <Empty text="No artwork files yet." />}</CardContent></Card><Card id="proofs"><CardHeader className="pb-3"><CardTitle className="text-base">Proof queue</CardTitle></CardHeader><CardContent className="space-y-2">{proofs.slice(0, 8).map((proof) => <button key={proof.id} className="block w-full text-left" onClick={() => setSelected({ type: "proof", record: proof })}><MiniRow title={`Proof v${proof.revision_number || 1}`} detail={proof.customer_comments || proof.admin_comments || date(proof.sent_at || proof.created_at)} value={human(proof.status)} /></button>)}{!proofs.length && <Empty text="No proofs yet." />}</CardContent></Card></section></>}<ReviewSheet selected={selected} onOpenChange={(open) => !open && setSelected(null)} onSaved={load} /></main></div>;
}

function ReviewSheet({ selected, onOpenChange, onSaved }: { selected: { type: "job" | "artwork" | "proof"; record: DesignerJob | DesignerArtwork | DesignerProof } | null; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState("");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selected) return;
    const record = selected.record as { status?: string | null; review_status?: string | null; notes?: string | null; admin_comments?: string | null };
    setStatus(record.status || record.review_status || "design_needed");
    setComments(record.notes || record.admin_comments || "");
    setMessage("");
  }, [selected]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMessage("Saving update...");
    try {
      const auth = await token();
      const response = await fetch("/api/dashboard/designer", { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${auth}` }, body: JSON.stringify({ type: selected.type, id: selected.record.id, status, comments }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save update.");
      setMessage("Update saved.");
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save update.");
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = selected?.type === "job"
    ? ["design_needed", "proof_pending", "proof_approved", "file_check", "print_ready", "on_hold", "completed"]
    : ["waiting_for_file_review", "needs_changes", "proof_sent", "approved", "rejected", "in_production"];

  return <Sheet open={Boolean(selected)} onOpenChange={onOpenChange}><SheetContent className="overflow-y-auto sm:max-w-[60rem]"><SheetHeader><SheetTitle>{selected ? human(selected.type) : "Review"} update</SheetTitle><SheetDescription>Move design work, artwork, or proof records through the review workflow.</SheetDescription></SheetHeader><div className="mt-6 space-y-4"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}</SelectContent></Select></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Designer notes</div><Textarea value={comments} onChange={(event) => setComments(event.target.value)} /></div>{message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}<div className="flex gap-2"><Button className="flex-1" disabled={saving} onClick={save}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save update"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div></div></SheetContent></Sheet>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function Status({ value }: { value: string }) {
  return <Badge className={`border ${tone(value)}`}>{human(value)}</Badge>;
}

function MiniRow({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3 text-sm"><div className="min-w-0"><div className="truncate font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{text}</div>;
}
