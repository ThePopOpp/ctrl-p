"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { defaultDashboardPathForRole } from "@/lib/rbac/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Shell />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const db = getSupabaseBrowserClient();
    if (!db) {
      setExchangeError("Auth is not configured.");
      setExchanging(false);
      return;
    }

    // PKCE flow: code is a query param
    const code = searchParams.get("code");
    if (code) {
      db.auth.exchangeCodeForSession(code).then(({ error: err }: { error: { message: string } | null }) => {
        if (err) setExchangeError(err.message);
        setExchanging(false);
      });
      return;
    }

    // Implicit flow: Supabase auto-processes the hash fragment (#access_token=...&type=recovery)
    // and fires onAuthStateChange with PASSWORD_RECOVERY. Also check if session already exists.
    let done = false;
    function succeed() {
      if (done) return;
      done = true;
      setExchanging(false);
      clearTimeout(timer);
      subscription.unsubscribe();
    }

    const { data: { subscription } } = db.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") succeed();
    });

    // Session might already be set if the hash was processed before this effect ran
    db.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) succeed();
    });

    const timer = setTimeout(() => {
      if (!done) {
        subscription.unsubscribe();
        setExchangeError("No reset code found. Please request a new link.");
        setExchanging(false);
      }
    }, 5000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    const db = getSupabaseBrowserClient();
    if (!db) { setError("Auth is not configured."); return; }
    setSaving(true);
    setError("");
    const { error: updateError, data } = await db.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setSaving(false); return; }
    setDone(true);
    setTimeout(async () => {
      const profile = await db.from("users").select("role").eq("id", data.user.id).maybeSingle();
      router.replace(defaultDashboardPathForRole(profile.data?.role ?? "customer"));
    }, 2000);
  }

  return (
    <Shell>
      {exchanging ? (
        <p className="text-sm text-zinc-400">Verifying reset link…</p>
      ) : exchangeError ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {exchangeError}
          </div>
          <a
            href="/forgot-password"
            className="block w-full rounded-lg border border-zinc-700 bg-transparent py-2.5 text-center text-sm font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Request a new link
          </a>
        </div>
      ) : done ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Password updated</h2>
            <p className="mt-1 text-sm text-zinc-400">Redirecting to your dashboard…</p>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-200">New password</label>
            <div className="relative">
              <Input
                autoComplete="new-password"
                className="h-12 border-zinc-700 bg-zinc-100 pr-11 text-zinc-950 placeholder:text-zinc-500 focus-visible:ring-primary"
                placeholder="At least 8 characters"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950"
                type="button"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-200">Confirm password</label>
            <Input
              autoComplete="new-password"
              className="h-12 border-zinc-700 bg-zinc-100 text-zinc-950 placeholder:text-zinc-500 focus-visible:ring-primary"
              placeholder="Re-enter your new password"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <Button className="h-12 w-full text-sm font-semibold" disabled={saving} type="submit">
            {saving ? "Saving…" : "Set new password"}
          </Button>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center px-6 md:px-10">
        <a className="inline-flex items-center" href="/">
          <img src="/logos/ctrl-p-logo-light.svg" alt="ControlP.io" className="h-auto w-36" />
        </a>
      </header>
      <div className="flex min-h-screen items-center justify-center px-5 py-24">
        <div className="w-full max-w-[420px] space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
            <KeyRound className="h-6 w-6 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Set new password</h1>
            <p className="mt-2 text-sm text-zinc-400">Choose a strong password for your account.</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
