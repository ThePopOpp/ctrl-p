"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Nfc } from "lucide-react";

import { NfcWritePanel } from "@/components/dashboard/digital-card-nfc-writer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trackedCardUrl } from "@/lib/digital-cards/card-urls";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PhoneCard = { id: string; card_name: string; display_name: string | null; slug: string; status: string; is_public: boolean; public_url: string | null };

/**
 * Opened on an Android phone from the dashboard's QR code: the signed-in owner
 * taps each NFC item to the phone to program it.
 */
export function DigitalCardNfcPhone({ cardId }: { cardId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [card, setCard] = useState<PhoneCard | null>(null);
  const [publicBase, setPublicBase] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getSupabaseBrowserClient();
      const session = db ? (await db.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      try {
        const response = await fetch("/api/dashboard/customer/digital-cards", { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as { cards?: PhoneCard[]; publicBase?: string; error?: string };
        if (!response.ok) throw new Error(payload.error || "Couldn't load your cards.");
        if (!alive) return;
        const found = (payload.cards ?? []).find((item) => item.id === cardId) ?? null;
        setPublicBase(payload.publicBase || window.location.origin);
        setCard(found);
        setState(found ? "ready" : "missing");
      } catch (loadError) {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "Couldn't load your cards.");
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [cardId]);

  const publicUrl = card ? card.public_url || `${publicBase}/c/${card.slug}` : "";
  const published = card ? card.status === "published" && card.is_public : false;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-md space-y-4">
        <a href="/dashboard/customer/manage-products" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> My Products
        </a>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Nfc className="h-5 w-5" /> Write NFC items</CardTitle>
            <CardDescription>{card ? `Program items so a tap opens ${card.display_name || card.card_name}'s card.` : "Program NFC items for your digital card."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "loading" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your card…</p>}
            {state === "missing" && <p className="text-sm text-muted-foreground">This card wasn&apos;t found on your account.</p>}
            {state === "error" && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
            {state === "ready" && card && (
              <>
                {!published && (
                  <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This card isn&apos;t published yet. A tap shows nothing until you publish it.
                  </p>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Tag URL</p>
                  <p className="break-all rounded-lg border bg-background/35 px-3 py-2 font-mono text-xs">{trackedCardUrl(publicUrl, "nfc")}</p>
                </div>
                <NfcWritePanel url={trackedCardUrl(publicUrl, "nfc")} cardId={card.id} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
