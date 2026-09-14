"use client";

// Write a digital card's link to an NFC item — card, sticker, bracelet, ring,
// key fob — straight from the dashboard. Web NFC exists only in Chrome on
// Android, so everything here branches on support: where it can write, it
// writes (and keeps offering "write another item" for a batch, with an opt-in
// permanent lock); where it can't, it hands the job to an Android phone via QR
// and explains the NFC Tools route for iPhone.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, Nfc } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackedCardUrl } from "@/lib/digital-cards/card-urls";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type NdefWriter = {
  write: (message: { records: { recordType: string; data: string }[] }, options?: { overwrite?: boolean; signal?: AbortSignal }) => Promise<void>;
  makeReadOnly: (options?: { signal?: AbortSignal }) => Promise<void>;
};
type NdefConstructor = new () => NdefWriter;

/** Whether this browser can write NFC. `null` until mounted, so server and client render the same markup. */
export function useWebNfc(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(typeof window !== "undefined" && "NDEFReader" in window), []);
  return supported;
}

function explain(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError") return "Cancelled.";
  if (name === "NotAllowedError") return "NFC permission was blocked. Allow NFC for this site in Chrome's site settings, then try again.";
  if (name === "NotSupportedError") return "This item couldn't be written. It may be locked, or not an NDEF tag. Try an NTAG213, 215 or 216.";
  if (name === "NetworkError") return "The item moved away before writing finished. Hold it still against the phone and try again.";
  return error instanceof Error && error.message ? error.message : "Writing failed. Try again.";
}

const phoneWritePath = (cardId: string) => `/dashboard/customer/manage-products/digital-cards/${cardId}/nfc`;

