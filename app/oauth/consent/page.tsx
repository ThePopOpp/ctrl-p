"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

// Supabase's OAuth 2.1 server sends the person here with ?authorization_id=…
// when Claude, ChatGPT or another MCP app asks to connect to Ctrl+P.
// Ctrl+P keeps its session in the browser, so this runs client-side.

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  email: "See your email address",
  profile: "See your name and profile picture",
  phone: "See your phone number",
};

type Details = {
  authorization_id: string;
  redirect_uri: string;
  client: { name?: string; uri?: string };
  user: { email: string };
  scope: string;
};

function host(uri?: string) {
  if (!uri) return "";
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<Shell><p className="text-center text-sm text-zinc-500">Loading…</p></Shell>}>
      <Consent />
    </Suspense>
  );
}

function Consent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("authorization_id");
  const [details, setDetails] = useState<Details | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return setProblem("This page needs an authorization request. Start the connection again from the app you're connecting.");
      const db = getSupabaseBrowserClient();
      if (!db) return setProblem("Sign-in isn't configured on this site.");

      const { data: session } = await db.auth.getSession();
      if (!session?.session) {
        const back = `/oauth/consent?authorization_id=${encodeURIComponent(id)}`;
        router.replace(`/login?redirect=${encodeURIComponent(back)}`);
        return;
      }

      const { data, error } = await db.auth.oauth.getAuthorizationDetails(id);
      if (error || !data) return setProblem("This request has expired or was already used. Start the connection again from the app you're connecting.");
      // Already approved for these scopes: straight back to the app.
      if (!("authorization_id" in data)) {
        window.location.assign(data.redirect_url);
        return;
      }
      setDetails(data as Details);
    }
    load();
  }, [id, router]);

  async function decide(decision: "approve" | "deny") {
    if (!details) return;
    const db = getSupabaseBrowserClient();
    if (!db) return;
    setBusy(decision);
    const { data, error } =
      decision === "approve"
        ? await db.auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
        : await db.auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });
    if (error || !data?.redirect_url) {
      setBusy(null);
      setProblem("This request has expired or was already used. Start the connection again from the app you're connecting.");
      return;
    }
    window.location.assign(data.redirect_url);
  }

  if (problem) return <Shell><p className="text-center text-sm text-zinc-500">{problem}</p></Shell>;
  if (!details) return <Shell><p className="text-center text-sm text-zinc-500">Loading…</p></Shell>;

  const name = details.client.name || "An unnamed app";
  const scopes = details.scope.split(" ").filter(Boolean);

  return (
    <Shell>
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">Allow {name} to access Ctrl+P?</h1>
        <p className="text-sm text-zinc-500">
          Signed in as <span className="font-medium text-zinc-900">{details.user.email}</span>
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
        <p>
          <span className="font-medium">{name}</span> will be able to read, create, change and delete what your role can in
          Ctrl+P: the website and shop content, products, orders and quotes, pipeline, production, customers, bookings and files.
          Every action is logged, and risky ones (deletes, bulk changes, texts and emails) ask you first.
        </p>
        {scopes.length > 0 && (
          <ul className="space-y-1.5">
            {scopes.map((s) => (
              <li key={s} className="flex items-center gap-2 text-zinc-500">
                <ShieldCheck className="size-4 shrink-0" /> {SCOPE_LABELS[s] ?? s}
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {details.client.uri && (
          <>
            <dt className="text-zinc-500">Website</dt>
            <dd className="truncate">{host(details.client.uri)}</dd>
          </>
        )}
        <dt className="text-zinc-500">Returns to</dt>
        <dd className="break-all">{details.redirect_uri}</dd>
      </dl>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" disabled={!!busy} onClick={() => decide("deny")}>
          {busy === "deny" ? "Denying…" : "Deny"}
        </Button>
        <Button type="button" disabled={!!busy} onClick={() => decide("approve")}>
          {busy === "approve" ? "Allowing…" : "Allow"}
        </Button>
      </div>
      <p className="text-center text-xs text-zinc-500">Only allow apps you trust. You can disconnect it later.</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <a href="/" className="flex justify-center">
          <img src="/logos/logo-lime-light.svg" alt="ControlP.io" className="h-12 w-auto" />
        </a>
        {children}
      </div>
    </main>
  );
}
