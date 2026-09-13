"use client";

// "Import from phone" for Ctrl+P contacts — ported from Channel Cast's
// PhoneImportModal. Pick a route in (OS contact sheet, .vcf file, or a QR code
// that reopens this page on the phone), review what came back, then save.
// Nothing is written until the user presses Import on the review screen.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, CircleAlert, FileUp, Loader2, QrCode, Search, Smartphone, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type ContactDraft,
  type ExistingContact,
  type ImportCandidate,
  contactPickerSupported,
  contactsManager,
  fromPicked,
  parseVCards,
  toCandidates,
} from "@/lib/contacts/phone-import";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type Route = "picker" | "vcf";
type Outcome = { name: string; outcome: "added" | "updated" | "unchanged" | "failed"; error?: string; placeholder_email?: boolean };
export type PhoneImportSummary = { added: number; updated: number; unchanged: number; failed: number; placeholders: number; results: Outcome[] };

async function adminToken() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Sign in again before importing contacts.");
  return session.access_token;
}

export function PhoneImportDialog({
  open,
  onClose,
  onImported,
  autoPick = false,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (summary: PhoneImportSummary) => void;
  /** Arrived from the QR code — open the phone's contact sheet straight away. */
  autoPick?: boolean;
}) {
  const [existing, setExisting] = useState<ExistingContact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [route, setRoute] = useState<Route>("picker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PhoneImportSummary | null>(null);
  const [pickerReady, setPickerReady] = useState(false);

  // Feature detection after mount: the server has no `navigator`.
  useEffect(() => setPickerReady(contactPickerSupported()), []);

  useEffect(() => {
    if (!open) {
      setCandidates(null);
      setSummary(null);
      setError(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/admin/users", { headers: { authorization: `Bearer ${await adminToken()}` }, cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as { users?: ExistingContact[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Couldn't load existing contacts.");
        if (alive) setExisting(payload.users ?? []);
      } catch (loadFailure) {
        if (alive) setLoadError(loadFailure instanceof Error ? loadFailure.message : "Couldn't load existing contacts.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const receive = useCallback(
    (drafts: ContactDraft[], from: Route) => {
      if (!drafts.length) {
        setError(from === "vcf" ? "No contacts found in that file. Make sure it's the .vcf your phone exported." : "Nothing came back from the contact picker.");
        return;
      }
      if (!existing) {
        setError("Still checking your existing contacts — try again in a moment.");
        return;
      }
      setError(null);
      setRoute(from);
      setCandidates(toCandidates(drafts, existing));
    },
    [existing],
  );

  const openPicker = useCallback(async () => {
    const manager = contactsManager();
    if (!manager) return;
    setBusy(true);
    setError(null);
    try {
      const supported = await manager.getProperties().catch(() => ["name", "email", "tel"]);
      const wanted = ["name", "email", "tel", "address", "icon"].filter((property) => supported.includes(property));
      const picked = await manager.select(wanted, { multiple: true });
      if (picked.length) {
        const drafts = await Promise.all(picked.map(async (person) => {
          const draft = fromPicked(person);
          const icon = person.icon?.[0];
          if (icon) draft.photoUrl = (await shrinkToDataUrl(icon)) ?? undefined;
          return draft;
        }));
        receive(drafts, "picker");
      }
    } catch (pickFailure) {
      const message = pickFailure instanceof Error ? pickFailure.message : "";
      // A cancelled sheet is not an error.
      if (!/abort|cancel/i.test(message)) setError("Couldn't open your phone's contacts. This needs Chrome on Android over HTTPS.");
    } finally {
      setBusy(false);
    }
  }, [receive]);

  // From the QR code: go straight to the contact sheet once existing contacts are loaded.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (open && autoPick && pickerReady && existing && !autoOpened.current) {
      autoOpened.current = true;
      void openPicker();
    }
  }, [open, autoPick, pickerReady, existing, openPicker]);

  async function commit(add: ContactDraft[], merge: { user_id: string; draft: ContactDraft }[]) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/contacts/phone-import", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await adminToken()}` },
        body: JSON.stringify({ add, merge }),
      });
      const payload = (await response.json().catch(() => ({}))) as PhoneImportSummary & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The import didn't save. Nothing was changed.");
      setSummary(payload);
      onImported(payload);
    } catch (saveFailure) {
      setError(saveFailure instanceof Error ? saveFailure.message : "The import didn't save. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto sm:max-w-xl", candidates && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {summary ? (
              <><Check className="h-4 w-4" /> Import finished</>
            ) : candidates ? (
              <>
                <button type="button" onClick={() => { setCandidates(null); setError(null); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                Review {candidates.length} contact{candidates.length === 1 ? "" : "s"}
              </>
            ) : (
              <><Smartphone className="h-4 w-4" /> Import from your phone</>
            )}
          </DialogTitle>
          {!candidates && !summary && <DialogDescription>New people are added as customer contacts. Anyone already in Ctrl+P only gets their blank fields filled in.</DialogDescription>}
        </DialogHeader>

        {loadError && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">{loadError}</p>}

        {summary ? (
          <ResultStep summary={summary} onDone={onClose} />
        ) : candidates ? (
          <ReviewStep candidates={candidates} route={route} busy={busy} error={error} onCancel={onClose} onCommit={commit} />
        ) : (
          <SourceStep pickerReady={pickerReady} busy={busy || (!existing && !loadError)} error={error} onPick={openPicker} onFile={(drafts) => receive(drafts, "vcf")} onError={setError} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourceStep({
  pickerReady,
  busy,
  error,
  onPick,
  onFile,
  onError,
}: {
  pickerReady: boolean;
  busy: boolean;
  error: string | null;
  onPick: () => void;
  onFile: (drafts: ContactDraft[]) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  async function readFile(file: File) {
    setReading(true);
    try {
      onFile(parseVCards(await file.text()));
    } catch {
      onError("That file couldn't be read.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-4">
      {pickerReady ? (
        <section className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15"><Users className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Pick from your phone&rsquo;s contacts</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Opens Android&rsquo;s own contact list. Only the people you choose are read.</p>
            </div>
          </div>
          <Button className="mt-3 w-full" onClick={onPick} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Waiting…</> : <><Smartphone className="h-4 w-4" /> Open phone contacts</>}
          </Button>
        </section>
      ) : (
        <QrHandoff />
      )}

      <section className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><FileUp className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Upload a vCard (.vcf)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Export contacts from your phone once, then choose the file here. Works on iPhone, Android and desktop.</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".vcf,.vcard,text/vcard,text/x-vcard"
          className="hidden"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }}
        />
        <Button variant="outline" className="mt-3 w-full" onClick={() => fileRef.current?.click()} disabled={reading || busy}>
          {reading ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading…</> : <><FileUp className="h-4 w-4" /> Choose .vcf file</>}
        </Button>
        <button type="button" onClick={() => setShowHowTo((value) => !value)} className="mt-3 flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHowTo && "rotate-180")} />
          How to export contacts from a phone
        </button>
        {showHowTo && (
          <ol className="mt-2 list-decimal space-y-1 pl-8 text-xs text-muted-foreground">
            <li><span className="font-medium text-foreground">Android:</span> Contacts app → menu → Settings → Export, then save the .vcf file. On Samsung: Manage contacts → Import or export contacts.</li>
            <li><span className="font-medium text-foreground">iPhone:</span> Contacts → Lists → long-press a list → Export, or select contacts and Share, then save the .vcf.</li>
            <li>Choose that file here.</li>
          </ol>
        )}
      </section>

      {error && <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

/** On a laptop there are no phone contacts to read — hand this page to the phone instead. */
function QrHandoff() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const link = new URL(window.location.href);
    link.searchParams.set("import", "phone");
    setUrl(link.toString());
  }, []);

  const localOnly = url ? /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url) : false;

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><QrCode className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Continue on your phone</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reading contacts has to happen on the phone. Scan this with an Android phone&rsquo;s camera to open this page there, signed in as you. Contacts you import show up here after a refresh.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/digital-cards/qr?url=${encodeURIComponent(url)}&size=336`} width={168} height={168} alt="QR code that opens this page on your phone" className="rounded-lg bg-white p-1" />
        ) : (
          <div className="h-[168px] w-[168px] animate-pulse rounded-lg bg-muted" />
        )}
      </div>
      {localOnly && (
        <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          This is a localhost address, so your phone can&rsquo;t reach it. Use the deployed site (controlp.io) to import from a phone.
        </p>
      )}
    </section>
  );
}

function ReviewStep({
  candidates,
  route,
  busy,
  error,
  onCancel,
  onCommit,
}: {
  candidates: ImportCandidate[];
  route: Route;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onCommit: (add: ContactDraft[], merge: { user_id: string; draft: ContactDraft }[]) => void;
}) {
  // Duplicates start unticked: the safe default is "don't touch what's here".
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(candidates.filter((c) => !c.duplicateOf).map((c) => c.key)));
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter(({ draft }) => [draft.name, draft.company, draft.email, draft.phone].some((value) => (value ?? "").toLowerCase().includes(needle)));
  }, [candidates, search]);

  const toggle = (key: string) => setChosen((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allShownChosen = shown.length > 0 && shown.every((c) => chosen.has(c.key));
  const toggleAll = () => setChosen((previous) => {
    const next = new Set(previous);
    if (allShownChosen) shown.forEach((c) => next.delete(c.key)); else shown.forEach((c) => next.add(c.key));
    return next;
  });

  const picked = candidates.filter((c) => chosen.has(c.key));
  const newOnes = picked.filter((c) => !c.duplicateOf);
  const merges = picked.filter((c) => c.duplicateOf);
  const dupCount = candidates.filter((c) => c.duplicateOf).length;
  const noEmail = newOnes.filter((c) => !c.draft.email).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {route === "picker" ? "From your phone's contact list." : "From the vCard file."}{" "}
        {dupCount > 0
          ? `${dupCount} already ${dupCount === 1 ? "looks like a contact" : "look like contacts"} in Ctrl+P and ${dupCount === 1 ? "is" : "are"} unticked. Tick one to fill in its blank fields — existing values are never overwritten.`
          : "None of these are in Ctrl+P yet."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search these contacts…" className="h-9 pl-8" />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <input type="checkbox" checked={allShownChosen} onChange={toggleAll} className="h-4 w-4 rounded border-input accent-primary" />
          Select all{search.trim() ? " shown" : ""}
        </label>
      </div>

      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nobody matches &ldquo;{search}&rdquo;.</p>
        ) : shown.map((candidate) => (
          <CandidateRow key={candidate.key} candidate={candidate} checked={chosen.has(candidate.key)} onToggle={() => toggle(candidate.key)} />
        ))}
      </div>

      {noEmail > 0 && (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {noEmail} new contact{noEmail === 1 ? " has" : "s have"} no email. Like CSV imports, they&rsquo;re saved with a placeholder address and Pending status so SMS and calls still work.
        </p>
      )}
      {error && <p role="alert" className="flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}

      <DialogFooter className="gap-2 sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">{newOnes.length} new{merges.length ? `, ${merges.length} to update` : ""}</span>
        <span className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            disabled={picked.length === 0 || busy}
            onClick={() => onCommit(newOnes.map((c) => c.draft), merges.map((c) => ({ user_id: c.duplicateOf!.id, draft: c.draft })))}
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : <><Check className="h-4 w-4" /> Import {picked.length || ""}</>}
          </Button>
        </span>
      </DialogFooter>
    </div>
  );
}

function CandidateRow({ candidate, checked, onToggle }: { candidate: ImportCandidate; checked: boolean; onToggle: () => void }) {
  const { draft, duplicateOf, matchedOn } = candidate;
  const subtitle = [draft.title, draft.company].filter(Boolean).join(" · ") || draft.email || draft.phone;
  const initials = draft.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors", checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50")}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 shrink-0 rounded border-input accent-primary" />
      {draft.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={draft.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold">{initials}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{draft.name}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {duplicateOf && (
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground">
          Already in Ctrl+P{matchedOn ? ` · ${matchedOn}` : ""}
        </Badge>
      )}
    </label>
  );
}

function ResultStep({ summary, onDone }: { summary: PhoneImportSummary; onDone: () => void }) {
  const failures = summary.results.filter((result) => result.outcome === "failed");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          ["Added", summary.added],
          ["Updated", summary.updated],
          ["Already up to date", summary.unchanged],
          ["Failed", summary.failed],
        ] as const).map(([label, value]) => (
          <div key={label} className={cn("rounded-lg border p-3", label === "Failed" && value > 0 && "border-red-500/40")}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      {summary.placeholders > 0 && (
        <p className="text-xs text-muted-foreground">{summary.placeholders} added without an email use a placeholder address and Pending status.</p>
      )}
      {failures.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-red-500/10 p-3 text-xs">
          {failures.map((failure, index) => (
            <p key={`${failure.name}-${index}`}><span className="font-medium">{failure.name}:</span> {failure.error}</p>
          ))}
        </div>
      )}
      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}

const AVATAR_PX = 128;

/** Picker photos are full resolution; store a small square JPEG instead. */
async function shrinkToDataUrl(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PX;
    canvas.height = AVATAR_PX;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}
