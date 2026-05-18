"use client";

import { FormEvent, ReactNode, Suspense, useState } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { defaultDashboardPathForRole } from "@/lib/rbac/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Input
          autoComplete="email"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          autoComplete="current-password"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {message && <div className="text-sm text-red-600 dark:text-red-300">{message}</div>}
        <Button className="w-full" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </LoginShell>
  );
}

function LoginShell({ children }: { children?: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3">
            <img src="/logos/ctrl-p-logo-dark.svg" alt="ControlP.io" className="h-auto w-40 dark:hidden" />
            <img src="/logos/ctrl-p-logo-light.svg" alt="ControlP.io" className="hidden h-auto w-40 dark:block" />
          </div>
          <CardTitle>controlp.io admin</CardTitle>
          <CardDescription>Sign in with an active admin or staff account.</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
