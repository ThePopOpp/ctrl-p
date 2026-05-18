"use client";

import { FormEvent, ReactNode, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LifeBuoy, Moon, Sun } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { defaultDashboardPathForRole } from "@/lib/rbac/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function finishInviteOrSession() {
      const db = getSupabaseBrowserClient();
      if (!db) return;

      const code = searchParams.get("code");
      if (code) {
        await db.auth.exchangeCodeForSession(code);
      }

      const session = (await db.auth.getSession()).data.session;
      if (!session) return;

      const profile = await db
        .from("users")
        .select("role, status, deleted_at")
        .eq("id", session.user.id)
        .maybeSingle();

      const role = profile.data?.role;
      const canRoute = profile.data?.status === "active" || profile.data?.status === "pending";
      if (role && canRoute && !profile.data?.deleted_at) {
        router.replace(redirect || defaultDashboardPathForRole(role));
      }
    }

    finishInviteOrSession();
  }, [redirect, router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getSupabaseBrowserClient();
    if (!db) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoading(true);
    setMessage("");
    const result = await db.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    const profile = await db
      .from("users")
      .select("role, status, deleted_at")
      .eq("id", result.data.user.id)
      .maybeSingle();

    if (profile.data?.role && profile.data.status === "active" && !profile.data.deleted_at) {
      router.push(redirect || defaultDashboardPathForRole(profile.data.role));
      return;
    }

    router.push(redirect || "/admin");
  }

  return (
    <LoginShell>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-xs font-semibold text-zinc-200">
            Email Address <span className="text-primary">*</span>
          </label>
          <Input
            autoComplete="email"
            className="h-12 border-zinc-700 bg-zinc-100 text-zinc-950 placeholder:text-zinc-500 focus-visible:ring-primary"
            placeholder="jw@controlp.io"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-semibold text-zinc-200">
              Password <span className="text-primary">*</span>
            </label>
            <a className="text-xs font-medium text-primary hover:text-primary/80" href="/forgot-password.html">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Input
              autoComplete="current-password"
              className="h-12 border-zinc-700 bg-zinc-100 pr-11 text-zinc-950 placeholder:text-zinc-500 focus-visible:ring-primary"
              placeholder="Enter password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            checked={rememberMe}
            className="h-4 w-4 rounded border-zinc-700 accent-primary"
            type="checkbox"
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me
        </label>

        {message && <div className="text-sm text-red-600 dark:text-red-300">{message}</div>}
        <Button className="h-12 w-full text-sm font-semibold" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Log In"} {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>

        <div className="text-center text-sm text-zinc-400">
          Don&apos;t have an account?{" "}
          <a className="font-semibold text-primary hover:text-primary/80" href="/register.html">
            Create one
          </a>
        </div>
      </form>
    </LoginShell>
  );
}

function LoginShell({ children }: { children?: ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between px-6 md:px-10">
        <a className="inline-flex items-center" href="/">
          <img src="/logos/ctrl-p-logo-light.svg" alt="ControlP.io" className="h-auto w-36" />
        </a>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span className="hidden sm:inline">
            New here?{" "}
            <a className="font-semibold text-zinc-100 hover:text-primary" href="/register.html">
              Create Account
            </a>
          </span>
          <button aria-label="Theme preview" className="grid h-8 w-8 place-items-center rounded-full border border-zinc-800 text-zinc-400">
            <Sun className="h-3.5 w-3.5 dark:hidden" />
            <Moon className="hidden h-3.5 w-3.5 dark:block" />
          </button>
        </div>
      </header>

      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden border-r border-zinc-900 bg-zinc-900 lg:block">
          <div className="absolute inset-0 bg-zinc-950" />
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
          <img src="/logos/ctrl-p-logo-light.svg" alt="" className="absolute right-[-80px] top-28 w-[520px] opacity-[0.07]" />
          <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
          <div className="relative flex min-h-screen flex-col justify-end p-10 xl:p-14">
            <div className="max-w-md">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-primary">Welcome back</div>
              <h1 className="text-5xl font-semibold leading-[0.98] tracking-tight">Your print work is waiting.</h1>
              <p className="mt-6 text-base leading-7 text-zinc-300">
                Log in to manage products, invoices, messages, orders, proofs, and production from your ControlP.io workspace.
              </p>
            </div>
            <div className="mt-12 grid max-w-xl grid-cols-3 gap-3 text-xs text-zinc-400">
              <div className="rounded-md border border-zinc-800 bg-black/25 p-3">Admin command center</div>
              <div className="rounded-md border border-zinc-800 bg-black/25 p-3">Messaging and billing</div>
              <div className="rounded-md border border-zinc-800 bg-black/25 p-3">Live catalog tools</div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-24">
          <div className="w-full max-w-[490px]">
            <div className="mb-9">
              <h2 className="text-4xl font-semibold tracking-tight">Welcome Back</h2>
              <p className="mt-2 text-sm text-zinc-400">Log in to your ControlP.io account.</p>
            </div>
            {children}

            <div className="mt-10 border-t border-zinc-800 pt-8">
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <div className="flex -space-x-2">
                  <span className="h-8 w-8 rounded-full bg-primary" />
                  <span className="h-8 w-8 rounded-full bg-cyan-400" />
                  <span className="h-8 w-8 rounded-full bg-zinc-600" />
                </div>
                Trusted by growing print teams and local businesses.
              </div>
            </div>
          </div>
        </section>
      </div>

      <a
        className="fixed bottom-5 right-5 inline-flex h-12 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 shadow-lg hover:border-primary"
        href="/contact.html"
      >
        <span className="hidden sm:inline">Need Help?</span>
        <span className="text-primary">Contact us</span>
        <LifeBuoy className="h-5 w-5" />
      </a>
    </main>
  );
}
