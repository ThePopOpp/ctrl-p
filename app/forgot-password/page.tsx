"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const db = getSupabaseBrowserClient();
    if (!db) { setError("Auth is not configured."); return; }
    setLoading(true);
    setError("");
    const { error: authError } = await db.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <a href="/" className="flex items-center">
            <img src="/logos/ctrl-p-logo-light.svg" alt="ControlP.io" className="h-9 w-auto" />
          </a>
          <a href="tel:+14809999906" className="hidden text-[13.5px] font-medium text-zinc-400 hover:text-zinc-200 sm:inline">
            Need help? (480) 999-9906
          </a>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {sent ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h1 className="mb-2 text-[26px] font-bold tracking-tight text-white">Check your inbox</h1>
              <p className="mb-6 text-[14px] leading-relaxed text-zinc-400">
                We sent a reset link to <span className="font-medium text-zinc-200">{email}</span>. The link expires in 60 minutes.
              </p>
              <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                <div className="flex items-start gap-2.5">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  <p className="text-[12.5px] leading-relaxed text-zinc-400">
                    <strong className="text-zinc-200">Didn&apos;t receive an email?</strong> Check your spam folder, or make sure you used the correct address.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="w-full rounded-lg border border-zinc-700 bg-transparent py-3 text-[14px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
              {/* Lock icon */}
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              <h1 className="mb-2 text-[28px] font-bold tracking-tight text-white">Forgot your password?</h1>
              <p className="mb-7 text-[14px] text-zinc-400">No worries. Enter your email and we&apos;ll send you a link to reset it.</p>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-zinc-300">Email address</label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-[14px] text-white placeholder:text-zinc-500 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
                  />
                </div>
                {error && <p className="text-[12.5px] text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-[14px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send reset link"}
                  {!loading && (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                <div className="flex items-start gap-2.5">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  <div className="text-[12.5px] leading-relaxed text-zinc-400">
                    <strong className="text-zinc-200">Didn&apos;t receive an email?</strong> Check your spam folder, or make sure you used the correct address. The link expires in 60 minutes.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-[13.5px] text-zinc-500">
            Remember your password?{" "}
            <a href="/login" className="font-semibold text-zinc-300 hover:underline">
              ← Back to sign in
            </a>
          </div>
          <div className="mt-8 text-center text-[12px] text-zinc-600">
            Need help signing in?{" "}
            <a href="mailto:hello@controlp.io" className="underline hover:text-zinc-400">Contact support</a>
          </div>
        </div>
      </div>
    </main>
  );
}
