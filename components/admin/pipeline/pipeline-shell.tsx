"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, LogOut, Moon, Sun } from "lucide-react";

import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentAdminProfile } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminProfile } from "@/lib/admin/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { human, initials } from "@/components/admin/pipeline/pipeline-ui";

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

/** The admin console frame used by the Pipeline pages, matching the other admin sections. */
export function PipelineShell({ crumb, children }: { crumb: string[]; children: (profile: AdminProfile) => ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const current = await getCurrentAdminProfile();
      if (!alive) return;
      if (!current) {
        setAuthState("denied");
        return;
      }
      setProfile(current);
      setAuthState("allowed");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const isActive = (label: string, href: string) => isAdminNavActive(label, pathname) || (href !== "/admin" && pathname.startsWith(`${href}/`));

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] overflow-y-auto border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]">
            <a href="/admin">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
            </a>
          </div>
          <nav className="space-y-4 pb-20">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link
                      key={label}
                      href={href}
                      aria-current={isActive(label, href) ? "page" : undefined}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        isActive(label, href) && "bg-accent font-medium text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="sticky bottom-0 bg-card/95 pt-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">{initials(profile?.full_name || profile?.email)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{profile?.full_name || profile?.email || "Signed in"}</div>
                <div className="truncate text-[10px] text-muted-foreground">{profile ? human(profile.role) : ""}</div>
              </div>
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Link href="/admin" className="hidden hover:text-foreground sm:inline">Admin</Link>
              {crumb.map((part, index) => (
                <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-2">
                  <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 sm:inline" />
                  {index === 0 && crumb.length > 1 ? (
                    <Link href="/admin/pipeline" className="hover:text-foreground">{part}</Link>
                  ) : (
                    <span className={cn("truncate", index === crumb.length - 1 && "font-medium text-foreground")}>{part}</span>
                  )}
                </span>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground lg:hidden">Menu</Link>
              <AdminNotificationBell />
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30">
              <CardContent className="p-5">
                <div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div>
                <Button className="mt-4" asChild><a href={`/login?redirect=${encodeURIComponent(pathname)}`}>Go to login</a></Button>
              </CardContent>
            </Card>
          )}
          {authState === "allowed" && profile && children(profile)}
        </main>
      </div>
    </div>
  );
}
