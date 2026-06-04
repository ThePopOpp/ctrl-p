"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const db = getSupabaseBrowserClient();
    if (!db) {
      setError("Auth is not configured.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: authError } = await db.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between px-6 md:px-10">
        <a className="inline-flex items-center" href="/">
          <img src="/logos/ctrl-p-logo-light.svg" alt="ControlP.io" className="h-auto w-36" />
        </a>
        <a
          href="tel:+14809999906"
          className="hidden text-sm text-zinc-400 hover:text-zinc-200 sm:inline"
        >
          Need help? (480) 999-9906
        </a>
      </header>

      <div className="flex min-h-screen items-center justify-center px-5 py-24">
        <div className="w-full max-w-[420px]">
          {sent ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  We sent a password reset link to{" "}
                  <span className="font-medium text-zinc-200">{email}</span>. The link expires in 60 minutes.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left text-xs text-zinc-400">
                <strong className="text-zinc-200">Didn&apos;t receive it?</strong> Check your spam or junk folder, or make sure you used the email address on your ControlP.io account.
              </div>
              <Button
                variant="outline"
                className="w-full border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Try a different email
              </Button>
              <a
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
                <Mail className="h-6 w-6 text-zinc-300" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-zinc-200">
                    Email address
                  </label>
                  <Input
                    autoComplete="email"
                    className="h-12 border-zinc-700 bg-zinc-100 text-zinc-950 placeholder:text-zinc-500 focus-visible:ring-primary"
                    placeholder="you@company.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                  </div>
                )}
                <Button
                  className="h-12 w-full text-sm font-semibold"
                  disabled={loading || !email.trim()}
                  type="submit"
                >
                  {loading ? "Sending…" : "Send reset link"}
                  {!loading && <Mail className="h-4 w-4" />}
                </Button>
              </form>
              <div className="text-center">
                <a
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </a>
              </div>
              <div className="text-center text-xs text-zinc-600">
                Need help?{" "}
                <a href="mailto:hello@controlp.io" className="text-zinc-500 underline hover:text-zinc-300">
                  Contact support
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
