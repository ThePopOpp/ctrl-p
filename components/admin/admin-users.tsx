"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Mail,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  UserRoundPlus,
  UserPlus,
} from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData, updateAdminUser } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, AdminProfile, AdminUser } from "@/lib/admin/types";
import { ROLES, type AppRole } from "@/lib/rbac/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const userStatuses = ["active", "pending", "inactive", "suspended"] as const;
const editableRoles = Object.values(ROLES);

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(value: string | null | undefined) {
  return String(value || "CP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusTone(status: string) {
  if (status === "active") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["pending", "inactive"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (status === "suspended") return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

function roleGroup(user: AdminUser) {
  if (["super_admin", "admin", "employee", "staff", "production_manager", "installer", "customer_support"].includes(user.role)) return "Internal";
  if (["vendor", "designer", "referral", "reseller"].includes(user.role)) return "Partner";
  return "Customer";
}

export function AdminUsers() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [roleReviewOpen, setRoleReviewOpen] = useState(false);

  useEffect(() => {
    async function boot() {
      const currentProfile = await getCurrentAdminProfile();
      if (!currentProfile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }

      setProfile(currentProfile);
      setAuthState("allowed");
      setData(await loadAdminDashboardData());
    }

    boot();
  }, []);

  const users = data?.users ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const activityLogs = data?.activityLogs ?? [];
  const assignableRoles = useMemo(() => rolesForActor(profile), [profile]);
  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !needle || [
        user.full_name,
        user.email,
        user.company,
        user.role,
        user.status,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);
  const roleCounts = useMemo(() => summarizeRoles(users), [users]);
  const activeUsers = users.filter((user) => user.status === "active");
  const internalUsers = users.filter((user) => roleGroup(user) === "Internal");
  const partnerUsers = users.filter((user) => roleGroup(user) === "Partner");

  async function refreshUsers(openUserId?: string) {
    const nextData = await loadAdminDashboardData();
    setData(nextData);
    if (openUserId) {
      setSelectedUser(nextData.users.find((user) => user.id === openUserId) ?? null);
    }
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div>
              <div className="text-sm font-semibold">Super Admin</div>
            </div>
          </div>

          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link
                      href={href}
                      key={label}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                      {label === "Users" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{users.length}</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>Super Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Users</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search users, roles, companies..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
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
                <p className="mt-2 text-sm text-muted-foreground">Sign in with an active staff or admin account before opening user management.</p>
                <Button className="mt-4" asChild><a href="/login?redirect=/admin/users">Go to login</a></Button>
              </CardContent>
            </Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">User management</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    Manage ControlP roles, account status, internal access, customers, vendors, designers, referrals, resellers, and staff permissions.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAddUserOpen(true)}><UserRoundPlus className="h-4 w-4" /> Add user</Button>
                  <Button onClick={() => setInviteUserOpen(true)}><UserPlus className="h-4 w-4" /> Invite user</Button>
                  <Button variant="outline" onClick={() => setRoleReviewOpen(true)}><ShieldCheck className="h-4 w-4" /> Review roles</Button>
                </div>
              </div>

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <UserStat label="Total users" value={String(users.length)} hint={`${activeUsers.length} active accounts`} />
                <UserStat label="Internal" value={String(internalUsers.length)} hint="Admin, staff, employee roles" />
                <UserStat label="Partners" value={String(partnerUsers.length)} hint="Vendor, designer, referral, reseller" />
                <UserStat label="Customers" value={String(users.filter((user) => roleGroup(user) === "Customer").length)} hint="Self-service accounts" />
                <UserStat label="Suspended" value={String(users.filter((user) => user.status !== "active").length)} hint="Needs review or inactive" />
              </section>

              <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-base">User directory</CardTitle>
                        <CardDescription>Live account records from public.users with RBAC role and status</CardDescription>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                          <SelectTrigger className="h-8 min-w-[150px] text-xs">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All roles</SelectItem>
                            {assignableRoles.map((role) => <SelectItem key={role} value={role}>{human(role)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-8 min-w-[140px] text-xs">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            {userStatuses.map((status) => <SelectItem key={status} value={status}>{human(status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">User</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Group</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleUsers.map((user) => (
                          <TableRow key={user.id} className="cursor-pointer" onClick={() => setSelectedUser(user)}>
                            <TableCell className="pl-4">
                              <div className="flex items-center gap-2">
                                <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-[11px] font-semibold">{initials(user.full_name || user.email)}</div>
                                <div>
                                  <div className="font-medium">{user.full_name || user.email || "Unnamed user"}</div>
                                  <div className="text-xs text-muted-foreground">{user.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{user.company || "Not set"}</TableCell>
                            <TableCell><Badge variant="outline">{human(user.role)}</Badge></TableCell>
                            <TableCell><Badge className={cn("border", statusTone(user.status))}>{human(user.status)}</Badge></TableCell>
                            <TableCell>{roleGroup(user)}</TableCell>
                          </TableRow>
                        ))}
                        {!visibleUsers.length && (
                          <TableRow>
                            <TableCell className="p-6 text-center text-muted-foreground" colSpan={5}>No matching users.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Role distribution</CardTitle>
                    <CardDescription>Current RBAC mix across the workspace</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {roleCounts.map((row) => (
                      <div key={row.role} className="rounded-lg border bg-background/35 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{human(row.role)}</span>
                          <Badge variant="outline">{row.count}</Badge>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${row.width}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <WorkflowCard title="Access control" items={["Role changes", "Status activation", "Suspension review", "Permission audit"]} />
                <WorkflowCard title="Account lifecycle" items={["Invite user", "Customer conversion", "Staff onboarding", "Deleted account review"]} />
                <WorkflowCard title="Partner programs" items={["Vendor profiles", "Designer assignments", "Referral attribution", "Reseller customer mapping"]} />
              </section>
            </>
          )}
        </main>

        <UserSheet
          currentProfile={profile}
          user={selectedUser}
          open={Boolean(selectedUser)}
          onOpenChange={(open) => !open && setSelectedUser(null)}
          onRefresh={refreshUsers}
          activityLogs={activityLogs}
          assignableRoles={assignableRoles}
        />
        <AddUserSheet currentProfile={profile} open={addUserOpen} onOpenChange={setAddUserOpen} onCreated={refreshUsers} assignableRoles={assignableRoles} mode="add" />
        <AddUserSheet currentProfile={profile} open={inviteUserOpen} onOpenChange={setInviteUserOpen} onCreated={refreshUsers} assignableRoles={assignableRoles} mode="invite" />
        <RoleReviewSheet open={roleReviewOpen} onOpenChange={setRoleReviewOpen} users={users} assignableRoles={assignableRoles} />
      </div>
    </div>
  );
}

function summarizeRoles(users: AdminUser[]) {
  const counts = new Map<string, number>();
  for (const user of users) counts.set(user.role, (counts.get(user.role) || 0) + 1);
  const max = Math.max(1, ...Array.from(counts.values()));
  return Array.from(counts.entries())
    .map(([role, count]) => ({ role, count, width: Math.max(8, Math.round((count / max) * 100)) }))
    .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role));
}

function rolesForActor(profile: AdminProfile | null) {
  if (profile?.role === ROLES.SUPER_ADMIN) return editableRoles;
  return editableRoles.filter((role) => role !== ROLES.SUPER_ADMIN);
}

function UserStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-[22px] font-semibold leading-none">{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function WorkflowCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg border bg-background/35 px-3 py-2 text-sm">{item}</div>
        ))}
      </CardContent>
    </Card>
  );
}

function UserSheet({
  currentProfile,
  user,
  open,
  onOpenChange,
  onRefresh,
  activityLogs,
  assignableRoles,
}: {
  currentProfile: AdminProfile | null;
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: (openUserId?: string) => Promise<void>;
  activityLogs: AdminDashboardData["activityLogs"];
  assignableRoles: AppRole[];
}) {
  const [role, setRole] = useState<AppRole>(ROLES.CUSTOMER);
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    setRole(user.role);
    setStatus(user.status);
    setMessage("");
  }, [user]);

  if (!user) {
    return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent /></Sheet>;
  }

  const isSelf = currentProfile?.id === user.id;
  const cannotEditSelfStatus = isSelf && status !== "active";
  const cannotAssignSuperAdmin = role === ROLES.SUPER_ADMIN && currentProfile?.role !== ROLES.SUPER_ADMIN;
  const hasChanges = role !== user.role || status !== user.status;
  const userActivity = activityLogs.filter((log) => log.entity_type === "user" && log.entity_id === user.id).slice(0, 5);

  async function saveAccess() {
    if (!user || !hasChanges) return;
    setSaving(true);
    setMessage("Saving user access...");
    try {
      await updateAdminUser(user.id, { role, status });
      setMessage("User access updated.");
      await onRefresh(user.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update user access.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{user.full_name || user.email || "User account"}</SheetTitle>
          <SheetDescription>{human(user.role)} - {human(user.status)}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-3 rounded-lg border bg-secondary/30 p-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/20 text-sm font-semibold">{initials(user.full_name || user.email)}</div>
            <div className="min-w-0">
              <div className="font-medium">{user.full_name || "Unnamed user"}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{user.email || "No email"}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile label="Company">{user.company || "Not set"}</SummaryTile>
            <SummaryTile label="Group">{roleGroup(user)}</SummaryTile>
            <SummaryTile label="Created">{formatDate(user.created_at)}</SummaryTile>
            <SummaryTile label="Last login">{formatDate(user.last_login_at)}</SummaryTile>
          </div>

          <div className="rounded-lg border bg-background/35 p-3">
            <h3 className="text-sm font-semibold">Access controls</h3>
            <p className="mt-1 text-xs text-muted-foreground">Update the application role and account status used by RBAC and admin policies.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Role</div>
                <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {userStatuses.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {cannotEditSelfStatus && <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">You cannot deactivate your own account.</div>}
            {cannotAssignSuperAdmin && <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">Only a super admin can assign the super admin role.</div>}
            {message && <div className="mt-3 text-xs text-muted-foreground">{message}</div>}
            <Button className="mt-3 w-full" disabled={!hasChanges || cannotEditSelfStatus || cannotAssignSuperAdmin || saving} onClick={saveAccess}>
              {saving ? "Saving..." : "Save access changes"}
            </Button>
          </div>

          <div className="rounded-lg border bg-background/35 p-3">
            <h3 className="text-sm font-semibold">Recent user activity</h3>
            <div className="mt-3 space-y-2">
              {userActivity.map((log) => (
                <div key={log.id} className="rounded-md border bg-secondary/25 px-3 py-2 text-sm">
                  <div className="font-medium">{human(log.action)}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</div>
                </div>
              ))}
              {!userActivity.length && <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No access activity yet.</div>}
            </div>
          </div>

          <div className="rounded-lg border bg-background/35 p-3">
            <h3 className="text-sm font-semibold">RBAC notes</h3>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
              <div>Internal users can access the admin console when their role is active.</div>
              <div>Customer, vendor, designer, referral, and reseller roles should move toward assigned-record policies in later phases.</div>
              <div>Super admin and admin roles currently have broad permission coverage.</div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function AddUserSheet({
  currentProfile,
  open,
  onOpenChange,
  onCreated,
  assignableRoles,
  mode,
}: {
  currentProfile: AdminProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
  assignableRoles: AppRole[];
  mode: "add" | "invite";
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState<AppRole>(ROLES.CUSTOMER);
  const [status, setStatus] = useState(mode === "invite" ? "pending" : "active");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const canSubmit = email.trim().includes("@") && fullName.trim().length >= 2 && !saving;

  async function createUser() {
    setSaving(true);
    setMessage("");
    try {
      if (!fullName.trim()) {
        throw new Error("Full name is required.");
      }

      if (!email.trim().includes("@")) {
        throw new Error("A valid email address is required.");
      }

      if (role === ROLES.SUPER_ADMIN && currentProfile?.role !== ROLES.SUPER_ADMIN) {
        throw new Error("Only a super admin can create another super admin.");
      }

      setMessage("Creating user...");
      const db = getSupabaseBrowserClient();
      const session = db ? (await db.auth.getSession()).data.session : null;

      if (!session) {
        throw new Error("Sign in again before adding a user.");
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          company,
          role,
          status: mode === "invite" ? "pending" : status,
          send_invite: mode === "invite",
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not create user.");
      }

      setMessage("User created.");
      await onCreated();
      setFullName("");
      setEmail("");
      setCompany("");
      setRole(ROLES.CUSTOMER);
      setStatus(mode === "invite" ? "pending" : "active");
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{mode === "invite" ? "Invite user" : "Add user"}</SheetTitle>
          <SheetDescription>
            {mode === "invite"
              ? "Create a pending account and send the invite flow through the configured auth/email provider."
              : "Create an admin-managed user profile with a role and status."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Full name</div>
              <Input placeholder="Jane Customer" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Email</div>
              <Input placeholder="jane@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Company</div>
            <Input placeholder="Company or organization" value={company} onChange={(event) => setCompany(event.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Role</div>
              <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                  <SelectContent>
                  {assignableRoles.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mode === "add" && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {userStatuses.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            )}
          </div>

          <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
            {mode === "invite"
              ? "Invited users are created as pending profiles for now. The next auth slice can send Supabase invite links or branded email invites."
              : "This creates the Supabase auth account server-side, then updates the matching public.users profile. The server must have SUPABASE_SERVICE_ROLE_KEY configured."}
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex gap-2">
            <Button className="flex-1" disabled={!canSubmit} onClick={createUser}>
              {saving ? "Creating..." : mode === "invite" ? "Create invite" : "Create user"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoleReviewSheet({
  open,
  onOpenChange,
  users,
  assignableRoles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AdminUser[];
  assignableRoles: AppRole[];
}) {
  const roleRows = assignableRoles.map((role) => {
    const count = users.filter((user) => user.role === role).length;
    const active = users.filter((user) => user.role === role && user.status === "active").length;
    const group = ["super_admin", "admin", "employee", "staff", "production_manager", "installer", "customer_support"].includes(role)
      ? "Internal"
      : ["vendor", "designer", "referral", "reseller"].includes(role)
        ? "Partner"
        : "Customer";

    return { role, count, active, group };
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Review roles</SheetTitle>
          <SheetDescription>Audit the current RBAC roles, active users, and intended access groupings.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Role types">{assignableRoles.length}</SummaryTile>
            <SummaryTile label="Active users">{users.filter((user) => user.status === "active").length}</SummaryTile>
            <SummaryTile label="Pending review">{users.filter((user) => user.status !== "active").length}</SummaryTile>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleRows.map((row) => (
                <TableRow key={row.role}>
                  <TableCell className="font-medium">{human(row.role)}</TableCell>
                  <TableCell><Badge variant="outline">{row.group}</Badge></TableCell>
                  <TableCell className="text-right">{row.active}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
            Internal roles can access the admin console when active. Customer, vendor, designer, referral, and reseller roles should continue moving toward assigned-record access as RBAC phases continue.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
