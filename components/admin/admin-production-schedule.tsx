"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { PointerEvent } from "react";
import { Ban, Bell, Calendar, CalendarClock, Camera, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, EyeOff, FileText, Flag, GripVertical, Link2, Moon, Package, Pencil, Plus, Search, StickyNote, Sun, Trash2, UserPlus, Users, Video } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, AdminUser, Order, OrderItem, Product, ProductionJob } from "@/lib/admin/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ScheduleItem = {
  source_type?: "schedule" | "appointment";
  id: string;
  order_id: string | null;
  order_item_id: string | null;
  production_job_id: string | null;
  product_id: string | null;
  customer_id: string | null;
  schedule_group_id: string | null;
  project_name: string | null;
  workflow_template_slug: string | null;
  workflow_template_name: string | null;
  hidden_from_schedule: boolean;
  parent_item_id: string | null;
  title: string;
  description: string | null;
  item_type: string;
  phase: string | null;
  status: string;
  priority: string;
  assigned_to_user_id: string | null;
  assigned_department: string | null;
  start_date: string | null;
  start_offset_minutes: number | null;
  end_date: string | null;
  due_date: string | null;
  estimated_duration_days: number | string | null;
  progress_percent: number | null;
  customer_visible: boolean;
  internal_only: boolean;
  is_blocked: boolean;
  blocker_type: string | null;
  blocker_reason: string | null;
  artwork_review_status: string | null;
  proof_status: string | null;
  production_status: string | null;
  sort_order: number | null;
  internal_notes: string | null;
  customer_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  orders?: {
    id: string;
    order_number: string | null;
    company: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    status: string | null;
    production_status: string | null;
    payment_status: string | null;
    due_at: string | null;
  } | null;
  order_items?: {
    id: string;
    quantity: number | null;
    products?: { id: string; name: string | null; category: string | null } | null;
  } | null;
  products?: { id: string; name: string | null; category: string | null; product_type?: string | null } | null;
  users?: { id: string; full_name: string | null; email: string | null; phone?: string | null; company?: string | null } | null;
  assignee?: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
  production_jobs?: { id: string; status: string | null; station: string | null; due_at: string | null } | null;
  appointment?: BookingAppointment | null;
};

type BookingAppointment = {
  id: string;
  appointment_type_id: string | null;
  customer_id: string | null;
  assigned_staff_id: string | null;
  related_order_id: string | null;
  related_job_id: string | null;
  title: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  company_name: string | null;
  start_time: string;
  end_time: string;
  timezone: string | null;
  status: string;
  location_type: string;
  customer_notes: string | null;
  internal_notes: string | null;
  booking_appointment_types?: { name: string | null; color: string | null } | null;
};

type ScheduleDependency = {
  id: string;
  parent_item_id: string;
  dependent_item_id: string;
  dependency_type: string;
  lag_days: number | null;
  required_completion_date: string | null;
  delay_impact_notes: string | null;
  notes: string | null;
  auto_shift_schedule: boolean;
  parent?: { id: string; title: string | null; status: string | null; due_date: string | null } | null;
  dependent?: { id: string; title: string | null; status: string | null; start_date: string | null } | null;
};

type WorkflowTemplate = {
  name: string;
  slug: string;
  category: string;
  description: string;
  item_count: number;
  items: {
    key: string;
    title: string;
    item_type: string;
    phase: string;
    owner_role: string;
    duration_days: number;
    start_offset_days: number;
    customer_visible?: boolean;
    depends_on?: string;
  }[];
};

type SchedulePayload = {
  id?: string;
  order_id: string | null;
  order_item_id: string | null;
  production_job_id: string | null;
  product_id: string | null;
  customer_id: string | null;
  schedule_group_id?: string | null;
  project_name?: string | null;
  workflow_template_slug?: string | null;
  workflow_template_name?: string | null;
  hidden_from_schedule: boolean;
  parent_item_id: string | null;
  title: string;
  description: string;
  item_type: string;
  phase: string;
  status: string;
  priority: string;
  assigned_to_user_id: string | null;
  assigned_department: string;
  start_date: string | null;
  start_offset_minutes: number;
  end_date: string | null;
  due_date: string | null;
  estimated_duration_days: number | null;
  progress_percent: number;
  customer_visible: boolean;
  internal_only: boolean;
  is_blocked: boolean;
  blocker_type: string;
  blocker_reason: string;
  artwork_review_status: string;
  proof_status: string;
  production_status: string;
  sort_order: number;
  internal_notes: string;
  customer_notes: string;
};

const staffRoles = new Set(["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support", "vendor"]);
const itemTypes = ["phase", "task", "milestone", "approval", "artwork_review", "proof", "production_step", "qc_check", "delivery", "installation", "customer_action"];
const statuses = ["not_started", "in_progress", "waiting_on_customer", "waiting_on_artwork", "waiting_on_proof_approval", "waiting_on_materials", "waiting_on_vendor", "needs_internal_review", "needs_customer_review", "ready_for_production", "in_production", "quality_check", "completed", "approved", "reopened", "blocked", "on_hold"];
const priorities = ["low", "normal", "high", "rush", "critical", "blocking_production", "blocking_delivery_install"];
const phases = ["Intake / Quote", "Artwork / Design", "File Review", "Proofing / Approval", "Materials / Procurement", "Pre-Production", "Print Production", "Fabrication", "Finishing", "Quality Check", "Packaging", "Pickup / Shipping / Delivery", "Installation", "Customer Sign-Off", "Closeout"];
const departments = ["Design", "Prepress", "Production", "Print", "Embroidery", "Screen Printing", "DTF / DTG", "Vinyl", "Fabrication", "QC", "Shipping", "Install", "Customer Support"];
const views = ["Overview", "Gantt Timeline", "List", "Table", "Kanban", "Calendar", "Project Templates", "Tasks", "Milestones", "Approvals", "Install / Delivery", "Blocked Items"];
type ProjectSortMode = "recent" | "oldest";
type AppointmentTimelineFilter = "include" | "only" | "hide";
type GanttFabActionKind = "note" | "user" | "contact" | "photo" | "video" | "file" | "product" | "selection" | "material" | "vendor" | "role";
type GanttFabActionState = { kind: GanttFabActionKind; item: ScheduleItem } | null;
type ScheduleRelationPayload = Record<string, unknown> & {
  relation_type: "participant" | "vendor" | "attachment" | "material" | "event";
};
type ScheduleRelationSummary = {
  products: number;
  selections: number;
  materials: number;
  participants: number;
  clients: number;
  vendors: number;
  photos: number;
  videos: number;
  documents: number;
  notes: number;
};
type ScheduleRelationsResponse = {
  participants?: { schedule_item_id?: string | null; schedule_group_id?: string | null; participant_type?: string | null }[];
  vendors?: { schedule_item_id?: string | null; schedule_group_id?: string | null }[];
  attachments?: { schedule_item_id?: string | null; schedule_group_id?: string | null; file_type?: string | null }[];
  materials?: { schedule_item_id?: string | null; schedule_group_id?: string | null; product_id?: string | null; material_type?: string | null; category?: string | null }[];
  events?: { schedule_item_id?: string | null; schedule_group_id?: string | null; event_type?: string | null }[];
};
type ArtworkUploadResponse = {
  artwork?: {
    id: string;
    filename: string | null;
    storage_path: string | null;
    bucket: string | null;
    mime_type: string | null;
    file_size_bytes: number | string | null;
  };
  proof?: {
    id: string;
    storage_path: string | null;
    proof_url: string | null;
    status: string | null;
    revision_number: number | string | null;
  };
};

type ScheduleProjectGroup = {
  key: string;
  name: string;
  items: ScheduleItem[];
  latest: string;
  oldest: string;
  openCount: number;
  completeCount: number;
  blockedCount: number;
  customerVisibleCount: number;
  orderLabel: string;
  productLabel: string;
};

