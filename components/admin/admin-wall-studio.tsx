"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutTemplate, LogOut, Moon, Pencil, Save, Sun } from "lucide-react";

import { getCurrentAdminProfile } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WS_CATEGORY_LABEL, type WsCategory } from "@/lib/wall-studio/types";

type Design = {
  id: string;
  slug: string;
  name: string;
  category: WsCategory;
  price_per_sqft: number | string;
  install_rate_per_sqft: number | string;
  accent_hex: string;
  blend_mode: string;
  repeat_pattern: boolean;
  active: boolean;
};

type RuleRow = { key: string; value: unknown; updated_at: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const RULE_FIELDS: { key: string; label: string; kind: "money" | "pct" | "number" | "int"; suffix?: string }[] = [
  { key: "min_sqft", label: "Minimum billed sq ft / panel", kind: "number" },
  { key: "height_ladder_threshold", label: "Ladder height threshold (ft)", kind: "number" },
  { key: "height_ladder_pct", label: "Ladder surcharge", kind: "pct" },
  { key: "height_lift_threshold", label: "Lift height threshold (ft)", kind: "number" },
  { key: "height_lift_pct", label: "Lift surcharge", kind: "pct" },
  { key: "height_lift_flat", label: "Lift flat fee", kind: "money" },
  { key: "exterior_pct", label: "Exterior surcharge", kind: "pct" },
  { key: "textured_pct", label: "Textured surface surcharge", kind: "pct" },
  { key: "repair_pct", label: "Needs-repair surcharge", kind: "pct" },
  { key: "repair_flat", label: "Needs-repair flat fee", kind: "money" },
  { key: "removal_per_sqft", label: "Removal", kind: "money", suffix: "/sq ft" },
  { key: "cleaning_per_sqft", label: "Cleaning & prep", kind: "money", suffix: "/sq ft" },
  { key: "obstacle_each", label: "Obstacle (each)", kind: "money" },
  { key: "access_flat", label: "Difficult access", kind: "money" },
  { key: "travel_free_miles", label: "Free travel radius (mi)", kind: "number" },
  { key: "travel_per_mile", label: "Travel beyond radius", kind: "money", suffix: "/mi" },
  { key: "rush_pct", label: "Rush surcharge", kind: "pct" },
  { key: "rush_window_days", label: "Rush window (days)", kind: "int" },
  { key: "service_floor", label: "Minimum service call", kind: "money" },
];

const BASE_RATE_CATS: WsCategory[] = ["wallpaper", "wall_wrap", "window_film"];

async function getAdminToken() {
  const db = getSupabaseBrowserClient();
  const session = await db?.auth.getSession();
  return session?.data.session?.access_token || "";
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = await getAdminToken();
  const res = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

function toDisplay(kind: string, value: unknown): string {
  const n = Number(value ?? 0);
  return kind === "pct" ? String(Math.round(n * 1000) / 10) : String(n);
}
function fromDisplay(kind: string, str: string): number {
  const n = Number(str) || 0;
  if (kind === "pct") return n / 100;
  if (kind === "int") return Math.round(n);
  return n;
}

function DesignForm({ initial, onSave, onCancel }: { initial: Design; onSave: (d: Partial<Design>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(String(initial.price_per_sqft));
  const [accent, setAccent] = useState(initial.accent_hex);
  const [blend, setBlend] = useState(initial.blend_mode);
  const [repeat, setRepeat] = useState(initial.repeat_pattern);
  const [active, setActive] = useState(initial.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!(Number(price) >= 0)) { setError("Price must be a non-negative number."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), price_per_sqft: Number(price), accent_hex: accent, blend_mode: blend, repeat_pattern: repeat, active });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save design.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Name</div>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Price / sq ft ($)</div>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Accent color</div>
          <Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 p-1" />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Blend mode</div>
          <Select value={blend} onValueChange={setBlend}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="multiply">Multiply (wallpaper / wraps)</SelectItem>
              <SelectItem value="normal">Normal (window film)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Pattern</div>
          <Select value={repeat ? "repeat" : "mural"} onValueChange={(v) => setRepeat(v === "repeat")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="repeat">Repeating tile</SelectItem>
              <SelectItem value="mural">Mural (cover)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div>
          <Select value={active ? "active" : "inactive"} onValueChange={(v) => setActive(v === "active")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <div className="rounded-lg border bg-background/35 p-3 text-sm text-destructive">{error}</div>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save design"}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function AdminWallStudio() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [editing, setEditing] = useState<Design | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // pricing-rule editor state
  const [ruleValues, setRuleValues] = useState<Record<string, string>>({});
  const [baseRates, setBaseRates] = useState<Record<string, string>>({});
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }
      setAuthState("allowed");
      load();
    }
    boot();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/wall-studio");
      setDesigns(data.products ?? []);
      const rows: RuleRow[] = data.rules ?? [];
      const map = new Map(rows.map((r) => [r.key, r.value]));
      const rv: Record<string, string> = {};
      for (const f of RULE_FIELDS) rv[f.key] = toDisplay(f.kind, map.get(f.key));
      setRuleValues(rv);
      const rates = (map.get("install_base_rates") ?? {}) as Record<string, number>;
      setBaseRates({
        wallpaper: String(rates.wallpaper ?? ""),
        wall_wrap: String(rates.wall_wrap ?? ""),
        window_film: String(rates.window_film ?? ""),
      });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load Wall Studio.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDesign(update: Partial<Design>) {
    if (!editing) return;
    await apiFetch("/api/admin/wall-studio", {
      method: "PATCH",
      body: JSON.stringify({ target: "product", id: editing.id, ...update }),
    });
    setNotice(`Updated ${editing.name}.`);
    setSheetOpen(false);
    setEditing(null);
    await load();
  }

  async function toggleActive(d: Design) {
    try {
      await apiFetch("/api/admin/wall-studio", {
        method: "PATCH",
        body: JSON.stringify({ target: "product", id: d.id, active: !d.active }),
      });
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update design.");
    }
  }

  async function saveRules() {
    setSavingRules(true);
    setNotice("");
    try {
      const patches = RULE_FIELDS.map((f) =>
        apiFetch("/api/admin/wall-studio", {
          method: "PATCH",
          body: JSON.stringify({ target: "rule", key: f.key, value: fromDisplay(f.kind, ruleValues[f.key] ?? "0") }),
        }),
      );
      patches.push(
        apiFetch("/api/admin/wall-studio", {
          method: "PATCH",
          body: JSON.stringify({
            target: "rule",
            key: "install_base_rates",
            value: {
              wallpaper: Number(baseRates.wallpaper) || 0,
              wall_wrap: Number(baseRates.wall_wrap) || 0,
              window_film: Number(baseRates.window_film) || 0,
            },
          }),
        }),
      );
      await Promise.all(patches);
      setNotice("Installation pricing rules saved.");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save pricing rules.");
    } finally {
      setSavingRules(false);
    }
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]"><a href="/admin"><img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" /><img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" /></a></div>
          <nav className="space-y-4">{adminNavGroups.map((group) => <div key={group.label}>{group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}<div className="space-y-0.5">{group.items.map(([label, Icon, href]) => <Link href={href} key={label} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}><Icon className="h-4 w-4" />{label}</Link>)}</div></div>)}</nav>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JW</div>
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">Jeremy Waters</div><div className="truncate text-[10px] text-muted-foreground">Owner - Super Admin</div></div>
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <span className="hidden text-xs text-muted-foreground md:block">Super Admin</span>
            <span className="hidden text-muted-foreground md:block text-xs">/</span>
            <span className="hidden text-xs font-medium text-foreground md:block">Wall Studio</span>
            <div className="ml-auto flex items-center gap-2">
              <AdminNotificationBell />
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/wall-studio">Go to login</a></Button></CardContent></Card>}

          {authState === "allowed" && (
            <>
              <div className="mb-5">
                <h1 className="text-[25px] font-semibold tracking-tight">Wall Studio</h1>
                <p className="mt-1 text-sm text-muted-foreground">Set per-square-foot pricing for each design and the installation pricing variables.</p>
              </div>

              {notice && <div className="mb-4 rounded-lg border bg-secondary/35 px-3 py-2 text-sm text-muted-foreground">{notice}</div>}

              {loading ? (
                <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading…</CardContent></Card>
              ) : (
                <div className="space-y-5">
                  {/* Designs */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2"><LayoutTemplate className="h-4 w-4" />Designs &amp; per-sq-ft pricing</CardTitle>
                      <CardDescription>Edit the material price per square foot, appearance, and availability for each design.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Design</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price / sq ft</TableHead>
                            <TableHead>Blend</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="pr-4 text-right">Edit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {designs.map((d) => (
                            <TableRow key={d.id}>
                              <TableCell className="pl-4">
                                <div className="flex items-center gap-2.5">
                                  <span className="h-6 w-6 shrink-0 rounded-md border" style={{ backgroundColor: d.accent_hex }} />
                                  <span className="font-medium">{d.name}</span>
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="outline">{WS_CATEGORY_LABEL[d.category]}</Badge></TableCell>
                              <TableCell className="font-medium">{money.format(Number(d.price_per_sqft))}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{d.blend_mode}</TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => toggleActive(d)} className={cn("rounded-full border px-2 py-0.5 text-xs font-medium transition-colors", d.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20" : "border-border bg-secondary text-muted-foreground hover:bg-accent")}>{d.active ? "Active" : "Inactive"}</button>
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <button onClick={() => { setEditing(d); setSheetOpen(true); }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground ml-auto"><Pencil className="h-3.5 w-3.5" /></button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!designs.length && <TableRow><TableCell colSpan={6} className="p-6 text-center text-muted-foreground">No designs yet.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Installation pricing variables */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Installation pricing variables</CardTitle>
                      <CardDescription>Base labor rates per material plus the surcharge, adder, travel, rush, and minimum rules used to quote installation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base labor rate ($/sq ft)</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {BASE_RATE_CATS.map((c) => (
                            <div key={c}>
                              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{WS_CATEGORY_LABEL[c]}</div>
                              <Input value={baseRates[c] ?? ""} onChange={(e) => setBaseRates((p) => ({ ...p, [c]: e.target.value }))} inputMode="decimal" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Surcharges, adders &amp; limits</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {RULE_FIELDS.map((f) => (
                            <div key={f.key}>
                              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                                {f.label}
                                {f.kind === "pct" ? " (%)" : f.kind === "money" ? ` ($${f.suffix ?? ""})` : ""}
                              </div>
                              <Input value={ruleValues[f.key] ?? ""} onChange={(e) => setRuleValues((p) => ({ ...p, [f.key]: e.target.value }))} inputMode="decimal" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button onClick={saveRules} disabled={savingRules}>
                        <Save className="h-4 w-4" />{savingRules ? "Saving…" : "Save pricing rules"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </main>

        <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setEditing(null); }}>
          <SheetContent className="overflow-y-auto sm:max-w-[440px]">
            <SheetHeader>
              <SheetTitle>{editing ? `Edit: ${editing.name}` : "Edit design"}</SheetTitle>
              <SheetDescription>Update pricing and appearance. Installation labor rate is set by category in the pricing variables below.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              {editing && <DesignForm initial={editing} onSave={saveDesign} onCancel={() => { setSheetOpen(false); setEditing(null); }} />}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
