"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, RotateCcw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import {
  CustomerShell,
  EmptyState,
  StatusBadge,
  fmtDate,
  human,
  useCustomerSession,
  type CustomerArtwork,
  type CustomerProof,
} from "@/components/dashboard/customer-shell";

export function CustomerArtworkPage() {
  const { data, setData, state, errorMessage, theme, setTheme, messages, setMessages, bookings, getToken, signOut } = useCustomerSession();
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState<Set<string>>(new Set());
  const [proofRevisionId, setProofRevisionId] = useState<string | null>(null);
  const [proofRevisionText, setProofRevisionText] = useState("");
  const [artworkUploading, setArtworkUploading] = useState(false);

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

  async function respondToProof(proofId: string, action: "approve" | "revision", comment?: string) {
    setProofBusy((prev) => new Set(prev).add(proofId));
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/dashboard/customer/proofs/${proofId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, comment }),
      });
      const payload = await res.json().catch(() => ({})) as { proof?: CustomerProof; error?: string };
      if (!res.ok) { alert(payload.error || "Could not submit response."); return; }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          proofs: prev.proofs.map((p) =>
            p.id === proofId ? { ...p, status: payload.proof?.status ?? p.status, customer_approved_at: payload.proof?.customer_approved_at ?? p.customer_approved_at } : p
          ),
        };
      });
      setProofRevisionId(null);
      setProofRevisionText("");
    } finally {
      setProofBusy((prev) => { const next = new Set(prev); next.delete(proofId); return next; });
    }
  }

  async function uploadArtwork(file: File) {
    setArtworkUploading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/dashboard/customer/artwork/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = await res.json().catch(() => ({})) as { artworkFile?: CustomerArtwork; error?: string };
      if (!res.ok) { alert(payload.error || "Could not upload artwork."); return; }
      if (payload.artworkFile) {
        setData((prev) => prev ? { ...prev, artworkFiles: [payload.artworkFile!, ...prev.artworkFiles] } : prev);
      }
    } finally {
      setArtworkUploading(false);
    }
  }

  const orders = data?.orders ?? [];
  const designDrafts = data?.designDrafts ?? [];
  const proofs = data?.proofs ?? [];
  const artwork = data?.artworkFiles ?? [];
  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");

  return (
    <CustomerShell
      profile={data?.profile}
      unreadCount={unreadMessages.length}
      upcomingBookingsCount={upcomingBookings.length}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      onSignOut={signOut}
      activePage="Artwork"
      state={state}
      errorMessage={errorMessage}
      messages={messages}
      onOpenNotifications={openNotifications}
      notifOpen={notifOpen}
      notifRef={notifRef}
      onCloseNotif={() => setNotifOpen(false)}
    >
      {data && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight">Artwork</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Saved designs, proofs, and uploaded files.</p>
            </div>
            <Button asChild><a href="/designer.html">Open designer</a></Button>
          </div>

          {/* Saved designs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saved designs</CardTitle>
              <CardDescription>Drafts created in the online designer.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {designDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-lg border bg-background/35 p-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{draft.title || "Untitled design"}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{draft.product_label || draft.products?.name || human(draft.product_key)}</div>
                      </div>
                      <StatusBadge value={draft.status || "draft"} />
                    </div>
                    <div className="mt-3 grid h-28 place-items-center overflow-hidden rounded-md border bg-secondary/40">
                      {draft.preview_image_url ? (
                        <img className="h-full w-full object-cover" src={draft.preview_image_url} alt="" />
                      ) : draft.preview_svg ? (
                        <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: draft.preview_svg }} />
                      ) : (
                        <div className="text-xs text-muted-foreground">No preview yet</div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild><a href={`/designer.html?draft=${draft.id}`}>Continue editing</a></Button>
                      <Button size="sm" variant="outline">Order this design</Button>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">Saved {fmtDate(draft.last_saved_at || draft.created_at)}</div>
                  </div>
                ))}
                {!designDrafts.length && (
                  <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                    No saved artwork yet. Open the designer and save a draft to see it here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Proofs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Proofs</CardTitle>
              <CardDescription>Review and approve proofs sent by the Ctrl+P team.</CardDescription>
            </CardHeader>
            <CardContent>
              {proofs.length > 0 ? (
                <div className="space-y-2">
                  {proofs.map((proof) => {
                    const approved = !!proof.customer_approved_at || proof.status === "approved";
                    const revisionRequested = proof.status === "revision_requested";
                    const busy = proofBusy.has(proof.id);
                    const isRevising = proofRevisionId === proof.id;
                    return (
                      <div key={proof.id} className={`rounded-lg border bg-background/35 p-3 ${approved ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Proof v{proof.revision_number || 1}</span>
                              <StatusBadge value={proof.status || "pending"} />
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Sent {fmtDate(proof.sent_at || proof.created_at)}</div>
                            {proof.admin_comments && (
                              <div className="mt-2 rounded border bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Note: </span>{proof.admin_comments}
                              </div>
                            )}
                          </div>
                          {proof.proof_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={proof.proof_url} target="_blank" rel="noreferrer">View proof</a>
                            </Button>
                          )}
                        </div>
                        {!approved && !revisionRequested && (
                          <>
                            {!isRevising ? (
                              <div className="mt-3 flex gap-2">
                                <Button size="sm" className="flex-1 gap-1.5" disabled={busy} onClick={() => respondToProof(proof.id, "approve")}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />{busy ? "Submitting..." : "Approve"}
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 gap-1.5" disabled={busy} onClick={() => { setProofRevisionId(proof.id); setProofRevisionText(""); }}>
                                  <RotateCcw className="h-3.5 w-3.5" />Request revision
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-3 space-y-2">
                                <Textarea
                                  className="min-h-[64px] resize-none text-xs"
                                  placeholder="Describe what needs to change..."
                                  value={proofRevisionText}
                                  onChange={(e) => setProofRevisionText(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" className="flex-1" disabled={busy || !proofRevisionText.trim()} onClick={() => respondToProof(proof.id, "revision", proofRevisionText)}>
                                    {busy ? "Submitting..." : "Submit revision request"}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setProofRevisionId(null)}>Cancel</Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {approved && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approved {proof.customer_approved_at ? fmtDate(proof.customer_approved_at) : ""}
                          </div>
                        )}
                        {revisionRequested && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Revision requested{proof.customer_comments ? `: "${proof.customer_comments}"` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState text="No proofs sent yet. Proofs appear here once your order enters the artwork review stage." />
              )}
            </CardContent>
          </Card>

          {/* Uploaded files */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Uploaded files</CardTitle>
                  <CardDescription>Files you've submitted for review or linked to orders.</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={artworkUploading} asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />{artworkUploading ? "Uploading..." : "Upload artwork"}
                    <input type="file" className="hidden" accept="image/*,.pdf,.ai,.eps,.psd,.svg" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArtwork(f); }} />
                  </label>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {artwork.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {artwork.map((file) => {
                    const linkedOrder = file.order_id ? orders.find((o) => o.id === file.order_id) : null;
                    return (
                      <div key={file.id} className="flex items-start gap-3 rounded-lg border bg-background/35 p-3">
                        {file.thumbnail_url ? (
                          <img src={file.thumbnail_url} alt="" className="h-10 w-10 shrink-0 rounded-md border object-cover" />
                        ) : (
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border bg-muted">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{file.filename}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <StatusBadge value={file.review_status || "pending"} />
                            {file.mime_type && <span className="text-[11px] text-muted-foreground">{file.mime_type.split("/")[1]?.toUpperCase()}</span>}
                            {file.file_size_bytes != null && <span className="text-[11px] text-muted-foreground">{(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>}
                            {linkedOrder && <span className="text-[11px] text-muted-foreground">Order #{linkedOrder.order_number || linkedOrder.id.slice(0, 8)}</span>}
                          </div>
                          {file.admin_comments && (
                            <div className="mt-1.5 rounded border bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">Design team: </span>{file.admin_comments}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState text="No artwork uploaded yet. Use the button above to submit files for your order." />
              )}
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">File requirements: </span>
                Accepted: PDF, AI, EPS, PSD, SVG, PNG, JPEG · Min 300 DPI for print · Max 50 MB · CMYK color mode preferred
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </CustomerShell>
  );
}