function human(value: string | null | undefined) {
  return String(value || "none").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string | null | undefined) {
  return String(value || "schedule-item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "schedule-item";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function phoenixDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function phoenixOffsetMinutes(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return clampOffsetMinutes(hour * 60 + minute);
}

function daysBetween(start: string, end: string) {
  const startMs = new Date(`${start}T12:00:00`).getTime();
  const endMs = new Date(`${end}T12:00:00`).getTime();
  return Math.max(0, Math.round((endMs - startMs) / 86400000));
}

function clampOffsetMinutes(value: number) {
  return Math.min(1439, Math.max(0, Math.round(value)));
}

function offsetToFraction(minutes: number | null | undefined) {
  return clampOffsetMinutes(Number(minutes || 0)) / 1440;
}

function formatOffset(minutes: number | null | undefined) {
  const safe = clampOffsetMinutes(Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function offsetToInput(minutes: number | null | undefined) {
  const safe = clampOffsetMinutes(Number(minutes || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function inputToOffset(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return clampOffsetMinutes((hours || 0) * 60 + (minutes || 0));
}

function durationDays(item: ScheduleItem, start: string, end: string) {
  const explicit = Number(item.estimated_duration_days || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return daysBetween(start, end) + 1;
}

function statusTone(status: string) {
  if (["completed", "approved"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["blocked", "on_hold", "reopened"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  if (status.startsWith("waiting_on") || status.includes("review")) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (["in_progress", "ready_for_production", "in_production", "quality_check"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  return "border-border bg-secondary text-secondary-foreground";
}

function priorityTone(priority: string) {
  if (["critical", "blocking_production", "blocking_delivery_install"].includes(priority)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  if (["rush", "high"].includes(priority)) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (priority === "low") return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  return "border-border bg-secondary text-secondary-foreground";
}

function itemTypeLabel(item: ScheduleItem) {
  if (item.source_type === "appointment") return "Appointment";
  if (item.item_type === "production_step" && item.assigned_department) return item.assigned_department;
  return human(item.item_type);
}

function appointmentStatusToScheduleStatus(status: string) {
  if (status === "completed") return "completed";
  if (status === "canceled" || status === "no_show") return "on_hold";
  if (status === "pending") return "needs_internal_review";
  if (status.startsWith("awaiting_")) return "waiting_on_customer";
  return "in_progress";
}

function appointmentToScheduleItem(appointment: BookingAppointment): ScheduleItem {
  const startDate = phoenixDateKey(appointment.start_time);
  const endDate = phoenixDateKey(appointment.end_time);
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const duration = Math.max(0.03, (end.getTime() - start.getTime()) / 86400000);
  const customerName = [appointment.customer_first_name, appointment.customer_last_name].filter(Boolean).join(" ");
  return {
    source_type: "appointment",
    id: `appointment-${appointment.id}`,
    order_id: appointment.related_order_id,
    order_item_id: null,
    production_job_id: appointment.related_job_id,
    product_id: null,
    customer_id: appointment.customer_id,
    schedule_group_id: `appointments-${startDate}`,
    project_name: "Appointments",
    workflow_template_slug: null,
    workflow_template_name: null,
    hidden_from_schedule: false,
    parent_item_id: null,
    title: appointment.title || appointment.booking_appointment_types?.name || "Appointment",
    description: customerName || appointment.customer_email || appointment.company_name,
    item_type: "appointment",
    phase: "Bookings",
    status: appointmentStatusToScheduleStatus(appointment.status),
    priority: appointment.status === "pending" ? "high" : "normal",
    assigned_to_user_id: appointment.assigned_staff_id,
    assigned_department: "Bookings",
    start_date: startDate,
    start_offset_minutes: phoenixOffsetMinutes(appointment.start_time),
    end_date: endDate,
    due_date: endDate,
    estimated_duration_days: duration,
    progress_percent: appointment.status === "completed" ? 100 : 0,
    customer_visible: true,
    internal_only: false,
    is_blocked: appointment.status === "pending",
    blocker_type: null,
    blocker_reason: null,
    artwork_review_status: null,
    proof_status: null,
    production_status: null,
    sort_order: phoenixOffsetMinutes(appointment.start_time),
    internal_notes: appointment.internal_notes,
    customer_notes: appointment.customer_notes,
    created_at: appointment.start_time,
    updated_at: appointment.end_time,
    orders: null,
    order_items: null,
    products: null,
    users: appointment.customer_id ? null : {
      id: appointment.id,
      full_name: customerName || null,
      email: appointment.customer_email,
      phone: appointment.customer_phone,
      company: appointment.company_name,
    },
    assignee: null,
    production_jobs: null,
    appointment,
  };
}

function projectKey(item: ScheduleItem) {
  return item.schedule_group_id || item.order_id || item.production_job_id || item.project_name || `item-${item.id}`;
}

function projectName(item: ScheduleItem, orders: Order[], products: Product[]) {
  if (item.project_name) return item.project_name;
  const order = orders.find((row) => row.id === item.order_id);
  if (order?.order_number) return `Order #${order.order_number}`;
  const product = products.find((row) => row.id === item.product_id);
  if (product?.name) return `${product.name} project`;
  if (item.workflow_template_name) return item.workflow_template_name;
  return item.title || "Unlinked schedule item";
}

function buildProjectGroups(items: ScheduleItem[], orders: Order[], products: Product[], users: AdminUser[]): ScheduleProjectGroup[] {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = projectKey(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return Array.from(groups.entries()).map(([key, groupItems]) => {
    const sorted = [...groupItems].sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));
    const dates = sorted.flatMap((item) => [item.created_at, item.start_date, item.due_date, item.end_date]).filter(Boolean) as string[];
    const latest = dates.length ? dates.reduce((max, value) => value > max ? value : max, dates[0]) : "";
    const oldest = dates.length ? dates.reduce((min, value) => value < min ? value : min, dates[0]) : "";
    const first = sorted[0];
    const order = orders.find((row) => row.id === first.order_id);
    const customer = users.find((row) => row.id === first.customer_id);
    const product = products.find((row) => row.id === first.product_id);
    return {
      key,
      name: projectName(first, orders, products),
      items: sorted,
      latest,
      oldest,
      openCount: sorted.filter((item) => !["completed", "approved"].includes(item.status)).length,
      completeCount: sorted.filter((item) => ["completed", "approved"].includes(item.status)).length,
      blockedCount: sorted.filter((item) => item.is_blocked || item.status === "blocked").length,
      customerVisibleCount: sorted.filter((item) => item.customer_visible).length,
      orderLabel: order?.order_number ? `#${order.order_number}` : customer?.full_name || customer?.email || "Unlinked",
      productLabel: product?.name || first.products?.name || first.order_items?.products?.name || "No product",
    };
  });
}

function sortProjectGroups(groups: ScheduleProjectGroup[], mode: ProjectSortMode) {
  return [...groups].sort((a, b) => {
    const aComplete = a.openCount === 0;
    const bComplete = b.openCount === 0;
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    if (mode === "oldest") return (a.oldest || "").localeCompare(b.oldest || "");
    return (b.latest || "").localeCompare(a.latest || "");
  });
}

function emptyRelationSummary(): ScheduleRelationSummary {
  return {
    products: 0,
    selections: 0,
    materials: 0,
    participants: 0,
    clients: 0,
    vendors: 0,
    photos: 0,
    videos: 0,
    documents: 0,
    notes: 0,
  };
}

function buildRelationSummaries(payload: ScheduleRelationsResponse): Record<string, ScheduleRelationSummary> {
  const summaries: Record<string, ScheduleRelationSummary> = {};
  const ensure = (itemId: string | null | undefined, groupId: string | null | undefined) => {
    const key = itemId ? `item:${itemId}` : groupId ? `group:${groupId}` : null;
    if (!key) return null;
    summaries[key] = summaries[key] || emptyRelationSummary();
    return summaries[key];
  };

  for (const participant of payload.participants ?? []) {
    const summary = ensure(participant.schedule_item_id, participant.schedule_group_id);
    if (!summary) continue;
    const type = String(participant.participant_type || "");
    if (type === "customer" || type === "customer_contact" || type === "contact") summary.clients += 1;
    else summary.participants += 1;
  }

  for (const vendor of payload.vendors ?? []) {
    const summary = ensure(vendor.schedule_item_id, vendor.schedule_group_id);
    if (summary) summary.vendors += 1;
  }

  for (const attachment of payload.attachments ?? []) {
    const summary = ensure(attachment.schedule_item_id, attachment.schedule_group_id);
    if (!summary) continue;
    const type = String(attachment.file_type || "");
    if (type.includes("photo")) summary.photos += 1;
    else if (type === "video") summary.videos += 1;
    else summary.documents += 1;
  }

  for (const material of payload.materials ?? []) {
    const summary = ensure(material.schedule_item_id, material.schedule_group_id);
    if (!summary) continue;
    const type = String(material.material_type || material.category || "").toLowerCase();
    if (type === "selection") summary.selections += 1;
    else if (material.product_id || type === "product") summary.products += 1;
    else summary.materials += 1;
  }

  for (const event of payload.events ?? []) {
    const summary = ensure(event.schedule_item_id, event.schedule_group_id);
    if (summary) summary.notes += 1;
  }

  return summaries;
}

function addRelationCounts(target: ScheduleRelationSummary, source?: ScheduleRelationSummary) {
  if (!source) return target;
  target.products += source.products;
  target.selections += source.selections;
  target.materials += source.materials;
  target.participants += source.participants;
  target.clients += source.clients;
  target.vendors += source.vendors;
  target.photos += source.photos;
  target.videos += source.videos;
  target.documents += source.documents;
  target.notes += source.notes;
  return target;
}

function relationSummaryForItem(item: ScheduleItem, summaries: Record<string, ScheduleRelationSummary>, includeProjectRelations = true) {
  const summary = { ...emptyRelationSummary(), ...(summaries[`item:${item.id}`] || summaries[item.id] || {}) };
  if (includeProjectRelations && item.schedule_group_id) addRelationCounts(summary, summaries[`group:${item.schedule_group_id}`]);
  if (item.product_id) summary.products += 1;
  if (item.assigned_to_user_id) summary.participants += 1;
  if (item.customer_id) summary.clients += 1;
  if (item.internal_notes || item.customer_notes) summary.notes += 1;
  return summary;
}

function combineRelationSummaries(items: ScheduleItem[], summaries: Record<string, ScheduleRelationSummary>) {
  return items.reduce((total, item) => {
    const summary = relationSummaryForItem(item, summaries, false);
    addRelationCounts(total, summary);
    return total;
  }, emptyRelationSummary());
}

function relationSummaryEntries(summary: ScheduleRelationSummary) {
  return [
    { key: "products", label: "product", plural: "products", count: summary.products, icon: Package, tone: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200" },
    { key: "selections", label: "selection", plural: "selections", count: summary.selections, icon: Package, tone: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200" },
    { key: "materials", label: "material", plural: "materials", count: summary.materials, icon: Package, tone: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200" },
    { key: "participants", label: "participant", plural: "participants", count: summary.participants, icon: Users, tone: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-200" },
    { key: "clients", label: "client", plural: "clients", count: summary.clients, icon: UserPlus, tone: "border-lime-500/25 bg-lime-500/10 text-lime-700 dark:text-lime-200", singleText: "Client linked" },
    { key: "vendors", label: "vendor", plural: "vendors", count: summary.vendors, icon: Users, tone: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-200" },
    { key: "photos", label: "photo", plural: "photos", count: summary.photos, icon: Camera, tone: "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-200" },
    { key: "videos", label: "video", plural: "videos", count: summary.videos, icon: Video, tone: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200" },
    { key: "documents", label: "document", plural: "documents", count: summary.documents, icon: FileText, tone: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200" },
    { key: "notes", label: "note", plural: "notes", count: summary.notes, icon: StickyNote, tone: "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-200" },
  ].filter((entry) => entry.count > 0);
}

function relationSummaryText(summary: ScheduleRelationSummary) {
  return relationSummaryEntries(summary)
    .map((entry) => entry.count === 1 && "singleText" in entry && entry.singleText ? entry.singleText : `${entry.count} ${entry.count === 1 ? entry.label : entry.plural}`)
    .join("\n");
}

function RelationIndicators({ summary, compact = false }: { summary: ScheduleRelationSummary; compact?: boolean }) {
  const entries = relationSummaryEntries(summary);
  if (!entries.length) return null;
  const title = relationSummaryText(summary);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", compact && "gap-0.5")} title={title} aria-label={title}>
      {entries.map((entry) => {
        const Icon = entry.icon;
        return (
          <span
            key={entry.key}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-medium",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
              entry.tone,
            )}
          >
            <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            <span>{entry.count}</span>
          </span>
        );
      })}
    </span>
  );
}

async function getAdminToken() {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase is not configured.");
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before managing production schedule.");
  return token;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAdminToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as { error?: string };
    throw new Error(error.error || "Schedule request failed.");
  }
  return payload as T;
}

async function apiFormData<T>(url: string, form: FormData): Promise<T> {
  const token = await getAdminToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as { error?: string };
    throw new Error(error.error || "Upload request failed.");
  }
  return payload as T;
}

export function AdminProductionSchedule() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [dependencies, setDependencies] = useState<ScheduleDependency[]>([]);
  const [relationSummaries, setRelationSummaries] = useState<Record<string, ScheduleRelationSummary>>({});
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [activeView, setActiveView] = useState("Overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentTimelineFilter>("include");
  const [projectSortMode, setProjectSortMode] = useState<ProjectSortMode>("recent");
  const [visibleProjectKeys, setVisibleProjectKeys] = useState<string[]>([]);
  const [expandedProjectKeys, setExpandedProjectKeys] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [selectedDependency, setSelectedDependency] = useState<ScheduleDependency | null>(null);
  const [fabAction, setFabAction] = useState<GanttFabActionState>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialPayload, setCreateInitialPayload] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh(openItemId?: string) {
    const emptyRelations: ScheduleRelationsResponse = { participants: [], vendors: [], attachments: [], materials: [], events: [] };
    const [nextData, itemPayload, dependencyPayload, templatePayload, relationPayload] = await Promise.all([
      loadAdminDashboardData(),
      apiJson<{ items: ScheduleItem[]; appointments?: BookingAppointment[] }>("/api/admin/production-schedule"),
      apiJson<{ dependencies: ScheduleDependency[] }>("/api/admin/production-schedule/dependencies"),
      apiJson<{ templates: WorkflowTemplate[] }>("/api/admin/production-schedule/templates"),
      apiJson<ScheduleRelationsResponse>("/api/admin/production-schedule/relations").catch(() => emptyRelations),
    ]);
    setData(nextData);
    setItems([...(itemPayload.items ?? []), ...(itemPayload.appointments ?? []).map(appointmentToScheduleItem)]);
    setDependencies(dependencyPayload.dependencies);
    setRelationSummaries(buildRelationSummaries(relationPayload));
    setWorkflowTemplates(templatePayload.templates);
    if (openItemId) setSelectedItem(itemPayload.items.find((item) => item.id === openItemId) ?? null);
  }

  useEffect(() => {
    async function boot() {
      try {
        const profile = await getCurrentAdminProfile();
        if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          setAuthState("denied");
          return;
        }
        setAuthState("allowed");
        await refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load production schedule.");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  const orders = data?.orders ?? [];
  const users = data?.users ?? [];
  const products = data?.products ?? [];
  const orderItems = data?.orderItems ?? [];
  const productionJobs = data?.productionJobs ?? [];
  const staff = users.filter((user) => staffRoles.has(user.role));

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (item.source_type === "appointment" && !["Overview", "Gantt Timeline", "Calendar"].includes(activeView)) return false;
      if (appointmentFilter === "hide" && item.source_type === "appointment") return false;
      if (appointmentFilter === "only" && item.source_type !== "appointment") return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (visibilityFilter === "customer" && !item.customer_visible) return false;
      if (visibilityFilter === "internal" && item.customer_visible) return false;
      if (!needle) return true;
      const order = orders.find((row) => row.id === item.order_id);
      const product = products.find((row) => row.id === item.product_id);
      const customer = users.find((row) => row.id === item.customer_id);
      const assignee = users.find((row) => row.id === item.assigned_to_user_id);
      return [
        item.title,
        item.description,
        item.phase,
        item.status,
        item.priority,
        item.assigned_department,
        item.blocker_reason,
        order?.order_number,
        order?.company,
        order?.customer_email,
        product?.name,
        product?.category,
        customer?.full_name,
        customer?.email,
        assignee?.full_name,
        assignee?.email,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [activeView, appointmentFilter, items, orders, priorityFilter, products, query, statusFilter, users, visibilityFilter]);

  const sectionItems = useMemo(() => {
    if (activeView === "Tasks") return visibleItems.filter((item) => ["task", "production_step", "artwork_review", "qc_check"].includes(item.item_type));
    if (activeView === "Milestones") return visibleItems.filter((item) => item.item_type === "milestone");
    if (activeView === "Approvals") return visibleItems.filter((item) => ["approval", "proof", "artwork_review", "customer_action"].includes(item.item_type));
    if (activeView === "Install / Delivery") return visibleItems.filter((item) => ["delivery", "installation"].includes(item.item_type));
    if (activeView === "Blocked Items") return visibleItems.filter((item) => item.is_blocked || item.status === "blocked");
    return visibleItems;
  }, [activeView, visibleItems]);

  const activeItems = items.filter((item) => item.source_type !== "appointment" && !["completed", "approved"].includes(item.status));
  const blockedItems = items.filter((item) => item.is_blocked || item.status === "blocked");
  const overdueItems = items.filter((item) => item.due_date && !["completed", "approved"].includes(item.status) && item.due_date < dateOnly(new Date()));
  const approvalItems = items.filter((item) => ["approval", "proof", "artwork_review", "customer_action"].includes(item.item_type));
  const installItems = items.filter((item) => ["delivery", "installation"].includes(item.item_type));
  const appointmentItems = items.filter((item) => item.source_type === "appointment");
  const projectGroups = useMemo(() => buildProjectGroups(sectionItems.filter((item) => item.source_type !== "appointment"), orders, products, users), [orders, products, sectionItems, users]);
  const sortedProjectGroups = useMemo(() => sortProjectGroups(projectGroups, projectSortMode), [projectGroups, projectSortMode]);
  const sortedProjectGroupKeys = useMemo(() => sortedProjectGroups.map((group) => group.key), [sortedProjectGroups]);
  const visibleProjectSet = useMemo(() => new Set(visibleProjectKeys), [visibleProjectKeys]);
  const ganttItems = useMemo(() => {
    const scheduleItems = sectionItems.filter((item) => item.source_type !== "appointment" && visibleProjectSet.has(projectKey(item)) && !item.hidden_from_schedule);
    const timelineAppointments = sectionItems.filter((item) => item.source_type === "appointment");
    if (appointmentFilter === "hide") return scheduleItems;
    if (appointmentFilter === "only") return timelineAppointments;
    return [...scheduleItems, ...timelineAppointments];
  }, [appointmentFilter, sectionItems, visibleProjectSet]);
  const ganttItemIds = useMemo(() => new Set(ganttItems.map((item) => item.id)), [ganttItems]);
  const ganttDependencies = useMemo(() => dependencies.filter((dependency) => ganttItemIds.has(dependency.parent_item_id) && ganttItemIds.has(dependency.dependent_item_id)), [dependencies, ganttItemIds]);
  const visibleGanttProjectNames = useMemo(
    () => sortedProjectGroups
      .filter((group) => visibleProjectSet.has(group.key) && group.items.some((item) => !item.hidden_from_schedule))
      .map((group) => group.name),
    [sortedProjectGroups, visibleProjectSet],
  );
  const ganttProjectLabel = useMemo(() => {
    if (appointmentFilter === "only") return appointmentItems.length === 1 ? "Appointments only: 1 appointment" : `Appointments only: ${appointmentItems.length} appointments`;
    if (visibleGanttProjectNames.length === 0) return appointmentItems.length && appointmentFilter === "include" ? "Appointments only" : "No project selected";
    if (visibleGanttProjectNames.length === 1) return visibleGanttProjectNames[0];
    const previewNames = visibleGanttProjectNames.slice(0, 2).join(", ");
    return `${visibleGanttProjectNames.length} projects visible: ${previewNames}${visibleGanttProjectNames.length > 2 ? "..." : ""}`;
  }, [appointmentFilter, appointmentItems.length, visibleGanttProjectNames]);

  useEffect(() => {
    const sameKeys = (left: string[], right: string[]) => left.length === right.length && left.every((key, index) => key === right[index]);
    if (!sortedProjectGroupKeys.length) {
      setVisibleProjectKeys((current) => current.length ? [] : current);
      setExpandedProjectKeys((current) => current.length ? [] : current);
      return;
    }
    setVisibleProjectKeys((current) => {
      const valid = current.filter((key) => sortedProjectGroupKeys.includes(key));
      const next = valid.length ? valid : [sortedProjectGroupKeys[0]];
      return sameKeys(current, next) ? current : next;
    });
    setExpandedProjectKeys((current) => {
      const valid = current.filter((key) => sortedProjectGroupKeys.includes(key));
      const next = valid.length ? valid : [sortedProjectGroupKeys[0]];
      return sameKeys(current, next) ? current : next;
    });
  }, [sortedProjectGroupKeys]);

  async function saveItem(input: SchedulePayload) {
    const payload = await apiJson<{ item: ScheduleItem }>("/api/admin/production-schedule", {
      method: input.id ? "PATCH" : "POST",
      body: JSON.stringify(input),
    });
    await refresh(payload.item.id);
    setMessage(input.id ? "Schedule item updated." : "Schedule item created.");
    return payload.item;
  }

  function addRelatedTask(item: ScheduleItem) {
    const start = dateInput(item.end_date || item.due_date || item.start_date) || dateOnly(new Date());
    setCreateInitialPayload({
      ...emptyPayload(),
      order_id: item.order_id,
      order_item_id: item.order_item_id,
      production_job_id: item.production_job_id,
      product_id: item.product_id,
      customer_id: item.customer_id,
      schedule_group_id: item.schedule_group_id,
      project_name: item.project_name || "",
      workflow_template_slug: item.workflow_template_slug,
      workflow_template_name: item.workflow_template_name,
      parent_item_id: item.id,
      phase: item.phase || "",
      start_date: start,
      end_date: start,
      due_date: start,
      sort_order: Number(item.sort_order || 100) + 10,
      customer_visible: item.customer_visible,
      internal_only: item.internal_only,
      title: "",
      description: item.project_name ? `Related to ${item.project_name}.` : `Related to ${item.title}.`,
    });
    setCreateOpen(true);
  }

  async function updateItemDates(item: ScheduleItem, updates: { start_date: string | null; start_offset_minutes?: number | null; end_date: string | null; due_date: string | null; estimated_duration_days?: number | null; sort_order?: number | null }) {
    const nextPayload = {
      ...payloadFromItem(item),
      start_date: updates.start_date,
      start_offset_minutes: updates.start_offset_minutes ?? Number(item.start_offset_minutes || 0),
      end_date: updates.end_date,
      due_date: updates.due_date,
      estimated_duration_days: updates.estimated_duration_days ?? (updates.start_date && updates.end_date ? daysBetween(updates.start_date, updates.end_date) + 1 : Number(item.estimated_duration_days || 0)),
      sort_order: updates.sort_order ?? Number(item.sort_order || 100),
    };
    await saveItem(nextPayload);
  }

  async function deleteItem(item: ScheduleItem) {
    const confirmed = window.confirm(`Delete "${item.title}" from the production schedule?`);
    if (!confirmed) return;
    await apiJson("/api/admin/production-schedule", {
      method: "DELETE",
      body: JSON.stringify({ id: item.id }),
    });
    setSelectedItem(null);
    await refresh();
    setMessage("Schedule item deleted.");
  }

  async function updateTaskAction(item: ScheduleItem, updates: Partial<SchedulePayload>, messageText: string) {
    await apiJson<{ item: ScheduleItem }>("/api/admin/production-schedule", {
      method: "PATCH",
      body: JSON.stringify({ ...payloadFromItem(item), ...updates }),
    });
    setSelectedItem(null);
    await refresh();
    setMessage(messageText);
  }

  async function hideItem(item: ScheduleItem) {
    await updateTaskAction(item, { hidden_from_schedule: true }, `Hidden "${item.title}" from the Gantt timeline. It is still available in Scheduled Items.`);
  }

  async function showItem(item: ScheduleItem) {
    await updateTaskAction(item, { hidden_from_schedule: false }, `Showing "${item.title}" on the Gantt timeline.`);
  }

  async function cancelItem(item: ScheduleItem) {
    await updateTaskAction(item, { status: "on_hold", progress_percent: 0, is_blocked: false }, `Canceled "${item.title}".`);
  }

  async function completeItem(item: ScheduleItem) {
    await updateTaskAction(item, { status: "completed", progress_percent: 100, is_blocked: false }, `Completed "${item.title}".`);
  }

  async function updateItemStatus(item: ScheduleItem, status: string) {
    await updateTaskAction(item, { status, is_blocked: status === "blocked" }, `Moved "${item.title}" to ${human(status)}.`);
  }

  async function createScheduleRelation(item: ScheduleItem, relation: ScheduleRelationPayload) {
    await apiJson<{ relation: unknown }>("/api/admin/production-schedule/relations", {
      method: "POST",
      body: JSON.stringify({
        schedule_item_id: item.id,
        schedule_group_id: item.schedule_group_id,
        project_name: item.project_name,
        order_id: item.order_id,
        order_item_id: item.order_item_id,
        ...relation,
      }),
    });
  }

  async function saveFabAction(item: ScheduleItem, updates: Partial<SchedulePayload>, messageText: string, relation?: ScheduleRelationPayload) {
    if (relation) await createScheduleRelation(item, relation);
    if (Object.keys(updates).length) {
      await updateTaskAction(item, updates, messageText);
    } else {
      setSelectedItem(null);
      await refresh();
      setMessage(messageText);
    }
    setFabAction(null);
  }

  async function uploadFabAttachment(item: ScheduleItem, input: {
    file: File;
    mode: "artwork" | "proof";
    status: string;
    admin_comments: string;
    customer_comments: string;
  }) {
    if (!item.order_id || !item.order_item_id) {
      throw new Error("Attach this task to an order and order item before uploading artwork, proof, photos, videos, or files.");
    }
    const form = new FormData();
    form.append("mode", input.mode);
    form.append("file", input.file);
    form.append("order_id", item.order_id);
    form.append("order_item_id", item.order_item_id);
    form.append("user_id", item.customer_id || "");
    form.append("status", input.status);
    form.append("admin_comments", input.admin_comments);
    form.append("customer_comments", input.customer_comments);
    const uploadResult = await apiFormData<ArtworkUploadResponse>("/api/admin/artwork", form);
    const isProof = input.mode === "proof";
    const fileType = isProof
      ? "proof"
      : input.file.type.startsWith("image/")
        ? "photo"
        : input.file.type.startsWith("video/")
          ? "video"
          : input.file.type === "application/pdf"
            ? "pdf"
            : "document";
    await createScheduleRelation(item, {
      relation_type: "attachment",
      file_type: fileType,
      file_name: uploadResult.artwork?.filename || input.file.name,
      file_url: uploadResult.proof?.proof_url || null,
      storage_path: uploadResult.artwork?.storage_path || uploadResult.proof?.storage_path || null,
      bucket: uploadResult.artwork?.bucket || "artwork",
      mime_type: uploadResult.artwork?.mime_type || input.file.type || "application/octet-stream",
      file_size_bytes: uploadResult.artwork?.file_size_bytes || input.file.size,
      artwork_file_id: uploadResult.artwork?.id || null,
      proof_id: uploadResult.proof?.id || null,
      title: isProof ? "Proof upload" : "Gantt FAB upload",
      description: input.admin_comments,
      approval_status: isProof ? input.status : input.status === "approved" ? "approved" : "pending_review",
      visibility: isProof ? "customer" : "internal",
      notes: input.customer_comments || input.admin_comments,
    });
    await updateTaskAction(item, {
      artwork_review_status: input.mode === "artwork" ? input.status : item.artwork_review_status || "",
      proof_status: input.mode === "proof" ? input.status : item.proof_status || "",
    }, `Uploaded ${input.file.name} and attached it to "${item.title}".`);
    setFabAction(null);
  }

  async function updateProjectAction(group: ScheduleProjectGroup, updates: Partial<SchedulePayload>, messageText: string) {
    const scheduleItems = group.items.filter((item) => item.source_type !== "appointment");
    if (!scheduleItems.length) {
      setMessage(`No editable schedule items found for "${group.name}".`);
      return;
    }
    await Promise.all(scheduleItems.map((item) => apiJson<{ item: ScheduleItem }>("/api/admin/production-schedule", {
      method: "PATCH",
      body: JSON.stringify({ ...payloadFromItem(item), ...updates }),
    })));
    setSelectedItem(null);
    setVisibleProjectKeys((current) => current.filter((key) => key !== group.key));
    await refresh();
    setMessage(messageText);
  }

  async function cancelProject(group: ScheduleProjectGroup) {
    const confirmed = window.confirm(`Cancel every task in "${group.name}" and hide the project from the Gantt timeline?`);
    if (!confirmed) return;
    await updateProjectAction(group, { status: "on_hold", progress_percent: 0, is_blocked: false, hidden_from_schedule: true }, `Canceled "${group.name}" and hid it from the Gantt timeline.`);
  }

  async function completeProject(group: ScheduleProjectGroup) {
    const confirmed = window.confirm(`Mark every task in "${group.name}" complete and hide the project from the Gantt timeline?`);
    if (!confirmed) return;
    await updateProjectAction(group, { status: "completed", progress_percent: 100, is_blocked: false, hidden_from_schedule: true }, `Completed "${group.name}" and hid it from the Gantt timeline.`);
  }

  async function deleteProject(group: ScheduleProjectGroup) {
    const scheduleItems = group.items.filter((item) => item.source_type !== "appointment");
    if (!scheduleItems.length) {
      setMessage(`No editable schedule items found for "${group.name}".`);
      return;
    }
    const confirmed = window.confirm(`Delete "${group.name}" and all ${scheduleItems.length} schedule items? This removes the project from Scheduled Items and the Gantt timeline.`);
    if (!confirmed) return;
    await Promise.all(scheduleItems.map((item) => apiJson("/api/admin/production-schedule", {
      method: "DELETE",
      body: JSON.stringify({ id: item.id }),
    })));
    setSelectedItem(null);
    setVisibleProjectKeys((current) => current.filter((key) => key !== group.key));
    setExpandedProjectKeys((current) => current.filter((key) => key !== group.key));
    await refresh();
    setMessage(`Deleted "${group.name}" and ${scheduleItems.length} schedule items.`);
  }

  async function createDependency(input: {
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days?: number;
    required_completion_date: string | null;
    delay_impact_notes?: string;
    notes?: string;
    auto_shift_schedule: boolean;
  }) {
    const payload = await apiJson<{ dependency: ScheduleDependency }>("/api/admin/production-schedule/dependencies", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await refresh();
    setMessage(`Dependency created for ${payload.dependency.dependency_type.replace(/_/g, " ")}.`);
  }

  async function updateDependency(input: {
    id: string;
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days: number;
    required_completion_date: string | null;
    notes: string;
    auto_shift_schedule: boolean;
  }) {
    const payload = await apiJson<{ dependency: ScheduleDependency }>("/api/admin/production-schedule/dependencies", {
      method: "PATCH",
      body: JSON.stringify({
        ...input,
        delay_impact_notes: input.notes,
      }),
    });
    await refresh();
    setSelectedDependency(payload.dependency);
    setMessage("Dependency updated.");
  }

  async function deleteDependency(dependency: ScheduleDependency) {
    await apiJson("/api/admin/production-schedule/dependencies", {
      method: "DELETE",
      body: JSON.stringify({ id: dependency.id }),
    });
    await refresh();
    setSelectedDependency(null);
    setMessage("Dependency removed.");
  }

  async function applyWorkflowTemplate(input: {
    template_slug: string;
    project_name: string;
    start_date: string;
    order_id: string | null;
    order_item_id: string | null;
    production_job_id: string | null;
    product_id: string | null;
    customer_id: string | null;
  }) {
    const payload = await apiJson<{ created_item_count: number; created_dependency_count: number; template: { name: string } }>("/api/admin/production-schedule/templates", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await refresh();
    setMessage(`Applied ${payload.template.name}: ${payload.created_item_count} items and ${payload.created_dependency_count} dependencies created.`);
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-5 px-2">
            <a href="/admin">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[140px] dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[140px] dark:block" />
            </a>
            <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Super Admin</div>
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
                      className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Production Schedule" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{activeItems.length}</Badge>}
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
              <span className="font-medium text-foreground">Production Schedule</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[420px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search schedule, orders, customers, products..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/production-schedule">Go to login</a></Button></CardContent></Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Project Management / Gantt Schedule</h1>
                  <p className="mt-1 max-w-4xl text-sm leading-5 text-muted-foreground">
                    Schedule design, artwork review, proofing, production, QC, shipping, delivery, installation, blockers, and customer-visible milestones between Orders and Production.
                  </p>
                </div>
                <Button onClick={() => {
                  setCreateInitialPayload(null);
                  setCreateOpen(true);
                }}><Plus className="h-4 w-4" /> Add schedule item</Button>
              </div>

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <ScheduleStat label="Scheduled jobs" value={String(activeItems.length)} hint="Open timeline items" />
                <ScheduleStat label="Blocked" value={String(blockedItems.length)} hint="Needs triage" urgent={blockedItems.length > 0} />
                <ScheduleStat label="Overdue" value={String(overdueItems.length)} hint="Past due date" urgent={overdueItems.length > 0} />
                <ScheduleStat label="Approvals" value={String(approvalItems.length)} hint="Proof and customer action" />
                <ScheduleStat label="Install / delivery" value={String(installItems.length)} hint="Fulfillment schedule" />
                <ScheduleStat label="Appointments" value={String(appointmentItems.length)} hint="Booked calendar items" />
              </section>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {views.map((view) => (
                  <Button key={view} variant={activeView === view ? "default" : "outline"} size="sm" onClick={() => setActiveView(view)}>
                    {view}
                  </Button>
                ))}
                <div className="ml-auto flex flex-wrap gap-2">
                  <FilterSelect value={statusFilter} onChange={setStatusFilter} items={statuses} placeholder="All statuses" />
                  <FilterSelect value={priorityFilter} onChange={setPriorityFilter} items={priorities} placeholder="All priorities" />
                  <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                    <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All visibility</SelectItem>
                      <SelectItem value="customer">Customer visible</SelectItem>
                      <SelectItem value="internal">Internal only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={appointmentFilter} onValueChange={(value) => setAppointmentFilter(value as AppointmentTimelineFilter)}>
                    <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="include">Include appointments</SelectItem>
                      <SelectItem value="only">Appointments only</SelectItem>
                      <SelectItem value="hide">Hide appointments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {message && <div className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>}
              {loading ? (
                <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading production schedule...</CardContent></Card>
              ) : (
                <div className={cn("grid gap-4", activeView === "Project Templates" ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_360px]")}>
                  <div className="space-y-4">
                    {(activeView === "Overview" || activeView === "Gantt Timeline") && (
                      <GanttTimeline
                        items={ganttItems}
                        dependencies={ganttDependencies}
                        projectLabel={ganttProjectLabel}
                        onEdit={setSelectedItem}
                        onAddTask={addRelatedTask}
                        onHide={hideItem}
                        onCancel={cancelItem}
                        onComplete={completeItem}
                        onDelete={deleteItem}
                        onQuickAction={(kind, item) => setFabAction({ kind, item })}
                        onUpdateItemDates={updateItemDates}
                        onCreateDependency={createDependency}
                        onSelectDependency={setSelectedDependency}
                        relationSummaries={relationSummaries}
                      />
                    )}
                    {activeView === "List" && <ScheduleListView items={sectionItems} relationSummaries={relationSummaries} onSelect={setSelectedItem} />}
                    {activeView === "Table" && <ScheduleTableView items={sectionItems} orders={orders} users={users} products={products} relationSummaries={relationSummaries} onSelect={setSelectedItem} />}
                    {activeView === "Kanban" && <ScheduleKanbanView items={sectionItems.filter((item) => item.source_type !== "appointment")} relationSummaries={relationSummaries} onSelect={setSelectedItem} onUpdateStatus={updateItemStatus} />}
                    {activeView === "Calendar" && <ScheduleCalendarView items={sectionItems} relationSummaries={relationSummaries} onSelect={setSelectedItem} />}
                    {activeView === "Project Templates" && (
                      <WorkflowTemplatePanel
                        templates={workflowTemplates}
                        orders={orders}
                        orderItems={orderItems}
                        users={users}
                        products={products}
                        productionJobs={productionJobs}
                        onApply={applyWorkflowTemplate}
                        expanded
                      />
                    )}
                    {activeView !== "List" && activeView !== "Table" && activeView !== "Kanban" && activeView !== "Calendar" && activeView !== "Project Templates" && (
                      <ScheduleProjects
                        groups={sortedProjectGroups}
                        orders={orders}
                        users={users}
                        products={products}
                        visibleKeys={visibleProjectKeys}
                        expandedKeys={expandedProjectKeys}
                        sortMode={projectSortMode}
                        onSortModeChange={(mode) => {
                          setProjectSortMode(mode);
                          setVisibleProjectKeys([]);
                          setExpandedProjectKeys([]);
                        }}
                        onToggleVisible={(key) => {
                          setVisibleProjectKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
                        }}
                        onToggleExpanded={(key) => {
                          setExpandedProjectKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
                        }}
                        onSelect={setSelectedItem}
                        onHide={hideItem}
                        onShow={showItem}
                        onCancel={cancelItem}
                        onComplete={completeItem}
                        onDelete={deleteItem}
                        onCancelProject={cancelProject}
                        onCompleteProject={completeProject}
                        onDeleteProject={deleteProject}
                        relationSummaries={relationSummaries}
                      />
                    )}
                  </div>
                  {activeView !== "Project Templates" && <div className="space-y-4">
                    <WorkflowTemplatePanel
                      templates={workflowTemplates}
                      orders={orders}
                      orderItems={orderItems}
                      users={users}
                      products={products}
                      productionJobs={productionJobs}
                      onApply={applyWorkflowTemplate}
                    />
                    <DependencyPanel items={items} dependencies={dependencies} onCreate={createDependency} onDelete={deleteDependency} />
                  </div>}
                </div>
              )}
            </>
          )}
        </main>

        <ScheduleItemSheet
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateInitialPayload(null);
          }}
          data={data}
          staff={staff}
          initialPayload={createInitialPayload}
          onSave={async (input) => {
            await saveItem(input);
            setCreateOpen(false);
            setCreateInitialPayload(null);
          }}
        />
        <ScheduleItemSheet
          open={Boolean(selectedItem)}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
          item={selectedItem}
          data={data}
          staff={staff}
          onSave={async (input) => {
            await saveItem(input);
          }}
          onDelete={selectedItem ? () => deleteItem(selectedItem) : undefined}
        />
        <DependencyInspector
          dependency={selectedDependency}
          items={items}
          onOpenChange={(open) => {
            if (!open) setSelectedDependency(null);
          }}
          onSave={updateDependency}
          onDelete={deleteDependency}
        />
        <GanttFabActionSheet
          action={fabAction}
          data={data}
          staff={staff}
          onOpenChange={(open) => {
            if (!open) setFabAction(null);
          }}
          onSave={saveFabAction}
          onUpload={uploadFabAttachment}
        />
      </div>
    </div>
  );
}

function ScheduleStat({ label, value, hint, urgent }: { label: string; value: string; hint: string; urgent?: boolean }) {
  return (
    <Card className={cn(urgent && "border-red-500/25")}>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-2 text-[22px] font-semibold leading-none", urgent && "text-red-600 dark:text-red-300")}>{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ value, onChange, items, placeholder }: { value: string; onChange: (value: string) => void; items: string[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {items.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

type ConnectorSide = "start" | "finish";
type DependencyPath = {
  id: string;
  d: string;
  sourceId: string;
  targetId: string;
  dependencyType: string;
  blocked: boolean;
  complete: boolean;
};

type GanttDrag = {
  item: ScheduleItem;
  mode: "move" | "resize-start" | "resize-end";
  pointerStartX: number;
  pointerStartY: number;
  pointerX: number;
  pointerY: number;
  originalStart: string;
  originalEnd: string;
  originalOffsetMinutes: number;
  originalSortOrder: number;
  originalDurationDays: number;
  previewStart: string;
  previewEnd: string;
  previewOffsetMinutes: number;
  previewSortOrder: number;
  previewDurationDays: number;
  moved: boolean;
};

type GanttActionDockState = {
  item: ScheduleItem;
  x: number;
  y: number;
};

function dependencyTypeFromSides(sourceSide: ConnectorSide, targetSide: ConnectorSide) {
  if (sourceSide === "finish" && targetSide === "start") return "finish_to_start";
  if (sourceSide === "start" && targetSide === "start") return "start_to_start";
  if (sourceSide === "finish" && targetSide === "finish") return "finish_to_finish";
  return "start_to_finish";
}

function connectorX(rect: DOMRect, side: ConnectorSide) {
  return side === "finish" ? rect.right : rect.left;
}

function sideFromDependency(type: string, role: "source" | "target"): ConnectorSide {
  if (type === "start_to_start") return "start";
  if (type === "finish_to_finish") return "finish";
  if (type === "start_to_finish") return role === "source" ? "start" : "finish";
  return role === "source" ? "finish" : "start";
}

function GanttTimeline({
  items,
  dependencies,
  projectLabel,
  onEdit,
  onAddTask,
  onHide,
  onCancel,
  onComplete,
  onDelete,
  onQuickAction,
  onUpdateItemDates,
  onCreateDependency,
  onSelectDependency,
  relationSummaries,
}: {
  items: ScheduleItem[];
  dependencies: ScheduleDependency[];
  projectLabel: string;
  onEdit: (item: ScheduleItem) => void;
  onAddTask: (item: ScheduleItem) => void;
  onHide: (item: ScheduleItem) => void;
  onCancel: (item: ScheduleItem) => void;
  onComplete: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
  onQuickAction: (kind: GanttFabActionKind, item: ScheduleItem) => void;
  onUpdateItemDates: (item: ScheduleItem, updates: { start_date: string | null; start_offset_minutes?: number | null; end_date: string | null; due_date: string | null; estimated_duration_days?: number | null; sort_order?: number | null }) => Promise<void>;
  onCreateDependency: (input: {
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days?: number;
    required_completion_date: string | null;
    notes?: string;
    auto_shift_schedule: boolean;
  }) => Promise<void>;
  onSelectDependency: (dependency: ScheduleDependency) => void;
  relationSummaries: Record<string, ScheduleRelationSummary>;
}) {
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [paths, setPaths] = useState<DependencyPath[]>([]);
  const [draftSource, setDraftSource] = useState<{ itemId: string; side: ConnectorSide } | null>(null);
  const [dragState, setDragState] = useState<GanttDrag | null>(null);
  const dragStateRef = useRef<GanttDrag | null>(null);
  const suppressNextSelectRef = useRef(false);
  const [actionDock, setActionDock] = useState<GanttActionDockState | null>(null);
  const [linkMessage, setLinkMessage] = useState("");
  const timelineItems = useMemo(() => [...items].sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100)), [items]);
  const datedItems = items.filter((item) => item.start_date || item.due_date || item.end_date);
  const today = dateOnly(new Date());
  const dates = datedItems.flatMap((item) => [item.start_date, item.due_date, item.end_date]).filter(Boolean) as string[];
  const minDate = dates.length ? dates.reduce((min, value) => value < min ? value : min, dates[0]) : today;
  const maxDate = dates.length ? dates.reduce((max, value) => value > max ? value : max, dates[0]) : dateOnly(addDays(new Date(), 14));
  const timelineStart = dateOnly(addDays(new Date(`${minDate}T12:00:00`), -2));
  const timelineEnd = dateOnly(addDays(new Date(`${maxDate}T12:00:00`), 4));
  const totalDays = Math.max(7, daysBetween(timelineStart, timelineEnd) + 1);
  const ticks = Array.from({ length: Math.min(totalDays, 45) }, (_, index) => dateOnly(addDays(new Date(`${timelineStart}T12:00:00`), index)));
  const dragTooltip = dragState ? {
    label: dragState.mode === "move" ? "Move item" : dragState.mode === "resize-start" ? "Adjust start" : "Adjust end",
    dateRange: `${formatDate(dragState.previewStart)} ${formatOffset(dragState.previewOffsetMinutes)} - ${formatDate(dragState.previewEnd)}`,
    duration: `${Number(dragState.previewDurationDays.toFixed(3))}d duration`,
    rowDelta: dragState.previewSortOrder - dragState.originalSortOrder,
  } : null;

  const openActionDock = useCallback((item: ScheduleItem, clientX: number, clientY: number) => {
    setActionDock({
      item,
      x: Math.min(Math.max(clientX + 14, 12), window.innerWidth - 380),
      y: Math.min(Math.max(clientY + 14, 12), Math.max(12, window.innerHeight - 700)),
    });
    setLinkMessage(item.source_type === "appointment" ? "Appointment selected. Open Bookings to manage calendar details." : `Selected ${item.title}. Choose a quick action.`);
  }, []);

  function closeActionDock() {
    setActionDock(null);
  }

  const recalculatePaths = useCallback(() => {
    const overlay = overlayRef.current;
    const timeline = timelineRef.current;
    if (!overlay || !timeline) return;

    const overlayRect = overlay.getBoundingClientRect();
    const nextPaths = dependencies.flatMap((dependency) => {
      const source = dependency.parent_item_id;
      const target = dependency.dependent_item_id;
      const sourceEl = timeline.querySelector<HTMLElement>(`[data-gantt-id="${source}"]`);
      const targetEl = timeline.querySelector<HTMLElement>(`[data-gantt-id="${target}"]`);
      if (!sourceEl || !targetEl) return [];

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const sourceSide = sideFromDependency(dependency.dependency_type, "source");
      const targetSide = sideFromDependency(dependency.dependency_type, "target");
      const x1 = connectorX(sourceRect, sourceSide) - overlayRect.left;
      const y1 = sourceRect.top + sourceRect.height / 2 - overlayRect.top;
      const x2 = connectorX(targetRect, targetSide) - overlayRect.left;
      const y2 = targetRect.top + targetRect.height / 2 - overlayRect.top;
      const elbow = Math.max(18, Math.abs(x2 - x1) / 2);
      const c1 = sourceSide === "finish" ? x1 + elbow : x1 - elbow;
      const c2 = targetSide === "start" ? x2 - elbow : x2 + elbow;
      const d = `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`;
      const sourceItem = items.find((item) => item.id === source);
      const targetItem = items.find((item) => item.id === target);
      return [{
        id: dependency.id,
        d,
        sourceId: source,
        targetId: target,
        dependencyType: dependency.dependency_type,
        blocked: Boolean(sourceItem?.is_blocked || targetItem?.is_blocked || targetItem?.status === "blocked"),
        complete: Boolean(sourceItem?.status === "completed" && targetItem?.status === "completed"),
      }];
    });
    setPaths(nextPaths);
  }, [dependencies, items]);

  useEffect(() => {
    const timeout = window.setTimeout(recalculatePaths, 0);
    const timeline = timelineRef.current;
    const resizeObserver = new ResizeObserver(recalculatePaths);
    if (timeline) resizeObserver.observe(timeline);
    window.addEventListener("resize", recalculatePaths);
    return () => {
      window.clearTimeout(timeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalculatePaths);
    };
  }, [recalculatePaths]);

  useEffect(() => {
    if (!actionDock) return;

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-gantt-action-dock]") || target?.closest("[data-gantt-id]")) return;
      setActionDock(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActionDock(null);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionDock]);

  const dayWidth = useCallback(() => {
    const grid = timelineRef.current?.querySelector<HTMLElement>("[data-timeline-grid]");
    if (!grid) return 32;
    return Math.max(16, grid.getBoundingClientRect().width / ticks.length);
  }, [ticks.length]);

  const rowHeight = useCallback(() => {
    const row = timelineRef.current?.querySelector<HTMLElement>("[data-gantt-row]");
    return Math.max(48, row?.getBoundingClientRect().height || 62);
  }, []);

  const startDrag = useCallback((event: PointerEvent<HTMLElement>, item: ScheduleItem, mode: GanttDrag["mode"]) => {
    const start = item.start_date || item.due_date || item.end_date || timelineStart;
    const end = item.end_date || item.due_date || start;
    const originalOffsetMinutes = clampOffsetMinutes(Number(item.start_offset_minutes || 0));
    const originalSortOrder = Number(item.sort_order || 100);
    const originalDurationDays = durationDays(item, start, end);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragState({
      item,
      mode,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originalStart: start,
      originalEnd: end,
      originalOffsetMinutes,
      originalSortOrder,
      originalDurationDays,
      previewStart: start,
      previewEnd: end,
      previewOffsetMinutes: originalOffsetMinutes,
      previewSortOrder: originalSortOrder,
      previewDurationDays: originalDurationDays,
      moved: false,
    });
    setLinkMessage(mode === "move" ? "Dragging schedule item. Release to save date changes." : "Resizing schedule item. Release to save duration.");
  }, [timelineStart]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!dragState) return;
    const activeDrag = dragState;

    function handleMove(event: globalThis.PointerEvent) {
      const rawDeltaDays = (event.clientX - activeDrag.pointerStartX) / dayWidth();
      const moved = Math.abs(event.clientX - activeDrag.pointerStartX) > 4 || Math.abs(event.clientY - activeDrag.pointerStartY) > 4;
      const preciseDeltaDays = Math.round(rawDeltaDays * 96) / 96;
      const wholeDayDelta = Math.floor((activeDrag.originalOffsetMinutes / 1440) + preciseDeltaDays);
      const nextOffsetFraction = ((activeDrag.originalOffsetMinutes / 1440) + preciseDeltaDays) - wholeDayDelta;
      const deltaDays = Math.round(rawDeltaDays);
      const deltaRows = Math.round((event.clientY - activeDrag.pointerStartY) / rowHeight());
      const fractionalDelta = Math.round(rawDeltaDays * 8) / 8;
      let previewStart = activeDrag.originalStart;
      let previewEnd = activeDrag.originalEnd;
      let previewOffsetMinutes = activeDrag.originalOffsetMinutes;
      let previewSortOrder = activeDrag.originalSortOrder;
      let previewDurationDays = activeDrag.originalDurationDays;
      if (activeDrag.mode === "move") {
        previewStart = dateOnly(addDays(new Date(`${activeDrag.originalStart}T12:00:00`), wholeDayDelta));
        previewEnd = dateOnly(addDays(new Date(`${activeDrag.originalEnd}T12:00:00`), wholeDayDelta));
        previewOffsetMinutes = clampOffsetMinutes(nextOffsetFraction * 1440);
        previewSortOrder = Math.max(1, activeDrag.originalSortOrder + deltaRows);
      } else if (activeDrag.mode === "resize-start") {
        const proposedStart = dateOnly(addDays(new Date(`${activeDrag.originalStart}T12:00:00`), deltaDays));
        previewStart = proposedStart <= activeDrag.originalEnd ? proposedStart : activeDrag.originalEnd;
        previewDurationDays = Math.max(0.125, activeDrag.originalDurationDays - fractionalDelta);
      } else {
        const proposedEnd = dateOnly(addDays(new Date(`${activeDrag.originalEnd}T12:00:00`), deltaDays));
        previewEnd = proposedEnd >= activeDrag.originalStart ? proposedEnd : activeDrag.originalStart;
        previewDurationDays = Math.max(0.125, activeDrag.originalDurationDays + fractionalDelta);
      }
      setDragState((current) => current ? {
        ...current,
        pointerX: event.clientX,
        pointerY: event.clientY,
        previewStart,
        previewEnd,
        previewOffsetMinutes,
        previewSortOrder,
        previewDurationDays,
        moved: current.moved || moved || Math.abs(event.clientY - activeDrag.pointerStartY) > 4,
      } : current);
      window.requestAnimationFrame(recalculatePaths);
    }

    async function handleUp() {
      const current = dragStateRef.current || activeDrag;
      setDragState(null);
      if (!current.moved) {
        suppressNextSelectRef.current = false;
        openActionDock(current.item, current.pointerX, current.pointerY);
        setLinkMessage("");
        return;
      }
      if (
        current.previewStart === current.originalStart
        && current.previewEnd === current.originalEnd
        && current.previewOffsetMinutes === current.originalOffsetMinutes
        && current.previewSortOrder === current.originalSortOrder
        && current.previewDurationDays === current.originalDurationDays
      ) {
        setLinkMessage("");
        suppressNextSelectRef.current = false;
        return;
      }
      try {
        await onUpdateItemDates(current.item, {
          start_date: current.previewStart,
          start_offset_minutes: current.previewOffsetMinutes,
          end_date: current.previewEnd,
          due_date: current.previewEnd,
          estimated_duration_days: current.previewDurationDays,
          sort_order: current.previewSortOrder,
        });
        setLinkMessage(`Updated ${current.item.title}: ${formatDate(current.previewStart)} ${formatOffset(current.previewOffsetMinutes)} - ${formatDate(current.previewEnd)} (${current.previewDurationDays}d).`);
      } catch (error) {
        setLinkMessage(error instanceof Error ? error.message : "Could not update schedule dates.");
      }
      window.setTimeout(() => {
        suppressNextSelectRef.current = false;
      }, 80);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dayWidth, dragState, onUpdateItemDates, openActionDock, recalculatePaths]);

  async function completeConnection(targetItemId: string, targetSide: ConnectorSide) {
    if (!draftSource) return;
    if (draftSource.itemId === targetItemId) {
      setLinkMessage("A schedule item cannot depend on itself.");
      setDraftSource(null);
      return;
    }
    const dependencyType = dependencyTypeFromSides(draftSource.side, targetSide);
    const duplicate = dependencies.some((dependency) => dependency.parent_item_id === draftSource.itemId && dependency.dependent_item_id === targetItemId && dependency.dependency_type === dependencyType);
    if (duplicate) {
      setLinkMessage("That dependency already exists.");
      setDraftSource(null);
      return;
    }
    try {
      await onCreateDependency({
        parent_item_id: draftSource.itemId,
        dependent_item_id: targetItemId,
        dependency_type: dependencyType,
        lag_days: 0,
        required_completion_date: null,
        notes: "",
        auto_shift_schedule: true,
      });
      setLinkMessage(`Dependency created: ${human(dependencyType)}.`);
    } catch (error) {
      setLinkMessage(error instanceof Error ? error.message : "Could not create dependency.");
    } finally {
      setDraftSource(null);
    }
  }

  function openQuickAction(kind: GanttFabActionKind, item: ScheduleItem) {
    onQuickAction(kind, item);
    closeActionDock();
  }

  function downloadItemExport(item: ScheduleItem, format: "csv" | "pdf") {
    const rows = [
      ["Title", item.title],
      ["Project", item.project_name || "Unlinked"],
      ["Type", itemTypeLabel(item)],
      ["Phase", item.phase || "No phase"],
      ["Status", human(item.status)],
      ["Priority", human(item.priority)],
      ["Start", formatDate(item.start_date)],
      ["Due", formatDate(item.due_date || item.end_date)],
      ["Progress", `${item.progress_percent ?? 0}%`],
    ];
    const content = format === "csv"
      ? rows.map(([key, value]) => `"${String(key).replace(/"/g, "\"\"")}","${String(value).replace(/"/g, "\"\"")}"`).join("\n")
      : rows.map(([key, value]) => `${key}: ${value}`).join("\n");
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(item.project_name || item.title)}-${slugify(item.title)}.${format === "csv" ? "csv" : "txt"}`;
    link.click();
    URL.revokeObjectURL(url);
    setLinkMessage(`${format.toUpperCase()} export prepared for ${item.title}.`);
    closeActionDock();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Gantt timeline</CardTitle>
            <CardDescription>First-pass schedule grid for phases, tasks, milestones, blockers, proof approvals, production, delivery, and install.</CardDescription>
          </div>
          <Badge variant="outline" className="max-w-full truncate px-2.5 py-1 text-xs md:max-w-[420px]" title={projectLabel}>
            {projectLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!items.length ? (
          <EmptyState title="No schedule items yet" description="Add a phase, task, milestone, proof, production step, or delivery item to start building the timeline." />
        ) : (
          <div ref={timelineRef} className="overflow-x-auto" onScroll={recalculatePaths}>
            <div className="relative min-w-[860px]">
              {dragState && dragTooltip && (
                <div
                  className="pointer-events-none fixed z-[80] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
                  style={{
                    left: Math.min(window.innerWidth - 260, Math.max(12, dragState.pointerX + 14)),
                    top: Math.min(window.innerHeight - 110, Math.max(12, dragState.pointerY + 14)),
                  }}
                >
                  <div className="font-semibold">{dragTooltip.label}</div>
                  <div className="mt-0.5 text-muted-foreground">{dragTooltip.dateRange}</div>
                  <div className="mt-0.5 text-muted-foreground">
                    {dragTooltip.duration}
                    {dragTooltip.rowDelta !== 0 ? ` | row ${dragTooltip.rowDelta > 0 ? "+" : ""}${dragTooltip.rowDelta}` : ""}
                  </div>
                </div>
              )}
              {actionDock && (
                <div
                  data-gantt-action-dock
                  className="fixed z-[90] min-h-[680px] w-[360px] rounded-xl border border-primary/20 bg-[hsl(89_48%_16%)] p-3 text-popover-foreground shadow-2xl"
                  style={{ left: actionDock.x, top: actionDock.y }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{actionDock.item.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{itemTypeLabel(actionDock.item)} - {actionDock.item.phase || "No phase"}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={closeActionDock}>Close</Button>
                  </div>
                  {actionDock.item.source_type === "appointment" ? (
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-2">
                      <DockAction icon={CalendarClock} label="View booking" onClick={() => { window.location.href = "/admin/bookings"; }} />
                      <DockAction icon={Download} label="CSV" onClick={() => downloadItemExport(actionDock.item, "csv")} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-white/5 p-2">
                      <DockAction icon={Link2} label="Connect task" onClick={() => {
                        setDraftSource({ itemId: actionDock.item.id, side: "finish" });
                        setLinkMessage("Select another task handle to connect this task.");
                        closeActionDock();
                      }} />
                      <DockAction icon={Plus} label="Add task" onClick={() => {
                        onAddTask(actionDock.item);
                        closeActionDock();
                      }} />
                      <DockAction icon={UserPlus} label="Add user" onClick={() => openQuickAction("user", actionDock.item)} />
                      <DockAction icon={Users} label="Contact" onClick={() => openQuickAction("contact", actionDock.item)} />
                      <DockAction icon={Camera} label="Photo" onClick={() => openQuickAction("photo", actionDock.item)} />
                      <DockAction icon={Video} label="Video" onClick={() => openQuickAction("video", actionDock.item)} />
                      <DockAction icon={FileText} label="File/proof" onClick={() => openQuickAction("file", actionDock.item)} />
                      <DockAction icon={Package} label="Product" onClick={() => openQuickAction("product", actionDock.item)} />
                      <DockAction icon={Package} label="Selection" onClick={() => openQuickAction("selection", actionDock.item)} />
                      <DockAction icon={Package} label="Material" onClick={() => openQuickAction("material", actionDock.item)} />
                      <DockAction icon={Users} label="Vendor" onClick={() => openQuickAction("vendor", actionDock.item)} />
                      <DockAction icon={Users} label="Role" onClick={() => openQuickAction("role", actionDock.item)} />
                      <DockAction icon={StickyNote} label="Note" onClick={() => openQuickAction("note", actionDock.item)} />
                      <DockAction icon={Pencil} label="Edit" onClick={() => {
                        onEdit(actionDock.item);
                        closeActionDock();
                      }} />
                      <DockAction icon={EyeOff} label="Hide" onClick={() => {
                        onHide(actionDock.item);
                        closeActionDock();
                      }} />
                      <DockAction icon={CheckCircle2} label="Complete" onClick={() => {
                        onComplete(actionDock.item);
                        closeActionDock();
                      }} />
                      <DockAction icon={Ban} label="Cancel" onClick={() => {
                        onCancel(actionDock.item);
                        closeActionDock();
                      }} />
                      <DockAction icon={Download} label="CSV" onClick={() => downloadItemExport(actionDock.item, "csv")} />
                      <DockAction icon={FileText} label="PDF" onClick={() => downloadItemExport(actionDock.item, "pdf")} />
                      <DockAction icon={Trash2} label="Delete" danger onClick={() => {
                        onDelete(actionDock.item);
                        closeActionDock();
                      }} />
                    </div>
                  )}
                  <div className="mt-3 rounded-lg border bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                    Drag the center to move. Use the left or right edge handles to resize duration.
                  </div>
                </div>
              )}
              <svg ref={overlayRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
                {paths.map((path) => {
                  const dependency = dependencies.find((item) => item.id === path.id);
                  return (
                    <g key={path.id}>
                      <path
                        d={path.d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="14"
                        className="pointer-events-auto cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (dependency) onSelectDependency(dependency);
                        }}
                      />
                      <path
                        d={path.d}
                        fill="none"
                        stroke={path.blocked ? "rgb(239 68 68)" : path.complete ? "rgb(16 185 129)" : "rgb(132 204 22)"}
                        strokeDasharray={path.dependencyType.includes("start_to") ? "5 4" : undefined}
                        strokeLinecap="round"
                        strokeWidth="2"
                        className="pointer-events-none drop-shadow-sm"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="grid grid-cols-[260px_minmax(600px,1fr)] border-b pb-2 text-[11px] font-medium text-muted-foreground">
                <div>Item</div>
                <div data-timeline-grid className="grid" style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(24px, 1fr))` }}>
                  {ticks.map((tick) => <div key={tick} className={cn("border-l pl-1", tick === today && "text-primary")}>{new Date(`${tick}T12:00:00`).getDate()}</div>)}
                </div>
              </div>
              <div className="divide-y">
                {timelineItems.map((item) => {
                  const preview = dragState?.item.id === item.id ? dragState : null;
                  const relationSummary = relationSummaryForItem(item, relationSummaries);
                  const start = preview?.previewStart || item.start_date || item.due_date || item.end_date || timelineStart;
                  const end = preview?.previewEnd || item.end_date || item.due_date || start;
                  const startOffsetMinutes = preview?.previewOffsetMinutes ?? Number(item.start_offset_minutes || 0);
                  const offset = Math.min(ticks.length - 1, Math.max(0, daysBetween(timelineStart, start) + offsetToFraction(startOffsetMinutes)));
                  const displayDuration = preview?.previewDurationDays ?? durationDays(item, start, end);
                  const span = Math.max(0.125, Math.min(ticks.length - offset, displayDuration));
                  const blocked = item.is_blocked || item.status === "blocked";
                  const readOnlyAppointment = item.source_type === "appointment";
                  const hasDependency = dependencies.some((dependency) => dependency.parent_item_id === item.id || dependency.dependent_item_id === item.id);
                  return (
                    <button
                      key={item.id}
                      data-gantt-row
                      className={cn("grid w-full grid-cols-[260px_minmax(600px,1fr)] py-2 text-left hover:bg-accent/30", draftSource?.itemId === item.id && "bg-primary/10", preview && "bg-primary/15")}
                      onClick={(event) => {
                        if (suppressNextSelectRef.current) return;
                        openActionDock(item, event.clientX, event.clientY);
                      }}
                    >
                      <div className="pr-3">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span>{itemTypeLabel(item)}</span>
                          {readOnlyAppointment && <CalendarClock className="h-3 w-3 text-sky-500" />}
                          {hasDependency && <Link2 className="h-3 w-3" />}
                          {blocked && <Flag className="h-3 w-3 text-red-500" />}
                          {item.customer_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </div>
                        <div className="mt-1">
                          <RelationIndicators summary={relationSummary} compact />
                        </div>
                      </div>
                      <div className="relative grid min-h-9" style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(24px, 1fr))` }}>
                        {ticks.map((tick) => <div key={tick} className={cn("border-l", tick === today && "bg-primary/10")} />)}
                        <div
                          data-gantt-id={item.id}
                          className={cn(
                            "group absolute top-1 h-7 rounded-md border px-7 text-[11px] font-medium leading-7 shadow-sm",
                            readOnlyAppointment ? "cursor-pointer border-sky-500/35 bg-sky-500/20 text-sky-800 dark:text-sky-100" : "cursor-grab active:cursor-grabbing",
                            !readOnlyAppointment && (blocked ? "border-red-500/35 bg-red-500/20 text-red-700 dark:text-red-200" : "border-primary/20 bg-primary/25 text-lime-900 dark:text-lime-100"),
                            preview && "ring-2 ring-primary/60",
                          )}
                          style={{ left: `${(offset / ticks.length) * 100}%`, width: `${(span / ticks.length) * 100}%` }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            if (readOnlyAppointment) return;
                            startDrag(event, item, "move");
                          }}
                        >
                          {!readOnlyAppointment && (
                            <>
                              <span
                                className="absolute inset-y-0 left-0 z-20 flex w-5 cursor-ew-resize items-center justify-center rounded-l-md border-r border-background/35 bg-background/25 text-current opacity-80 transition-opacity hover:bg-primary/40 group-hover:opacity-100"
                                title="Drag to adjust start date and duration"
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  startDrag(event, item, "resize-start");
                                }}
                              >
                                <span className="h-3.5 w-0.5 rounded-full bg-current opacity-80" />
                              </span>
                              <span
                                className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-current opacity-55 transition-opacity group-hover:opacity-90"
                                title="Drag the bar to move date, time, or row"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </span>
                              <ConnectorHandle
                                side="start"
                                active={draftSource?.itemId === item.id && draftSource.side === "start"}
                                onStart={(event) => {
                                  event.stopPropagation();
                                  setDraftSource({ itemId: item.id, side: "start" });
                                  setLinkMessage("Drag to another task handle to create a dependency.");
                                }}
                                onEnd={(event) => {
                                  event.stopPropagation();
                                  completeConnection(item.id, "start");
                                }}
                              />
                            </>
                          )}
                          <span className="block truncate">{readOnlyAppointment ? "Appointment" : `${item.progress_percent ?? 0}% ${human(item.status)}`} | {formatOffset(startOffsetMinutes)} {displayDuration < 1 ? `| ${Number(displayDuration.toFixed(3))}d` : ""}</span>
                          <span className="pointer-events-none absolute -top-2 right-5 z-30 max-w-[160px] overflow-hidden">
                            <RelationIndicators summary={relationSummary} compact />
                          </span>
                          {!readOnlyAppointment && (
                            <>
                              <span
                                className="absolute inset-y-0 right-0 z-20 flex w-5 cursor-ew-resize items-center justify-center rounded-r-md border-l border-background/35 bg-background/25 text-current opacity-80 transition-opacity hover:bg-primary/40 group-hover:opacity-100"
                                title="Drag to adjust end date and duration"
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  startDrag(event, item, "resize-end");
                                }}
                              >
                                <span className="h-3.5 w-0.5 rounded-full bg-current opacity-80" />
                              </span>
                              <ConnectorHandle
                                side="finish"
                                active={draftSource?.itemId === item.id && draftSource.side === "finish"}
                                onStart={(event) => {
                                  event.stopPropagation();
                                  setDraftSource({ itemId: item.id, side: "finish" });
                                  setLinkMessage("Drag to another task handle to create a dependency.");
                                }}
                                onEnd={(event) => {
                                  event.stopPropagation();
                                  completeConnection(item.id, "finish");
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {linkMessage && <div className="mt-3 rounded-lg border bg-background/80 px-3 py-2 text-xs text-muted-foreground">{linkMessage}</div>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectorHandle({
  side,
  active,
  onStart,
  onEnd,
}: {
  side: ConnectorSide;
  active: boolean;
  onStart: (event: PointerEvent<HTMLSpanElement>) => void;
  onEnd: (event: PointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${side} dependency connector`}
      title={`${side === "start" ? "Start" : "Finish"} connector`}
      onPointerDown={onStart}
      onPointerUp={onEnd}
      className={cn(
        "absolute top-1/2 z-30 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-md ring-2 ring-primary/25",
        side === "start" ? "-left-2.5" : "-right-2.5",
        active && "scale-125 bg-red-500 ring-red-500/30",
      )}
    />
  );
}

function DockAction({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className={cn("h-[64px] flex-col gap-1 rounded-lg bg-background/80 px-2 text-xs hover:bg-background", danger && "border-red-500/25 text-red-600 hover:text-red-700 dark:text-red-300")}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="text-center leading-tight">{label}</span>
    </Button>
  );
}

function ScheduleProjects({
  groups,
  orders,
  users,
  products,
  visibleKeys,
  expandedKeys,
  sortMode,
  onSortModeChange,
  onToggleVisible,
  onToggleExpanded,
  onSelect,
  onHide,
  onShow,
  onCancel,
  onComplete,
  onDelete,
  onCancelProject,
  onCompleteProject,
  onDeleteProject,
  relationSummaries,
}: {
  groups: ScheduleProjectGroup[];
  orders: Order[];
  users: AdminUser[];
  products: Product[];
  visibleKeys: string[];
  expandedKeys: string[];
  sortMode: ProjectSortMode;
  onSortModeChange: (mode: ProjectSortMode) => void;
  onToggleVisible: (key: string) => void;
  onToggleExpanded: (key: string) => void;
  onSelect: (item: ScheduleItem) => void;
  onHide: (item: ScheduleItem) => void;
  onShow: (item: ScheduleItem) => void;
  onCancel: (item: ScheduleItem) => void;
  onComplete: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
  onCancelProject: (group: ScheduleProjectGroup) => void;
  onCompleteProject: (group: ScheduleProjectGroup) => void;
  onDeleteProject: (group: ScheduleProjectGroup) => void;
  relationSummaries: Record<string, ScheduleRelationSummary>;
}) {
  const visibleSet = new Set(visibleKeys);
  const expandedSet = new Set(expandedKeys);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Scheduled items</CardTitle>
            <CardDescription>Expandable project groups. Toggle projects to show or hide them on the Gantt timeline.</CardDescription>
          </div>
          <Select value={sortMode} onValueChange={(value) => onSortModeChange(value as ProjectSortMode)}>
            <SelectTrigger className="h-9 w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Default: most recent open</SelectItem>
              <SelectItem value="oldest">Default: oldest open</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!groups.length && <EmptyState title="No matching schedule projects" description="Adjust filters or apply a workflow template to create a project group." />}
        {groups.map((group) => {
          const expanded = expandedSet.has(group.key);
          const visible = visibleSet.has(group.key);
          const groupSummary = combineRelationSummaries(group.items, relationSummaries);
          addRelationCounts(groupSummary, relationSummaries[`group:${group.key}`]);
          return (
            <div key={group.key} className={cn("overflow-hidden rounded-lg border bg-background/35", visible && "border-primary/35")}>
              <div className="flex flex-wrap items-center gap-3 p-3">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onToggleExpanded(group.key)}>{expanded ? "Hide" : "Open"}</Button>
                <button className="min-w-[260px] flex-1 text-left" onClick={() => onToggleExpanded(group.key)}>
                  <div className="font-semibold">{group.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{group.orderLabel} | {group.productLabel} | {group.items.length} schedule items</div>
                  <div className="mt-2">
                    <RelationIndicators summary={groupSummary} />
                  </div>
                </button>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{group.openCount} open</Badge>
                  <Badge variant="outline">{group.customerVisibleCount} visible</Badge>
                  {group.items.some((item) => item.hidden_from_schedule) && <Badge variant="outline">{group.items.filter((item) => item.hidden_from_schedule).length} hidden on Gantt</Badge>}
                  {group.blockedCount > 0 && <Badge className="border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">{group.blockedCount} blocked</Badge>}
                </div>
                <Button variant={visible ? "default" : "outline"} size="sm" onClick={() => onToggleVisible(group.key)}>
                  {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {visible ? "Hide from Gantt" : "Show on Gantt"}
                </Button>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    title="Cancel every task in this project and hide it from the Gantt"
                    onClick={() => onCancelProject(group)}
                  >
                    <Ban className="h-4 w-4" />
                    Cancel project
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="Complete every task in this project and hide it from the Gantt"
                    onClick={() => onCompleteProject(group)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Complete project
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="Delete this project and all schedule items"
                    className="text-red-600 hover:text-red-700 dark:text-red-300"
                    onClick={() => onDeleteProject(group)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete project
                  </Button>
                </div>
              </div>
              {expanded && (
                <div className="border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Item</TableHead>
              <TableHead>Order / customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.map((item) => {
              const order = orders.find((row) => row.id === item.order_id);
              const customer = users.find((row) => row.id === item.customer_id);
              const assignee = users.find((row) => row.id === item.assigned_to_user_id);
              const product = products.find((row) => row.id === item.product_id);
              const relationSummary = relationSummaryForItem(item, relationSummaries);
              return (
                <TableRow key={item.id} className="cursor-pointer hover:bg-accent/45" onClick={() => onSelect(item)}>
                  <TableCell className="pl-4">
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                      <span>{itemTypeLabel(item)}</span>
                      <span>•</span>
                      <span>{item.phase || "No phase"}</span>
                      {item.customer_visible && <span>• Customer visible</span>}
                      {item.is_blocked && <span className="text-red-600 dark:text-red-300">• Blocked</span>}
                      {item.hidden_from_schedule && <span className="text-amber-600 dark:text-amber-300">• Hidden on Gantt</span>}
                    </div>
                    <div className="mt-2">
                      <RelationIndicators summary={relationSummary} compact />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">#{order?.order_number || item.orders?.order_number || item.order_id?.slice(0, 8) || "Unlinked"}</div>
                    <div className="text-xs text-muted-foreground">{customer?.full_name || customer?.email || order?.company || order?.customer_email || "No customer"}</div>
                  </TableCell>
                  <TableCell>{product?.name || item.products?.name || item.order_items?.products?.name || "Not linked"}</TableCell>
                  <TableCell><Badge className={cn("border", statusTone(item.status))}>{human(item.status)}</Badge></TableCell>
                  <TableCell><Badge className={cn("border", priorityTone(item.priority))}>{human(item.priority)}</Badge></TableCell>
                  <TableCell>{assignee?.full_name || assignee?.email || item.assignee?.full_name || "Unassigned"}</TableCell>
                  <TableCell>{formatDate(item.due_date || item.end_date)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={item.hidden_from_schedule ? "Show schedule item on Gantt" : "Hide schedule item from Gantt"}
                        title={item.hidden_from_schedule ? "Show on Gantt" : "Hide from Gantt only"}
                        className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", item.hidden_from_schedule && "text-amber-600 dark:text-amber-300")}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (item.hidden_from_schedule) onShow(item);
                          else onHide(item);
                        }}
                      >
                        {item.hidden_from_schedule ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Cancel schedule item"
                        title="Cancel task"
                        className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCancel(item);
                        }}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Complete schedule item"
                        title="Complete task"
                        className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          onComplete(item);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove schedule item"
                        title="Remove task"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(item);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ScheduleItemMiniCard({ item, relationSummaries, onSelect }: { item: ScheduleItem; relationSummaries: Record<string, ScheduleRelationSummary>; onSelect: (item: ScheduleItem) => void }) {
  const relationSummary = relationSummaryForItem(item, relationSummaries);
  return (
    <button className="w-full rounded-lg border bg-background/45 p-3 text-left transition-colors hover:bg-accent/45" onClick={() => onSelect(item)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{item.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{item.project_name || "Unlinked project"} | {itemTypeLabel(item)} | {item.phase || "No phase"}</div>
        </div>
        <Badge className={cn("shrink-0 border", statusTone(item.status))}>{human(item.status)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDate(item.start_date || item.created_at)}</span>
        <span>to</span>
        <span>{formatDate(item.due_date || item.end_date)}</span>
        {item.source_type === "appointment" && <CalendarClock className="h-3.5 w-3.5 text-sky-500" />}
        {item.is_blocked && <Flag className="h-3.5 w-3.5 text-red-500" />}
      </div>
      <div className="mt-2">
        <RelationIndicators summary={relationSummary} compact />
      </div>
    </button>
  );
}

function ScheduleListView({ items, relationSummaries, onSelect }: { items: ScheduleItem[]; relationSummaries: Record<string, ScheduleRelationSummary>; onSelect: (item: ScheduleItem) => void }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ScheduleItem[] }>();
    for (const item of items) {
      const key = item.schedule_group_id || item.order_id || item.project_name || `solo-${item.id}`;
      const name = item.project_name || (item.order_id ? `Order ${item.orders?.order_number ? `#${item.orders.order_number}` : item.order_id.slice(0, 8)}` : item.title);
      if (!map.has(key)) map.set(key, { name, items: [] });
      map.get(key)!.items.push(item);
    }
    return map;
  }, [items]);

  function toggle(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const statusDot = (item: ScheduleItem) => cn(
    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
    ["completed", "approved"].includes(item.status) ? "bg-emerald-500" :
    (item.is_blocked || item.status === "blocked") ? "bg-red-500" :
    item.status === "in_progress" || item.status === "in_production" ? "bg-primary" :
    item.status.startsWith("waiting_") ? "bg-amber-500" :
    "bg-muted-foreground/35",
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">List view</CardTitle>
        <CardDescription>Project-grouped list. Expand a project to see its tasks, milestones, phases, and approvals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!items.length && <EmptyState title="No schedule items" description="Adjust filters or add a schedule item to populate this view." />}
        {[...grouped.entries()].map(([key, group]) => {
          const expanded = expandedKeys.has(key);
          const open = group.items.filter((i) => !["completed", "approved"].includes(i.status)).length;
          const blocked = group.items.filter((i) => i.is_blocked || i.status === "blocked").length;
          const done = group.items.filter((i) => ["completed", "approved"].includes(i.status)).length;
          return (
            <div key={key} className="overflow-hidden rounded-lg border">
              <button
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/30"
                onClick={() => toggle(key)}
              >
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{group.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{group.items.length} items</span>
                    {open > 0 && <span>{open} open</span>}
                    {done > 0 && <span className="text-emerald-600 dark:text-emerald-400">{done} done</span>}
                    {blocked > 0 && <span className="text-red-600 dark:text-red-400">{blocked} blocked</span>}
                  </div>
                </div>
                {done === group.items.length && group.items.length > 0 && (
                  <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">Complete</Badge>
                )}
              </button>
              {expanded && (
                <div className="divide-y border-t">
                  {group.items.map((item) => {
                    const rel = relationSummaryForItem(item, relationSummaries);
                    return (
                      <button
                        key={item.id}
                        className="flex w-full items-start gap-3 p-3 text-left hover:bg-accent/20"
                        onClick={() => onSelect(item)}
                      >
                        <div className={statusDot(item)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {itemTypeLabel(item)}
                            {item.phase ? ` · ${item.phase}` : ""}
                            {item.assigned_department ? ` · ${item.assigned_department}` : ""}
                          </div>
                          {(rel.participants + rel.photos + rel.documents + rel.notes + rel.products + rel.vendors) > 0 && (
                            <div className="mt-1.5"><RelationIndicators summary={rel} compact /></div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge className={cn("border text-[10px]", statusTone(item.status))}>{human(item.status)}</Badge>
                          <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(item.due_date || item.end_date)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ScheduleTableView({
  items,
  orders,
  users,
  products,
  relationSummaries,
  onSelect,
}: {
  items: ScheduleItem[];
  orders: Order[];
  users: AdminUser[];
  products: Product[];
  relationSummaries: Record<string, ScheduleRelationSummary>;
  onSelect: (item: ScheduleItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Table view</CardTitle>
        <CardDescription>{items.length} schedule items — full detail rows for sorting, comparison, and bulk review.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {!items.length && <EmptyState title="No schedule items" description="Adjust filters or add a schedule item to populate this view." />}
        {items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Item</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead>Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const order = orders.find((row) => row.id === item.order_id);
                const customer = users.find((row) => row.id === item.customer_id);
                const assignee = users.find((row) => row.id === item.assigned_to_user_id);
                const product = products.find((row) => row.id === item.product_id);
                const rel = relationSummaryForItem(item, relationSummaries);
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-accent/45" onClick={() => onSelect(item)}>
                    <TableCell>
                      <div className="font-medium leading-tight">{item.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{itemTypeLabel(item)}{item.is_blocked ? " · Blocked" : ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[140px] truncate text-sm">{item.project_name || "Unlinked"}</div>
                      {order?.order_number && <div className="font-mono text-[11px] text-muted-foreground">#{order.order_number}</div>}
                    </TableCell>
                    <TableCell><div className="text-xs">{item.phase || "—"}</div></TableCell>
                    <TableCell><Badge className={cn("border text-[10px]", statusTone(item.status))}>{human(item.status)}</Badge></TableCell>
                    <TableCell><Badge className={cn("border text-[10px]", priorityTone(item.priority))}>{human(item.priority)}</Badge></TableCell>
                    <TableCell><div className="text-xs">{assignee?.full_name || assignee?.email || item.assignee?.full_name || "—"}</div></TableCell>
                    <TableCell><div className="max-w-[120px] truncate text-xs">{customer?.full_name || customer?.email || order?.company || order?.customer_email || "—"}</div></TableCell>
                    <TableCell><div className="max-w-[120px] truncate text-xs">{product?.name || item.products?.name || item.order_items?.products?.name || "—"}</div></TableCell>
                    <TableCell><div className="text-xs">{formatDate(item.start_date)}</div></TableCell>
                    <TableCell><div className="text-xs">{formatDate(item.due_date || item.end_date)}</div></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.progress_percent ?? 0}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{item.progress_percent ?? 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell><RelationIndicators summary={rel} compact /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleKanbanView({
  items,
  relationSummaries,
  onSelect,
  onUpdateStatus,
}: {
  items: ScheduleItem[];
  relationSummaries: Record<string, ScheduleRelationSummary>;
  onSelect: (item: ScheduleItem) => void;
  onUpdateStatus: (item: ScheduleItem, status: string) => Promise<void>;
}) {
  const columns = ["not_started", "in_progress", "waiting_on_customer", "needs_internal_review", "ready_for_production", "in_production", "quality_check", "blocked", "completed"];
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const draggedItem = draggedItemId ? items.find((i) => i.id === draggedItemId) : null;

  async function handleDrop(targetStatus: string) {
    const item = draggedItem;
    setDraggedItemId(null);
    setDragOverColumn(null);
    if (!item || item.status === targetStatus) return;
    await onUpdateStatus(item, targetStatus);
  }

  const columnColors: Record<string, string> = {
    blocked: "border-red-500/30 dark:border-red-500/20",
    completed: "border-emerald-500/30 dark:border-emerald-500/20",
    in_production: "border-primary/30",
    quality_check: "border-amber-500/30",
  };

  const columnHeaderColors: Record<string, string> = {
    blocked: "text-red-600 dark:text-red-300",
    completed: "text-emerald-600 dark:text-emerald-300",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Kanban view</CardTitle>
        <CardDescription>Drag cards between columns to update status. Same data as the Gantt timeline and all other views.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex min-w-[1200px] gap-3">
          {columns.map((status) => {
            const columnItems = items.filter((item) => item.status === status || (status === "blocked" && item.is_blocked && item.status !== "blocked"));
            const isDragOver = dragOverColumn === status;
            return (
              <div
                key={status}
                className={cn(
                  "flex w-[160px] shrink-0 flex-col rounded-lg border bg-background/35 transition-colors",
                  columnColors[status] ?? "border-border",
                  isDragOver && "border-primary bg-primary/5",
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null); }}
                onDrop={(e) => { e.preventDefault(); handleDrop(status); }}
              >
                <div className="border-b p-2.5">
                  <div className={cn("text-xs font-semibold", columnHeaderColors[status] ?? "text-foreground")}>{human(status)}</div>
                  <div className="text-[11px] text-muted-foreground">{columnItems.length}</div>
                </div>
                <div className="min-h-[60px] flex-1 space-y-1.5 p-2">
                  {columnItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedItemId(item.id)}
                      onDragEnd={() => { setDraggedItemId(null); setDragOverColumn(null); }}
                      className={cn("cursor-grab active:cursor-grabbing", draggedItemId === item.id && "opacity-40")}
                    >
                      <ScheduleItemMiniCard item={item} relationSummaries={relationSummaries} onSelect={onSelect} />
                    </div>
                  ))}
                  {columnItems.length === 0 && isDragOver && (
                    <div className="rounded-md border-2 border-dashed border-primary/40 p-2 text-center text-[11px] text-muted-foreground">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleCalendarView({ items, relationSummaries, onSelect }: { items: ScheduleItem[]; relationSummaries: Record<string, ScheduleRelationSummary>; onSelect: (item: ScheduleItem) => void }) {
  const todayStr = dateOnly(new Date());
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [calMode, setCalMode] = useState<"month" | "week">("month");

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(viewDate);
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calDays: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(new Date(year, month, d));

  // Week view: anchor to Sunday of the week containing viewDate
  const weekStart = useMemo(() => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [viewDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart],
  );
  const weekLabel = `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekDays[0])} – ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(weekDays[6])}`;

  function minutesToTime(mins: number | null) {
    if (mins === null) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? "p" : "a";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, "0")}${period}`;
  }

  function itemsForDay(day: Date): ScheduleItem[] {
    const key = dateOnly(day);
    const dayItems = items.filter((item) => item.start_date === key || item.due_date === key || item.end_date === key);
    return dayItems.sort((a, b) => {
      // Appointments rise to top, sorted by start time; tasks follow
      if (a.source_type === "appointment" && b.source_type !== "appointment") return -1;
      if (a.source_type !== "appointment" && b.source_type === "appointment") return 1;
      if (a.source_type === "appointment" && b.source_type === "appointment") {
        return (a.start_offset_minutes ?? 0) - (b.start_offset_minutes ?? 0);
      }
      return 0;
    });
  }

  const unscheduled = items.filter((item) => !item.start_date && !item.due_date && !item.end_date && item.source_type !== "appointment");

  function barClass(item: ScheduleItem) {
    if (item.source_type === "appointment") return "bg-sky-500/20 text-sky-800 dark:text-sky-200 border-sky-500/30";
    if (item.is_blocked || item.status === "blocked") return "bg-red-500/20 text-red-700 dark:text-red-200 border-red-500/30";
    if (["completed", "approved"].includes(item.status)) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/30";
    return "bg-primary/20 text-lime-900 dark:text-lime-100 border-primary/30";
  }

  function prevPeriod() {
    if (calMode === "month") setViewDate(new Date(year, month - 1, 1));
    else setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
  }
  function nextPeriod() {
    if (calMode === "month") setViewDate(new Date(year, month + 1, 1));
    else setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
  }

  const calLegend = [
    { label: "Appointment", cls: "bg-sky-500/20 border-sky-500/30" },
    { label: "Task / Milestone", cls: "bg-primary/20 border-primary/30" },
    { label: "Completed", cls: "bg-emerald-500/20 border-emerald-500/30" },
    { label: "Blocked", cls: "bg-red-500/20 border-red-500/30" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Calendar view</CardTitle>
            <CardDescription>Tasks, milestones, due dates, installs, deliveries, and appointments.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border">
              <button
                className={cn("px-3 py-1.5 text-xs font-medium transition-colors", calMode === "month" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent")}
                onClick={() => setCalMode("month")}
              >Month</button>
              <button
                className={cn("border-l px-3 py-1.5 text-xs font-medium transition-colors", calMode === "week" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent")}
                onClick={() => setCalMode("week")}
              >Week</button>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevPeriod}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[160px] text-center text-sm font-semibold">{calMode === "month" ? monthLabel : weekLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextPeriod}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setViewDate(new Date())}>Today</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>

        {calMode === "month" ? (
          <div className="grid grid-cols-7 gap-px rounded-lg border bg-border overflow-hidden">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-muted/60 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
            ))}
            {calDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="min-h-[90px] bg-muted/20" />;
              const dayStr = dateOnly(day);
              const dayItems = itemsForDay(day);
              const isToday = dayStr === todayStr;
              return (
                <div key={dayStr} className={cn("min-h-[90px] bg-background p-1.5 transition-colors hover:bg-accent/20", isToday && "bg-primary/5 ring-1 ring-inset ring-primary/40")}>
                  <div className={cn("mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium", isToday && "bg-primary text-primary-foreground font-bold")}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        title={item.title}
                        className={cn("block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium leading-4 transition-opacity hover:opacity-80", barClass(item))}
                        onClick={() => onSelect(item)}
                      >
                        {item.source_type === "appointment" && item.start_offset_minutes != null
                          ? `${minutesToTime(item.start_offset_minutes)} · ${item.title}`
                          : item.title}
                      </button>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="px-1 text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border" style={{ minWidth: 560 }}>
              {weekDays.map((day) => {
                const dayStr = dateOnly(day);
                const isToday = dayStr === todayStr;
                const dayItems = itemsForDay(day);
                const appts = dayItems.filter((item) => item.source_type === "appointment");
                const tasks = dayItems.filter((item) => item.source_type !== "appointment");
                return (
                  <div key={dayStr} className={cn("flex min-h-[200px] flex-col bg-background", isToday && "bg-primary/5")}>
                    <div className={cn("border-b px-2 py-1.5 text-center", isToday && "bg-primary/10")}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}
                      </div>
                      <div className={cn("mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", isToday ? "bg-primary text-primary-foreground" : "text-foreground")}>
                        {day.getDate()}
                      </div>
                    </div>
                    <div className="flex-1 space-y-0.5 p-1">
                      {appts.map((item) => (
                        <button
                          key={item.id}
                          className={cn("block w-full rounded border px-1.5 py-1 text-left transition-opacity hover:opacity-80", barClass(item))}
                          onClick={() => onSelect(item)}
                        >
                          {item.start_offset_minutes != null && (
                            <div className="text-[9px] font-semibold leading-3 opacity-80">{minutesToTime(item.start_offset_minutes)}</div>
                          )}
                          <div className="truncate text-[10px] font-medium leading-4">{item.title}</div>
                        </button>
                      ))}
                      {tasks.map((item) => (
                        <button
                          key={item.id}
                          className={cn("block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium leading-4 transition-opacity hover:opacity-80", barClass(item))}
                          onClick={() => onSelect(item)}
                        >
                          {item.title}
                        </button>
                      ))}
                      {dayItems.length === 0 && (
                        <div className="pt-4 text-center text-[10px] text-muted-foreground/40">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3">
          {calLegend.map(({ label, cls }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-2.5 w-2.5 rounded-sm border", cls)} />
              {label}
            </span>
          ))}
        </div>

        {unscheduled.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unscheduled ({unscheduled.length})</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {unscheduled.map((item) => (
                <ScheduleItemMiniCard key={item.id} item={item} relationSummaries={relationSummaries} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )}

        {!items.length && <EmptyState title="No calendar items" description="Adjust filters or include appointments to populate the calendar." />}
      </CardContent>
    </Card>
  );
}

function WorkflowTemplatePanel({
  templates,
  orders,
  orderItems,
  users,
  products,
  productionJobs,
  onApply,
  expanded,
}: {
  templates: WorkflowTemplate[];
  orders: Order[];
  orderItems: OrderItem[];
  users: AdminUser[];
  products: Product[];
  productionJobs: ProductionJob[];
  onApply: (input: {
    template_slug: string;
    project_name: string;
    start_date: string;
    order_id: string | null;
    order_item_id: string | null;
    production_job_id: string | null;
    product_id: string | null;
    customer_id: string | null;
  }) => Promise<void>;
  expanded?: boolean;
}) {
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug || "none");
  const [projectName, setProjectName] = useState("");
  const [startDate, setStartDate] = useState(dateOnly(new Date()));
  const [orderId, setOrderId] = useState("none");
  const [orderItemId, setOrderItemId] = useState("none");
  const [customerId, setCustomerId] = useState("none");
  const [productId, setProductId] = useState("none");
  const [jobId, setJobId] = useState("none");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (templateSlug === "none" && templates[0]) setTemplateSlug(templates[0].slug);
  }, [templateSlug, templates]);

  const selectedTemplate = templates.find((template) => template.slug === templateSlug);
  const selectedOrder = orders.find((order) => order.id === orderId);
  const selectedOrderItems = orderItems.filter((item) => item.order_id === orderId);

  function updateOrder(value: string) {
    const order = orders.find((row) => row.id === value);
    setOrderId(value);
    setOrderItemId("none");
    if (order?.user_id) setCustomerId(order.user_id);
  }

  function updateOrderItem(value: string) {
    const line = orderItems.find((item) => item.id === value);
    setOrderItemId(value);
    if (line?.products?.id) setProductId(line.products.id);
  }

  async function apply() {
    if (!selectedTemplate) {
      setMessage("Select a workflow template first.");
      return;
    }
    setSaving(true);
    setMessage("Applying workflow template...");
    try {
      await onApply({
        template_slug: selectedTemplate.slug,
        project_name: projectName.trim() || selectedTemplate.name,
        start_date: startDate,
        order_id: orderId === "none" ? null : orderId,
        order_item_id: orderItemId === "none" ? null : orderItemId,
        production_job_id: jobId === "none" ? null : jobId,
        product_id: productId === "none" ? null : productId,
        customer_id: customerId === "none" ? null : customerId,
      });
      setMessage("Workflow template applied.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not apply workflow template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Workflow templates</CardTitle>
        <CardDescription>Apply repeatable print, design, approval, production, fulfillment, install, and digital card workflows.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldSelect label="Template" value={templateSlug} onChange={setTemplateSlug} items={templates.map((template) => ({ value: template.slug, label: `${template.name} (${template.item_count})` }))} placeholder="Select template" />
        {selectedTemplate && (
          <div className="rounded-lg border bg-secondary/20 p-3">
            <div className="text-sm font-medium">{selectedTemplate.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{selectedTemplate.description}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline">{human(selectedTemplate.category)}</Badge>
              <Badge variant="outline">{selectedTemplate.item_count} items</Badge>
              <Badge variant="outline">{selectedTemplate.items.filter((item) => item.customer_visible).length} customer visible</Badge>
            </div>
            <div className={cn("mt-3 space-y-1 text-xs text-muted-foreground", expanded ? "grid gap-1 sm:grid-cols-2 xl:grid-cols-3" : "max-h-40 overflow-y-auto pr-1")}>
              {selectedTemplate.items.slice(0, expanded ? selectedTemplate.items.length : 12).map((item, index) => <div key={item.key}>{index + 1}. {item.title} <span className="opacity-70">({item.phase})</span></div>)}
              {!expanded && selectedTemplate.items.length > 12 && <div>+ {selectedTemplate.items.length - 12} more items</div>}
            </div>
          </div>
        )}
        <TextField label="Project name" value={projectName} onChange={setProjectName} placeholder={selectedTemplate ? `${selectedTemplate.name} project` : "Project name"} />
        <DateField label="Workflow start date" value={startDate} onChange={setStartDate} />
        <FieldSelect label="Order" value={orderId} onChange={updateOrder} items={orders.map((order) => ({ value: order.id, label: `#${order.order_number || order.id.slice(0, 8)} - ${order.users?.full_name || order.company || order.customer_email || "Customer"}` }))} placeholder="No order" />
        <FieldSelect label="Order item" value={orderItemId} onChange={updateOrderItem} items={selectedOrderItems.map((line) => ({ value: line.id, label: `${line.products?.name || "Product"} - Qty ${line.quantity || 1}` }))} placeholder="No line item" />
        <FieldSelect label="Customer / user" value={customerId} onChange={setCustomerId} items={users.map((user) => ({ value: user.id, label: `${user.full_name || user.email || "User"} - ${human(user.role)}` }))} placeholder="No customer" />
        <FieldSelect label="Product" value={productId} onChange={setProductId} items={products.map((product) => ({ value: product.id, label: `${product.name} - ${product.category}` }))} placeholder="No product" />
        <FieldSelect label="Production job" value={jobId} onChange={setJobId} items={productionJobs.map((job) => ({ value: job.id, label: `${job.station || "Job"} - ${human(job.status)}` }))} placeholder="No production job" />
        {selectedOrder && <div className="text-xs text-muted-foreground">Template will attach to #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}.</div>}
        {message && <div className="rounded-lg border bg-background/35 p-3 text-xs text-muted-foreground">{message}</div>}
        <Button className="w-full" onClick={apply} disabled={saving || !selectedTemplate}>
          <Plus className="h-4 w-4" /> {saving ? "Applying..." : "Apply workflow template"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DependencyPanel({
  items,
  dependencies,
  onCreate,
  onDelete,
}: {
  items: ScheduleItem[];
  dependencies: ScheduleDependency[];
  onCreate: (input: {
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days?: number;
    required_completion_date: string | null;
    delay_impact_notes?: string;
    notes?: string;
    auto_shift_schedule: boolean;
  }) => Promise<void>;
  onDelete: (dependency: ScheduleDependency) => Promise<void>;
}) {
  const [parentItemId, setParentItemId] = useState("none");
  const [dependentItemId, setDependentItemId] = useState("none");
  const [dependencyType, setDependencyType] = useState("finish_to_start");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (parentItemId === "none" || dependentItemId === "none") return;
    setSaving(true);
    try {
      await onCreate({
        parent_item_id: parentItemId,
        dependent_item_id: dependentItemId,
        dependency_type: dependencyType,
        lag_days: 0,
        required_completion_date: requiredDate || null,
        delay_impact_notes: notes,
        notes,
        auto_shift_schedule: true,
      });
      setParentItemId("none");
      setDependentItemId("none");
      setNotes("");
      setRequiredDate("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dependencies</CardTitle>
          <CardDescription>Connect work that must happen before another task can start.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldSelect label="Must finish first" value={parentItemId} onChange={setParentItemId} items={items.map((item) => ({ value: item.id, label: item.title }))} placeholder="Select item" />
          <FieldSelect label="Dependent item" value={dependentItemId} onChange={setDependentItemId} items={items.filter((item) => item.id !== parentItemId).map((item) => ({ value: item.id, label: item.title }))} placeholder="Select item" />
          <FieldSelect label="Dependency type" value={dependencyType} onChange={setDependencyType} items={["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"].map((item) => ({ value: item, label: human(item) }))} />
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Lag days</div>
            <Input value="0" readOnly />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Required completion date</div>
            <Input type="date" value={requiredDate} onChange={(event) => setRequiredDate(event.target.value)} />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Delay impact notes</div>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Proof approval must be complete before print production can start." />
          </div>
          <Button className="w-full" onClick={save} disabled={saving || parentItemId === "none" || dependentItemId === "none" || parentItemId === dependentItemId}>
            <Link2 className="h-4 w-4" /> {saving ? "Saving..." : "Add dependency"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active links</CardTitle>
          <CardDescription>{dependencies.length} dependency relationships</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {dependencies.map((dependency) => {
            const parent = items.find((item) => item.id === dependency.parent_item_id);
            const dependent = items.find((item) => item.id === dependency.dependent_item_id);
            return (
              <div key={dependency.id} className="rounded-lg border bg-secondary/20 p-3">
                <div className="text-sm font-medium">{parent?.title || dependency.parent?.title || "Parent item"}</div>
                <div className="my-1 text-[11px] uppercase tracking-wide text-muted-foreground">{human(dependency.dependency_type)} {dependency.lag_days ? `+ ${dependency.lag_days}d` : ""}</div>
                <div className="text-sm text-muted-foreground">{dependent?.title || dependency.dependent?.title || "Dependent item"}</div>
                {(dependency.notes || dependency.delay_impact_notes) && <div className="mt-2 text-xs text-muted-foreground">{dependency.notes || dependency.delay_impact_notes}</div>}
                <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-red-600 dark:text-red-300" onClick={() => onDelete(dependency)}>Remove</Button>
              </div>
            );
          })}
          {!dependencies.length && <EmptyState title="No dependencies yet" description="Add a dependency to show handoffs and blockers across proofing, production, QC, shipping, and install." />}
        </CardContent>
      </Card>
    </div>
  );
}

function DependencyInspector({
  dependency,
  items,
  onOpenChange,
  onSave,
  onDelete,
}: {
  dependency: ScheduleDependency | null;
  items: ScheduleItem[];
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    id: string;
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days: number;
    required_completion_date: string | null;
    notes: string;
    auto_shift_schedule: boolean;
  }) => Promise<void>;
  onDelete: (dependency: ScheduleDependency) => Promise<void>;
}) {
  const [dependencyType, setDependencyType] = useState("finish_to_start");
  const [lagDays, setLagDays] = useState("0");
  const [requiredDate, setRequiredDate] = useState("");
  const [autoShift, setAutoShift] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!dependency) return;
    setDependencyType(dependency.dependency_type || "finish_to_start");
    setLagDays(String(dependency.lag_days ?? 0));
    setRequiredDate(dateInput(dependency.required_completion_date));
    setAutoShift(dependency.auto_shift_schedule !== false);
    setNotes(dependency.notes || dependency.delay_impact_notes || "");
    setMessage("");
  }, [dependency]);

  if (!dependency) return null;

  const source = items.find((item) => item.id === dependency.parent_item_id);
  const target = items.find((item) => item.id === dependency.dependent_item_id);

  async function save() {
    const current = dependency;
    if (!current) return;
    setSaving(true);
    setMessage("Saving dependency...");
    try {
      await onSave({
        id: current.id,
        parent_item_id: current.parent_item_id,
        dependent_item_id: current.dependent_item_id,
        dependency_type: dependencyType,
        lag_days: Number(lagDays || 0),
        required_completion_date: requiredDate || null,
        notes,
        auto_shift_schedule: autoShift,
      });
      setMessage("Dependency updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update dependency.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(dependency)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>Dependency inspector</SheetTitle>
          <SheetDescription>Dependencies are editable records that connect a source schedule item to a target schedule item.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <LinkedMeta label="Source item" value={source?.title || dependency.parent?.title || "Source item"} subvalue={source ? `${itemTypeLabel(source)} - ${human(source.status)}` : undefined} />
            <LinkedMeta label="Target item" value={target?.title || dependency.dependent?.title || "Target item"} subvalue={target ? `${itemTypeLabel(target)} - ${human(target.status)}` : undefined} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Dependency type" value={dependencyType} onChange={setDependencyType} items={["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"].map((item) => ({ value: item, label: human(item) }))} />
            <TextField label="Lag days" value={lagDays} onChange={setLagDays} inputMode="numeric" />
            <DateField label="Required completion" value={requiredDate} onChange={setRequiredDate} />
          </div>

          <ToggleRow label="Auto-shift schedule" description="Future schedule automation can move dependent target items when the source item moves." checked={autoShift} onChange={setAutoShift} />

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Notes</div>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Dependency notes, delay impact, production risk, or handoff details." />
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save dependency"}</Button>
            <Button variant="outline" className="text-red-600 dark:text-red-300" onClick={() => onDelete(dependency)}><Trash2 className="h-4 w-4" /> Delete dependency</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function actionTitle(kind: GanttFabActionKind) {
  const labels: Record<GanttFabActionKind, string> = {
    note: "Add production note",
    user: "Add user / assignee",
    contact: "Add customer contact",
    photo: "Add photo",
    video: "Add video",
    file: "Add file or proof",
    product: "Add product",
    selection: "Add product selection",
    material: "Add material",
    vendor: "Add vendor",
    role: "Add role type",
  };
  return labels[kind];
}

function appendTaskNote(item: ScheduleItem, label: string, note: string) {
  const line = `${new Date().toLocaleString()}: ${label}${note ? ` - ${note}` : ""}`;
  return [item.internal_notes || "", line].filter(Boolean).join("\n\n");
}

function GanttFabActionSheet({
  action,
  data,
  staff,
  onOpenChange,
  onSave,
  onUpload,
}: {
  action: GanttFabActionState;
  data: AdminDashboardData | null;
  staff: AdminUser[];
  onOpenChange: (open: boolean) => void;
  onSave: (item: ScheduleItem, updates: Partial<SchedulePayload>, messageText: string, relation?: ScheduleRelationPayload) => Promise<void>;
  onUpload: (item: ScheduleItem, input: { file: File; mode: "artwork" | "proof"; status: string; admin_comments: string; customer_comments: string }) => Promise<void>;
}) {
  const item = action?.item || null;
  const kind = action?.kind || "note";
  const users = data?.users ?? [];
  const products = data?.products ?? [];
  const [assigneeId, setAssigneeId] = useState("none");
  const [customerId, setCustomerId] = useState("none");
  const [productId, setProductId] = useState("none");
  const [department, setDepartment] = useState("");
  const [roleType, setRoleType] = useState("");
  const [note, setNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [uploadMode, setUploadMode] = useState<"artwork" | "proof">("artwork");
  const [uploadStatus, setUploadStatus] = useState("waiting_for_file_review");
  const [mediaSource, setMediaSource] = useState<"upload" | "camera-front" | "camera-rear">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!action?.item) return;
    setAssigneeId(action.item.assigned_to_user_id || "none");
    setCustomerId(action.item.customer_id || "none");
    setProductId(action.item.product_id || "none");
    setDepartment(action.item.assigned_department || "");
    setRoleType(action.item.assigned_department || "");
    setNote("");
    setCustomerNote("");
    setUploadMode(kind === "file" ? "proof" : "artwork");
    setUploadStatus(kind === "file" ? "proof_sent" : "waiting_for_file_review");
    setMediaSource("upload");
    setFile(null);
    setMessage("");
  }, [action, kind]);

  async function save() {
    if (!item) return;
    setSaving(true);
    setMessage("Saving action...");
    try {
      if (kind === "photo" || kind === "video" || kind === "file") {
        if (!file) throw new Error("Choose a file before saving this action.");
        await onUpload(item, {
          file,
          mode: uploadMode,
          status: uploadStatus,
          admin_comments: note,
          customer_comments: customerNote,
        });
        return;
      }

      if (kind === "user") {
        const user = staff.find((row) => row.id === assigneeId);
        await onSave(item, {
          assigned_to_user_id: assigneeId === "none" ? null : assigneeId,
          assigned_department: department,
        }, `Updated assignment for "${item.title}".`, {
          relation_type: "participant",
          participant_type: "staff",
          user_id: assigneeId === "none" ? null : assigneeId,
          display_name: user?.full_name || user?.email || null,
          email: user?.email || null,
          role_type: department || user?.role || null,
          permission_level: "editor",
          notes: note,
        });
        return;
      }

      if (kind === "contact") {
        const user = users.find((row) => row.id === customerId);
        await onSave(item, {
          customer_id: customerId === "none" ? null : customerId,
          customer_notes: [item.customer_notes || "", customerNote].filter(Boolean).join("\n\n"),
        }, `Updated customer contact for "${item.title}".`, {
          relation_type: "participant",
          participant_type: user?.role === "customer" ? "customer" : "contact",
          user_id: customerId === "none" ? null : customerId,
          display_name: user?.full_name || user?.email || null,
          email: user?.email || null,
          phone: user?.phone || null,
          company: user?.company || null,
          permission_level: "customer",
          visibility: "customer",
          notes: [note, customerNote].filter(Boolean).join("\n\n"),
        });
        return;
      }

      if (kind === "product" || kind === "selection" || kind === "material") {
        const product = products.find((row) => row.id === productId);
        await onSave(item, {
          product_id: productId === "none" ? null : productId,
        }, `Updated ${kind === "material" ? "material" : "product"} context for "${item.title}".`, {
          relation_type: "material",
          material_relation_type: kind,
          product_id: productId === "none" ? null : productId,
          name: product?.name || (kind === "material" ? "Manual material" : "Product selection"),
          sku: product?.sku || null,
          category: product?.category || null,
          vendor_name: product?.vendor || null,
          quantity: 1,
          notes: note,
        });
        return;
      }

      if (kind === "vendor" || kind === "role") {
        const relation: ScheduleRelationPayload = kind === "vendor" ? {
          relation_type: "vendor",
          vendor_name: roleType || "Vendor",
          role_type: department || null,
          service_scope: note,
          notes: note,
        } : {
          relation_type: "participant",
          participant_type: "role",
          display_name: roleType || department || "Project role",
          role_type: roleType || department || null,
          permission_level: "viewer",
          notes: note,
        };
        await onSave(item, {
          assigned_department: roleType || department,
        }, `Updated ${kind} context for "${item.title}".`, relation);
        return;
      }

      await onSave(item, {}, `Added note to "${item.title}".`, {
        relation_type: "event",
        event_type: "note.added",
        event_title: "Production note",
        event_description: note,
        visibility: "internal",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this FAB action.");
    } finally {
      setSaving(false);
    }
  }

  const mediaCapture = mediaSource === "camera-front" ? "user" : mediaSource === "camera-rear" ? "environment" : undefined;
  const fileAccept = kind === "photo" ? "image/*" : kind === "video" ? "video/*" : "image/*,video/*,.pdf,.ai,.eps,.svg";
  const fileInputLabel = kind === "photo"
    ? mediaSource === "upload" ? "Upload photo" : mediaSource === "camera-front" ? "Take photo with front camera" : "Take photo with rear camera"
    : kind === "video"
      ? mediaSource === "upload" ? "Upload video" : mediaSource === "camera-front" ? "Record video with front camera" : "Record video with rear camera"
      : "Upload file";

  return (
    <Sheet open={Boolean(action)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[38rem]">
        <SheetHeader>
          <SheetTitle>{actionTitle(kind)}</SheetTitle>
          <SheetDescription>{item ? `Quick action for ${item.title}.` : "Select a Gantt item to use quick actions."}</SheetDescription>
        </SheetHeader>

        {item && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border bg-secondary/25 p-3 text-sm">
              <div className="font-medium">{item.project_name || "Unlinked project"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{itemTypeLabel(item)} - {item.phase || "No phase"} - {human(item.status)}</div>
            </div>

            {kind === "user" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect label="Assigned user" value={assigneeId} onChange={setAssigneeId} items={staff.map((user) => ({ value: user.id, label: `${user.full_name || user.email || "User"} - ${human(user.role)}` }))} placeholder="Unassigned" />
                <FieldSelect label="Department / role" value={department || "none"} onChange={(value) => setDepartment(value === "none" ? "" : value)} items={departments.map((value) => ({ value, label: value }))} placeholder="No department" />
              </div>
            )}

            {kind === "contact" && (
              <div className="space-y-3">
                <FieldSelect label="Customer / contact" value={customerId} onChange={setCustomerId} items={users.map((user) => ({ value: user.id, label: `${user.full_name || user.email || "User"} - ${human(user.role)}` }))} placeholder="No contact" />
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer-facing note</div>
                  <Textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Optional note safe for customer-facing context." />
                </div>
              </div>
            )}

            {(kind === "product" || kind === "selection" || kind === "material") && (
              <FieldSelect label={kind === "material" ? "Material / product" : "Product"} value={productId} onChange={setProductId} items={products.map((product) => ({ value: product.id, label: `${product.name} - ${product.category}` }))} placeholder="No product" />
            )}

            {(kind === "vendor" || kind === "role") && (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label={kind === "vendor" ? "Vendor name" : "Role type"} value={roleType} onChange={setRoleType} placeholder={kind === "vendor" ? "Vendor, subcontractor, supplier..." : "Installer, designer, approver..."} />
                <FieldSelect label="Operational department" value={department || "none"} onChange={(value) => setDepartment(value === "none" ? "" : value)} items={departments.map((value) => ({ value, label: value }))} placeholder="No department" />
              </div>
            )}

            {(kind === "photo" || kind === "video" || kind === "file") && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-background/40 p-3 text-xs text-muted-foreground">
                  Uploads use the existing artwork/proof workflow and require the task to be linked to an order and order item.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldSelect label="Upload type" value={uploadMode} onChange={(value) => {
                    const mode = value as "artwork" | "proof";
                    setUploadMode(mode);
                    setUploadStatus(mode === "proof" ? "proof_sent" : "waiting_for_file_review");
                  }} items={[{ value: "artwork", label: "Artwork / file" }, { value: "proof", label: "Proof" }]} />
                  <FieldSelect label="Status" value={uploadStatus} onChange={setUploadStatus} items={["waiting_for_file_review", "needs_changes", "proof_sent", "approved", "rejected", "in_production"].map((value) => ({ value, label: human(value) }))} />
                </div>
                {(kind === "photo" || kind === "video") && (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">Source</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "upload", label: kind === "photo" ? "Upload photo" : "Upload video" },
                        { value: "camera-front", label: "Front camera" },
                        { value: "camera-rear", label: "Rear camera" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={mediaSource === option.value ? "default" : "outline"}
                          className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs leading-tight"
                          onClick={() => {
                            setMediaSource(option.value as "upload" | "camera-front" | "camera-rear");
                            setFile(null);
                          }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">{fileInputLabel}</div>
                  <Input
                    key={`${kind}-${mediaSource}`}
                    type="file"
                    accept={fileAccept}
                    capture={kind === "photo" || kind === "video" ? mediaCapture : undefined}
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                  {file && <div className="mt-2 text-xs text-muted-foreground">{file.name}</div>}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{kind === "note" ? "Production note" : "Internal note"}</div>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context, instructions, vendor details, product/material notes, or upload notes." />
            </div>

            {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save action"}</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ScheduleItemSheet({
  open,
  onOpenChange,
  item,
  data,
  staff,
  initialPayload,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ScheduleItem | null;
  data: AdminDashboardData | null;
  staff: AdminUser[];
  initialPayload?: SchedulePayload | null;
  onSave: (input: SchedulePayload) => Promise<void>;
  onDelete?: () => void;
}) {
  const orders = data?.orders ?? [];
  const users = data?.users ?? [];
  const products = data?.products ?? [];
  const orderItems = data?.orderItems ?? [];
  const productionJobs = data?.productionJobs ?? [];
  const [form, setForm] = useState<SchedulePayload>(() => emptyPayload());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(item ? payloadFromItem(item) : initialPayload || emptyPayload());
    setMessage("");
  }, [initialPayload, item, open]);

  const selectedOrder = orders.find((order) => order.id === form.order_id);
  const selectedItems = orderItems.filter((row) => row.order_id === form.order_id);
  const selectedProduct = products.find((product) => product.id === form.product_id);

  useEffect(() => {
    if (!open || item) return;
    if (selectedOrder?.user_id && !form.customer_id) update("customer_id", selectedOrder.user_id);
  }, [form.customer_id, item, open, selectedOrder?.user_id]);

  function update<Key extends keyof SchedulePayload>(key: Key, value: SchedulePayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateOrder(orderId: string) {
    const order = orders.find((row) => row.id === orderId);
    update("order_id", orderId === "none" ? null : orderId);
    setForm((current) => ({
      ...current,
      order_id: orderId === "none" ? null : orderId,
      order_item_id: null,
      customer_id: order?.user_id || current.customer_id,
      due_date: current.due_date || dateInput(order?.due_at),
    }));
  }

  function updateOrderItem(orderItemId: string) {
    const orderItem = orderItems.find((row) => row.id === orderItemId);
    setForm((current) => ({
      ...current,
      order_item_id: orderItemId === "none" ? null : orderItemId,
      product_id: orderItem?.products?.id || current.product_id,
    }));
  }

  async function save() {
    if (!form.title.trim()) {
      setMessage("Add a title before saving this schedule item.");
      return;
    }
    setSaving(true);
    setMessage(item ? "Updating schedule item..." : "Creating schedule item...");
    try {
      await onSave(form);
      setMessage(item ? "Schedule item updated." : "Schedule item created.");
      if (!item) onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save schedule item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>{item ? "Edit schedule item" : "Add schedule item"}</SheetTitle>
          <SheetDescription>Connect the schedule to a customer, order, product, production job, owner, dates, blockers, and customer visibility.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Title" value={form.title} onChange={(value) => update("title", value)} placeholder="Proof approval for vinyl banner" />
            <FieldSelect label="Type" value={form.item_type} onChange={(value) => update("item_type", value)} items={itemTypes.map((value) => ({ value, label: human(value) }))} />
          </div>

          <TextField label="Project name" value={form.project_name || ""} onChange={(value) => update("project_name", value)} placeholder="Controlp.io Business Card Order" />

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect label="Order" value={form.order_id || "none"} onChange={updateOrder} items={orders.map((order) => ({ value: order.id, label: `#${order.order_number || order.id.slice(0, 8)} - ${order.users?.full_name || order.company || order.customer_email || "Customer"}` }))} placeholder="No order" />
            <FieldSelect label="Order item" value={form.order_item_id || "none"} onChange={updateOrderItem} items={selectedItems.map((line) => ({ value: line.id, label: `${line.products?.name || "Product"} - Qty ${line.quantity || 1}` }))} placeholder="No line item" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect label="Customer / user" value={form.customer_id || "none"} onChange={(value) => update("customer_id", value === "none" ? null : value)} items={users.map((user) => ({ value: user.id, label: `${user.full_name || user.email || "User"} - ${human(user.role)}` }))} placeholder="No customer" />
            <FieldSelect label="Product" value={form.product_id || "none"} onChange={(value) => update("product_id", value === "none" ? null : value)} items={products.map((product) => ({ value: product.id, label: `${product.name} - ${product.category}` }))} placeholder="No product" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Status" value={form.status} onChange={(value) => update("status", value)} items={statuses.map((value) => ({ value, label: human(value) }))} />
            <FieldSelect label="Priority" value={form.priority} onChange={(value) => update("priority", value)} items={priorities.map((value) => ({ value, label: human(value) }))} />
            <FieldSelect label="Phase" value={form.phase || "none"} onChange={(value) => update("phase", value === "none" ? "" : value)} items={phases.map((value) => ({ value, label: value }))} placeholder="No phase" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Assigned to" value={form.assigned_to_user_id || "none"} onChange={(value) => update("assigned_to_user_id", value === "none" ? null : value)} items={staff.map((user) => ({ value: user.id, label: `${user.full_name || user.email || "User"} - ${human(user.role)}` }))} placeholder="Unassigned" />
            <FieldSelect label="Department" value={form.assigned_department || "none"} onChange={(value) => update("assigned_department", value === "none" ? "" : value)} items={departments.map((value) => ({ value, label: value }))} placeholder="No department" />
            <FieldSelect label="Production job" value={form.production_job_id || "none"} onChange={(value) => update("production_job_id", value === "none" ? null : value)} items={productionJobs.map((job) => ({ value: job.id, label: `${job.station || "Job"} - ${human(job.status)}` }))} placeholder="No production job" />
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            <DateField label="Start date" value={form.start_date || ""} onChange={(value) => update("start_date", value || null)} />
            <TimeField label="Start time" value={form.start_offset_minutes} onChange={(value) => update("start_offset_minutes", value)} />
            <DateField label="End date" value={form.end_date || ""} onChange={(value) => update("end_date", value || null)} />
            <DateField label="Due date" value={form.due_date || ""} onChange={(value) => update("due_date", value || null)} />
            <TextField label="Progress %" value={String(form.progress_percent)} onChange={(value) => update("progress_percent", Number(value || 0))} inputMode="numeric" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Estimated duration days"
              value={String(form.estimated_duration_days ?? "")}
              onChange={(value) => update("estimated_duration_days", value === "" ? null : Number(value))}
              placeholder="0.125 for 1 hour, 0.5 for half day"
              inputMode="decimal"
            />
            <LinkedMeta label="Duration examples" value="0.125 = 1 hour, 0.25 = 2 hours, 0.5 = half day" subvalue="Timeline bars remain day-positioned in this pass; duration data can now be fractional." />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Customer visible" description="Show this item later in customer-facing schedule views." checked={form.customer_visible} onChange={(checked) => {
              update("customer_visible", checked);
              update("internal_only", !checked);
            }} />
            <ToggleRow label="Blocked" description="Flag work that is blocked by customer action, proofing, material, vendor, payment, or production issues." checked={form.is_blocked} onChange={(checked) => {
              update("is_blocked", checked);
              if (checked && form.status !== "blocked") update("status", "blocked");
            }} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Blocker type" value={form.blocker_type} onChange={(value) => update("blocker_type", value)} placeholder="Missing artwork, proof not approved, material delay..." />
            <TextField label="Blocker reason" value={form.blocker_reason} onChange={(value) => update("blocker_reason", value)} placeholder="What is stopping this from moving forward?" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Artwork status" value={form.artwork_review_status} onChange={(value) => update("artwork_review_status", value)} placeholder="file_check, approved, revisions..." />
            <TextField label="Proof status" value={form.proof_status} onChange={(value) => update("proof_status", value)} placeholder="sent, viewed, approved..." />
            <TextField label="Production status" value={form.production_status} onChange={(value) => update("production_status", value)} placeholder="print_ready, finishing..." />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Description</div>
            <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What needs to happen for this schedule item?" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Internal notes</div>
              <Textarea value={form.internal_notes} onChange={(event) => update("internal_notes", event.target.value)} placeholder="Internal production notes, assignment context, blocker details..." />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer notes</div>
              <Textarea value={form.customer_notes} onChange={(event) => update("customer_notes", event.target.value)} placeholder="Safe-to-share customer-facing schedule note." />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LinkedMeta label="Order" value={selectedOrder?.order_number ? `#${selectedOrder.order_number}` : "Not linked"} subvalue={selectedOrder?.customer_email || selectedOrder?.customer_phone || undefined} />
            <LinkedMeta label="Product" value={selectedProduct?.name || "Not linked"} subvalue={selectedProduct?.category || undefined} />
            <LinkedMeta label="Visibility" value={form.customer_visible ? "Customer visible" : "Internal only"} subvalue={form.is_blocked ? "Blocked item" : "Open schedule item"} />
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : item ? "Save schedule item" : "Create schedule item"}</Button>
            {onDelete && <Button variant="outline" className="text-red-600 dark:text-red-300" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function emptyPayload(): SchedulePayload {
  return {
    order_id: null,
    order_item_id: null,
    production_job_id: null,
    product_id: null,
    customer_id: null,
    schedule_group_id: null,
    project_name: "",
    workflow_template_slug: null,
    workflow_template_name: null,
    hidden_from_schedule: false,
    parent_item_id: null,
    title: "",
    description: "",
    item_type: "task",
    phase: "Artwork / Design",
    status: "not_started",
    priority: "normal",
    assigned_to_user_id: null,
    assigned_department: "Design",
    start_date: dateOnly(new Date()),
    start_offset_minutes: 0,
    end_date: dateOnly(addDays(new Date(), 2)),
    due_date: dateOnly(addDays(new Date(), 2)),
    estimated_duration_days: 2,
    progress_percent: 0,
    customer_visible: false,
    internal_only: true,
    is_blocked: false,
    blocker_type: "",
    blocker_reason: "",
    artwork_review_status: "",
    proof_status: "",
    production_status: "",
    sort_order: 100,
    internal_notes: "",
    customer_notes: "",
  };
}

function payloadFromItem(item?: ScheduleItem | null): SchedulePayload {
  if (!item) return emptyPayload();
  return {
    id: item.id,
    order_id: item.order_id,
    order_item_id: item.order_item_id,
    production_job_id: item.production_job_id,
    product_id: item.product_id,
    customer_id: item.customer_id,
    schedule_group_id: item.schedule_group_id,
    project_name: item.project_name || "",
    workflow_template_slug: item.workflow_template_slug,
    workflow_template_name: item.workflow_template_name,
    hidden_from_schedule: Boolean(item.hidden_from_schedule),
    parent_item_id: item.parent_item_id,
    title: item.title,
    description: item.description || "",
    item_type: item.item_type,
    phase: item.phase || "",
    status: item.status,
    priority: item.priority,
    assigned_to_user_id: item.assigned_to_user_id,
    assigned_department: item.assigned_department || "",
    start_date: dateInput(item.start_date) || null,
    start_offset_minutes: clampOffsetMinutes(Number(item.start_offset_minutes || 0)),
    end_date: dateInput(item.end_date) || null,
    due_date: dateInput(item.due_date) || null,
    estimated_duration_days: Number(item.estimated_duration_days || 0),
    progress_percent: Number(item.progress_percent || 0),
    customer_visible: item.customer_visible,
    internal_only: item.internal_only,
    is_blocked: item.is_blocked,
    blocker_type: item.blocker_type || "",
    blocker_reason: item.blocker_reason || "",
    artwork_review_status: item.artwork_review_status || "",
    proof_status: item.proof_status || "",
    production_status: item.production_status || "",
    sort_order: Number(item.sort_order || 100),
    internal_notes: item.internal_notes || "",
    customer_notes: item.customer_notes || "",
  };
}

function FieldSelect({
  label,
  value,
  onChange,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {placeholder && <SelectItem value="none">{placeholder}</SelectItem>}
          {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "numeric" | "decimal" | "text" }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} />
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <Input
        type="time"
        step={900}
        value={offsetToInput(value)}
        onChange={(event) => onChange(inputToOffset(event.target.value))}
      />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(visibleMonth);
  const firstDay = visibleMonth.getDay();
  const gridStart = addDays(visibleMonth, -firstDay);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const today = dateOnly(new Date());

  function choose(day: Date) {
    onChange(dateOnly(day));
    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm ring-offset-background transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value ? new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(selected) : "Select date"}</span>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-[4.4rem] z-[70] w-[320px] rounded-lg border bg-card p-3 text-card-foreground shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold">{monthLabel}</div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <div key={day} className="py-1">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = dateOnly(day);
              const selectedDay = value === key;
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  className={cn(
                    "grid h-9 place-items-center rounded-md text-sm transition-colors hover:bg-primary hover:text-primary-foreground",
                    !inMonth && "text-muted-foreground/55",
                    key === today && "border border-primary/50",
                    selectedDay && "bg-primary font-semibold text-primary-foreground shadow-sm",
                  )}
                  onClick={() => choose(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <Button variant="ghost" size="sm" onClick={() => { onChange(""); setOpen(false); }}>Clear</Button>
            <Button variant="outline" size="sm" onClick={() => choose(new Date())}>Today</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-secondary/20 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function LinkedMeta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="rounded-lg border bg-secondary/25 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
      {subvalue && <div className="mt-1 break-words text-xs text-muted-foreground">{subvalue}</div>}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-center">
      <div className="font-medium">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</div>
    </div>
  );
}
