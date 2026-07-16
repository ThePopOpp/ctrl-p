"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { defaultDashboardPathForRole } from "@/lib/rbac/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DownloadAppButton } from "@/components/pwa/download-app-button";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    async function finishSession() {
      const db = getSupabaseBrowserClient();
      if (!db) return;
      const code = searchParams.get("code");
      if (code) await db.auth.exchangeCodeForSession(code);
      const session = (await db.auth.getSession()).data.session;
      if (!session) return;
      const profile = await db.from("users").select("role, status, deleted_at").eq("id", session.user.id).maybeSingle();
      const role = profile.data?.role;
      const canRoute = profile.data?.status === "active" || profile.data?.status === "pending";
      if (role && canRoute && !profile.data?.deleted_at) {
        router.replace(redirect || defaultDashboardPathForRole(role));
      }
    }
    finishSession();
  }, [redirect, router, searchParams]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const db = getSupabaseBrowserClient();
    if (!db) { setMessage("Supabase is not configured."); setMessageType("error"); return; }
    setLoading(true);
    setMessage("");
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setMessage(error.message); setMessageType("error"); return; }
    const profile = await db.from("users").select("role, status, deleted_at").eq("id", data.user.id).maybeSingle();
    router.push(redirect || defaultDashboardPathForRole(profile.data?.role ?? "customer"));
  }

  async function handleMagicLink() {
    const db = getSupabaseBrowserClient();
    if (!db) { setMessage("Supabase is not configured."); setMessageType("error"); return; }
    if (!email.trim()) { setMessage("Enter your email address first."); setMessageType("error"); return; }
    setLoading(true);
    setMessage("");
    const { error } = await db.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setLoading(false);
    if (error) { setMessage(error.message); setMessageType("error"); return; }
    setMagicSent(true);
    setMessage("Magic link sent — check your inbox.");
    setMessageType("success");
  }

  async function handleOAuth(provider: "google" | "apple") {
    const db = getSupabaseBrowserClient();
    if (!db) return;
    await db.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login` },
    });
  }

  return (
    <AuthShell>
      <div className="space-y-3 mb-5">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("apple")}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"/>
          </svg>
          Continue with Apple
        </button>
      </div>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
        <div className="relative flex justify-center text-[11.5px]"><span className="bg-white px-2 text-zinc-500">OR</span></div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-600">Email</label>
          <Input
            autoComplete="email"
            className="h-11 border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900"
            placeholder="you@company.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[13px] font-medium text-zinc-600">Password</label>
            <a className="text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900 hover:underline" href="/forgot-password">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Input
              autoComplete="current-password"
              className="h-11 border-zinc-200 bg-white pr-11 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900"
              placeholder="Enter password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              aria-label={showPassword ? "Hide" : "Show"}
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
              type="button"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-zinc-600">
          <input type="checkbox" className="h-4 w-4 rounded accent-zinc-900" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          Keep me signed in for 30 days
        </label>
        {message && (
          <div className={`text-[12.5px] ${messageType === "error" ? "text-red-600" : "text-emerald-600"}`}>{message}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
        <div className="relative flex justify-center text-[11.5px]"><span className="bg-white px-2 text-zinc-500">or</span></div>
      </div>

      <button
        type="button"
        disabled={loading || magicSent}
        onClick={handleMagicLink}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      >
        <Mail className="h-4 w-4" />
        {magicSent ? "Magic link sent — check your inbox" : "Email me a magic link"}
      </button>

      <DownloadAppButton
        label="Download the Ctrl+P app"
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      />

      <p className="mt-8 text-center text-[13.5px] text-zinc-500">
        Don&apos;t have an account?{" "}
        <a className="font-semibold text-zinc-900 hover:underline" href="/register">Create one</a>
      </p>
      <p className="mt-12 text-center text-[11.5px] text-zinc-400">
        By signing in, you agree to our{" "}
        <a href="/contact" className="underline hover:text-zinc-700">Terms</a> and{" "}
        <a href="/contact" className="underline hover:text-zinc-700">Privacy Policy</a>.
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Form side */}
        <div className="flex flex-col justify-center px-8 py-16 md:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-sm">
            <a href="/" className="mb-12 block">
              <img src="/logos/logo-lime-light.svg" alt="ControlP.io" className="h-16 w-auto" />
            </a>
            <h1 className="mb-2 text-[32px] font-bold tracking-tight">Welcome back</h1>
            <p className="mb-8 text-[14px] text-zinc-500">Sign in to your account to view orders, saved designs, and more.</p>
            {children}
          </div>
        </div>

        {/* Visual side */}
        <div
          className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-16"
          style={{ background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0a0a0a 100%)" }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(59,130,246,0.15) 0%,transparent 50%),radial-gradient(circle at 80% 70%, rgba(212,168,75,0.12) 0%,transparent 50%)" }} />
          <div className="relative z-10">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11.5px] font-medium text-white backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Trusted by 3,400+ businesses
            </div>
            <blockquote className="mb-8 max-w-lg text-[32px] font-bold leading-[1.2] tracking-tight text-white">
              &ldquo;Fastest banner order I&apos;ve ever placed. Uploaded files Monday, signs on Wednesday. Quality was better than what we used to pay 3× for.&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-[14px] font-semibold text-zinc-900">KD</div>
              <div>
                <div className="text-[14px] font-semibold text-white">Kristy Dale</div>
                <div className="text-[12px] text-zinc-400">Owner, Bright Mornings Bakery · Scottsdale</div>
              </div>
            </div>
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-6">
            {[["12.4k+", "Projects shipped"], ["4.9/5", "Customer rating"], ["2-day", "Avg turnaround"]].map(([val, label]) => (
              <div key={label}>
                <div className="text-[28px] font-bold tracking-tight text-white">{val}</div>
                <div className="mt-0.5 text-[11.5px] text-zinc-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
