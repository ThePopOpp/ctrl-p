"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronRight, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";

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

const COLLAPSE_KEY = "cp-admin-sidebar-collapsed";

const SidebarContext = createContext<{ collapsed: boolean }>({ collapsed: false });

/** Whether the main admin sidebar is collapsed to a rail — the workspace moves its quick actions beside the content then. */
export const usePipelineSidebar = () => useContext(SidebarContext);

/** The admin console frame used by the Pipeline pages, matching the other admin sections, with a collapsible rail. */
export function PipelineShell({ crumb, children }: { crumb: string[]; children: (profile: AdminProfile) => ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* a per-browser preference only */
    }
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

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !value;
    });
  };

  const isActive = (label: string, href: string) => isAdminNavActive(label, pathname) || (href !== "/admin" && pathname.startsWith(`${href}/`));

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className={cn("fixed inset-y-0 left-0 z-20 hidden flex-col border-r bg-card/95 py-3 transition-[width] duration-200 lg:flex", collapsed ? "w-[76px] px-2" : "w-[238px] px-3")}>
          <div className={cn("pt-[5px]", collapsed ? "mb-6 flex justify-center" : "mb-[45px] px-2")}>
            <a href="/admin" aria-label="ControlP.io admin">
              {collapsed ? (
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">P</span>
              ) : (
                <>
                  <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
                  <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
                </>
              )}
            </a>
          </div>
          <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4" aria-label="Admin">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
                {collapsed && group.label !== "Main" && <div className="mx-auto mb-2 h-px w-8 bg-border" />}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link
                      key={label}
                      href={href}
                      title={collapsed ? label : undefined}
                      aria-label={collapsed ? label : undefined}
                      aria-current={isActive(label, href) ? "page" : undefined}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        collapsed ? "justify-center px-0" : "px-2.5 text-left",
                        isActive(label, href) && "bg-accent font-medium text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : undefined}
              className={cn("mb-2 flex h-8 w-full items-center gap-2 rounded-md text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground", collapsed ? "justify-center" : "px-2.5")}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
            </button>
            {collapsed ? (
              <button onClick={handleSignOut} aria-label="Sign out" title="Sign out" className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-secondary text-[11px] font-semibold">
                {initials(profile?.full_name || profile?.email)}
              </button>
            ) : (
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
            )}
          </div>
        </aside>

        <header className={cn("sticky top-0 z-10 border-b bg-background/90 backdrop-blur transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[238px]")}>
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

        <main className={cn("px-4 py-5 transition-[padding] duration-200 lg:pr-6", collapsed ? "lg:pl-[96px]" : "lg:pl-[258px]")}>
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30">
              <CardContent className="p-5">
                <div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div>
                <Button className="mt-4" asChild><a href={`/login?redirect=${encodeURIComponent(pathname)}`}>Go to login</a></Button>
              </CardContent>
            </Card>
          )}
          {authState === "allowed" && profile && (
            <SidebarContext.Provider value={{ collapsed }}>{children(profile)}</SidebarContext.Provider>
          )}
        </main>
      </div>
    </div>
  );
}