/** Records a successful write on the card so the NFC Ready tile counts it. Returns whether the server accepted it. */
async function markProgrammed(cardId: string): Promise<boolean> {
  try {
    const db = getSupabaseBrowserClient();
    const token = db ? (await db.auth.getSession()).data.session?.access_token : null;
    if (!token) return false;
    const response = await fetch("/api/dashboard/customer/digital-cards", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: cardId, nfc_status: "programmed" }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function NfcWriter({ url, cardId, onWritten }: { url: string; cardId?: string | null; onWritten?: (result: { locked: boolean; statusSaved: boolean }) => void }) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "done">("idle");
  const [lock, setLock] = useState(false);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function write() {
    const Reader = (window as unknown as { NDEFReader?: NdefConstructor }).NDEFReader;
    if (!Reader) return;
    const ctrl = new AbortController();
    controller.current = ctrl;
    setPhase("waiting");
    setMessage({ tone: "info", text: "Hold the item flat against the back of your phone…" });
    try {
      const ndef = new Reader();
      await ndef.write({ records: [{ recordType: "url", data: url }] }, { overwrite: true, signal: ctrl.signal });
      if (lock) await ndef.makeReadOnly({ signal: ctrl.signal });
      setCount((value) => value + 1);
      const statusSaved = cardId ? await markProgrammed(cardId) : false;
      setMessage({
        tone: "success",
        text: `${lock ? "Written and locked." : "Written."} A tap now opens this card.${cardId && !statusSaved ? " (The card's NFC status couldn't be updated — set it in the builder.)" : ""}`,
      });
      setPhase("done");
      onWritten?.({ locked: lock, statusSaved });
    } catch (error) {
      setMessage({ tone: error instanceof Error && error.name === "AbortError" ? "info" : "error", text: explain(error) });
      setPhase(count > 0 ? "done" : "idle");
    } finally {
      controller.current = null;
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={lock} disabled={phase === "waiting"} onChange={(event) => setLock(event.target.checked)} />
        <span><span className="font-medium text-foreground">Lock after writing.</span> Permanent — a locked item can never be rewritten. Use it for items you hand out.</span>
      </label>
      {phase === "waiting" ? (
        <Button variant="outline" className="w-full" onClick={() => controller.current?.abort()}>
          <Loader2 className="h-4 w-4 animate-spin" /> Cancel — waiting for an item…
        </Button>
      ) : (
        <Button className="w-full" onClick={() => void write()}>
          <Nfc className="h-4 w-4" /> {phase === "done" ? "Write another item" : "Write to NFC item"}
        </Button>
      )}
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={
          message.tone === "error" ? "rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"
            : message.tone === "success" ? "flex items-start gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200"
              : "rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
        }>
          {message.tone === "success" && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{message.text}
        </p>
      )}
      {count > 0 && <p className="text-[11px] text-muted-foreground">{count} item{count === 1 ? "" : "s"} written this session.</p>}
    </div>
  );
}

/** The writer where Web NFC works; otherwise a QR hand-off to a phone plus iPhone instructions. */
export function NfcWritePanel({ url, cardId, onWritten }: { url: string; cardId?: string | null; onWritten?: (result: { locked: boolean; statusSaved: boolean }) => void }) {
  const supported = useWebNfc();
  const [phoneUrl, setPhoneUrl] = useState<string | null>(null);

  useEffect(() => {
    if (cardId) setPhoneUrl(`${window.location.origin}${phoneWritePath(cardId)}`);
  }, [cardId]);

  if (supported === null) return <p className="text-xs text-muted-foreground">Checking NFC support…</p>;
  if (supported) return <NfcWriter url={url} cardId={cardId} onWritten={onWritten} />;

  return (
    <div className="space-y-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">This browser can&apos;t write NFC. Only Chrome on Android can.</p>
      {phoneUrl ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-3 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/digital-cards/qr?url=${encodeURIComponent(phoneUrl)}&size=256`} width={128} height={128} alt="QR code that opens the NFC writer on your phone" className="rounded bg-white p-1" />
          <p><span className="font-medium text-foreground">Android:</span> scan this code with the phone, sign in if asked, then tap each item to the back of the phone.</p>
        </div>
      ) : (
        <p><span className="font-medium text-foreground">Android:</span> save the card, then open this builder in Chrome on the phone.</p>
      )}
      <p><span className="font-medium text-foreground">iPhone:</span> Safari can&apos;t write tags. In the free NFC Tools app, choose Write → Add a record → URL, paste the tag URL, then hold the item to the top of the phone.</p>
    </div>
  );
}

type DialogCard = { id?: string; card_name: string; display_name?: string | null; status: string; is_public: boolean };

export function NfcWriteDialog({
  card,
  publicUrl,
  onClose,
  onWritten,
}: {
  card: DialogCard | null;
  publicUrl: string;
  onClose: () => void;
  onWritten?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [written, setWritten] = useState(false);
  const tagUrl = trackedCardUrl(publicUrl, "nfc");
  const published = card ? card.status === "published" && card.is_public : false;

  useEffect(() => {
    if (!card) {
      setCopied(false);
      setWritten(false);
    }
  }, [card]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tagUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={Boolean(card)}
      onOpenChange={(open) => {
        if (open) return;
        if (written) onWritten?.();
        onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Nfc className="h-4 w-4" /> Write to an NFC item</DialogTitle>
          <DialogDescription>Program a card, bracelet, ring, sticker or key fob so a tap opens {card?.display_name || card?.card_name || "this"}&apos;s card.</DialogDescription>
        </DialogHeader>
        {card && (
          <div className="space-y-4">
            {!published && (
              <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This card isn&apos;t published. You can still write items, but a tap shows nothing until you publish it.
              </p>
            )}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tag URL</p>
              <div className="flex items-center gap-2 rounded-lg border bg-background/35 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{tagUrl}</span>
                <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => void copy()}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Taps on this link are counted as NFC taps in Analytics.</p>
            </div>
            <NfcWritePanel url={tagUrl} cardId={card.id} onWritten={() => setWritten(true)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
