"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FormLabel, SelectField, fmtDate } from "@/components/admin/pipeline/pipeline-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pipelineRequest } from "@/lib/pipeline/client";
import { NEXT_ACTION_TYPES, SERVICE_CATEGORIES } from "@/lib/pipeline/stages";
import type { CustomerRecord, Opportunity, PipelineAccess, SourceSubmission, StaffMember } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

type Mode = "inquiry" | "customer" | "contact";
type Sources = { submissions: (SourceSubmission & { opportunity_id: string | null })[]; customers: CustomerRecord[] };

const inDays = (days: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function OpportunityCreateDialog({
  open,
  onClose,
  staff,
  access,
  initialSubmissionId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  staff: StaffMember[];
  access: PipelineAccess;
  initialSubmissionId?: string | null;
  onCreated: (opportunity: Opportunity, existing: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("inquiry");
  const [sources, setSources] = useState<Sources | null>(null);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    service_category: "",
    description: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    company: "",
    source: "",
    owner_id: access.actorId,
    expected_close_date: inDays(30),
    requested_completion_date: "",
    estimated_value: "",
    next_action: "",
    next_action_type: "call",
    next_action_due: inDays(1),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMode(initialSubmissionId ? "inquiry" : "inquiry");
    setSubmissionId(initialSubmissionId ?? "");
    let alive = true;
    pipelineRequest<Sources>("/sources")
      .then((result) => alive && setSources(result))
      .catch((loadError) => alive && setSourcesError(errorMessage(loadError, "Could not load inquiries and customers.")));
    return () => {
      alive = false;
    };
  }, [open, initialSubmissionId]);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submission = sources?.submissions.find((item) => item.id === submissionId) ?? null;
  const customers = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    return (sources?.customers ?? []).filter((customer) => !needle || [customer.full_name, customer.email, customer.company].some((value) => String(value || "").toLowerCase().includes(needle))).slice(0, 100);
  }, [sources, customerQuery]);

  const ownerLocked = !access.canViewAll;
  const sourceReady = mode === "inquiry" ? Boolean(submissionId) : mode === "customer" ? Boolean(customerId) : Boolean(form.contact_name.trim() && (form.contact_email.trim() || form.contact_phone.trim()));
  const canSubmit = sourceReady && Boolean(form.owner_id) && !saving && !submission?.opportunity_id;

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        owner_id: form.owner_id,
        service_category: form.service_category || null,
        expected_close_date: form.expected_close_date || null,
        requested_completion_date: form.requested_completion_date || null,
        estimated_value: form.estimated_value || 0,
        next_action: form.next_action || null,
        next_action_type: form.next_action ? form.next_action_type : null,
        next_action_due: form.next_action ? form.next_action_due || null : null,
      };
      if (form.name.trim()) body.name = form.name;
      if (form.description.trim()) body.description = form.description;
      if (form.source.trim()) body.source = form.source;
      if (mode === "inquiry") body.source_submission_id = submissionId;
      if (mode === "customer") {
        body.customer_user_id = customerId;
        if (!form.source.trim()) body.source = "Existing customer";
      }
      if (mode === "contact") {
        body.contact_name = form.contact_name;
        body.contact_email = form.contact_email || null;
        body.contact_phone = form.contact_phone || null;
        body.company = form.company || null;
      }
      const result = await pipelineRequest<{ opportunity: Opportunity; existing: boolean }>("/opportunities", { method: "POST", body });
      onCreated(result.opportunity, result.existing);
    } catch (createError) {
      setError(errorMessage(createError, "The opportunity was not created."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New opportunity</DialogTitle>
          <DialogDescription>One opportunity per potential job. Leads are added on purpose; existing contacts and customers are linked, not copied.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div role="tablist" aria-label="Create from" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {([
              ["inquiry", "Website inquiry"],
              ["customer", "Existing customer"],
              ["contact", "New contact"],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)}
                className={cn("rounded-md px-2 py-1.5 text-xs font-medium", mode === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>

          {sourcesError && <p className="text-sm text-red-600 dark:text-red-300">{sourcesError}</p>}

          {mode === "inquiry" && (
            <div className="space-y-2">
              <FormLabel label="Inquiry">
                <SelectField value={submissionId} onChange={(event) => setSubmissionId(event.target.value)} disabled={!sources}>
                  <option value="">{sources ? "Choose a contact form submission" : "Loading…"}</option>
                  {sources?.submissions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[item.first_name, item.last_name].filter(Boolean).join(" ")}{item.company ? ` · ${item.company}` : ""} · {fmtDate(item.created_at, false)}{item.opportunity_id ? " (in Pipeline)" : ""}
                    </option>
                  ))}
                </SelectField>
              </FormLabel>
              {submission && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">{submission.subject || "No subject"}</div>
                  <div className="text-xs text-muted-foreground">{submission.email}{submission.phone ? ` · ${submission.phone}` : ""}</div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-muted-foreground">{submission.message}</p>
                  {submission.opportunity_id && (
                    <p className="mt-2 text-sm">
                      Already in the Pipeline. <Link className="font-medium underline" href={`/admin/pipeline/${submission.opportunity_id}`}>Open the opportunity</Link>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "customer" && (
            <div className="space-y-2">
              <Input placeholder="Search customers by name, email, or company" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} />
              <SelectField value={customerId} onChange={(event) => setCustomerId(event.target.value)} size={6} className="h-auto" aria-label="Customer">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.full_name || customer.email}{customer.company ? ` · ${customer.company}` : ""}</option>
                ))}
              </SelectField>
              <p className="text-[11px] text-muted-foreground">Existing customers keep their customer status; a reorder or new quote is simply another opportunity.</p>
            </div>
          )}

          {mode === "contact" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormLabel label="Contact name (required)"><Input value={form.contact_name} onChange={(event) => set("contact_name", event.target.value)} /></FormLabel>
              <FormLabel label="Company"><Input value={form.company} onChange={(event) => set("company", event.target.value)} /></FormLabel>
              <FormLabel label="Email"><Input type="email" value={form.contact_email} onChange={(event) => set("contact_email", event.target.value)} /></FormLabel>
              <FormLabel label="Phone"><Input type="tel" value={form.contact_phone} onChange={(event) => set("contact_phone", event.target.value)} /></FormLabel>
              <p className="text-[11px] text-muted-foreground sm:col-span-2">An email or phone is required. A matching customer account is linked automatically by email.</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormLabel label="Project name" className="sm:col-span-2" hint="Leave blank to name it from the company and service.">
              <Input value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Fleet wrap — 3 vans" />
            </FormLabel>
            <FormLabel label="Service type">
              <SelectField value={form.service_category} onChange={(event) => set("service_category", event.target.value)}>
                <option value="">Not set</option>
                {SERVICE_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
              </SelectField>
            </FormLabel>
            <FormLabel label="Assigned salesperson (required)">
              <SelectField value={form.owner_id} onChange={(event) => set("owner_id", event.target.value)} disabled={ownerLocked}>
                <option value="">Choose a salesperson</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
              </SelectField>
            </FormLabel>
            <FormLabel label="Request source"><Input value={form.source} onChange={(event) => set("source", event.target.value)} placeholder={mode === "inquiry" ? "Website contact form" : "Referral, walk-in, phone…"} /></FormLabel>
            <FormLabel label="Estimated value (USD)"><Input type="number" min={0} value={form.estimated_value} onChange={(event) => set("estimated_value", event.target.value)} /></FormLabel>
            <FormLabel label="Expected close date" hint="When the sale is expected to close."><Input type="date" value={form.expected_close_date} onChange={(event) => set("expected_close_date", event.target.value)} /></FormLabel>
            <FormLabel label="Requested completion date" hint="When the customer needs the job done."><Input type="date" value={form.requested_completion_date} onChange={(event) => set("requested_completion_date", event.target.value)} /></FormLabel>
            <FormLabel label="Project summary" className="sm:col-span-2">
              <Textarea rows={2} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder={mode === "inquiry" ? "Defaults to the inquiry message" : "What, roughly how many, by when"} />
            </FormLabel>
            <FormLabel label="Next action"><Input value={form.next_action} onChange={(event) => set("next_action", event.target.value)} placeholder="Call to confirm sizes" /></FormLabel>
            <div className="grid grid-cols-2 gap-2">
              <FormLabel label="Type">
                <SelectField value={form.next_action_type} onChange={(event) => set("next_action_type", event.target.value)}>
                  {NEXT_ACTION_TYPES.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                </SelectField>
              </FormLabel>
              <FormLabel label="Due"><Input type="date" value={form.next_action_due} onChange={(event) => set("next_action_due", event.target.value)} /></FormLabel>
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={create} disabled={!canSubmit}>{saving ? "Creating…" : "Create opportunity"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
