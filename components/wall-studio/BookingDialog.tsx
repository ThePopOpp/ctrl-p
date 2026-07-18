"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useWallStudio } from "@/lib/wall-studio/store";

const TIME_WINDOWS = ["8–11 AM", "11–2 PM", "2–5 PM"];
const PROJECT_TYPES = ["Wallpaper — residential", "Wall wrap — commercial", "Window film / frost", "Mural / custom print"];

function minDateStr() {
  return new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export function BookingDialog() {
  const { bookingOpen, setBookingOpen } = useWallStudio();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(minDateStr());
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState<string | null>(null);

  const control = "w-full rounded-md border bg-background px-2.5 py-2 text-sm";

  async function submit() {
    setError("");
    if (!name.trim() || !phone.trim() || !address.trim() || !slot) {
      setError("Please fill name, phone, address, and pick a time window.");
      return;
    }
    setBusy(true);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      try {
        const db = getSupabaseBrowserClient();
        const token = db ? (await db.auth.getSession()).data.session?.access_token : null;
        if (token) headers["authorization"] = `Bearer ${token}`;
      } catch {
        /* guest booking */
      }
      const res = await fetch("/api/wall-studio/bookings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          phone,
          email,
          address,
          project_type: projectType,
          notes,
          preferred_date: date,
          time_window: slot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not create booking.");
        return;
      }
      setRef(data.ref);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setBookingOpen(false);
    // reset confirmation on close so re-open is fresh
    setTimeout(() => setRef(null), 200);
  }

  return (
    <Dialog open={bookingOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book installation</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Chandler &amp; Greater Phoenix · free on-site measure with every install
        </p>

        {ref ? (
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm">
            <strong>Install request {ref} received.</strong>
            <br />
            {projectType} · {date}, {slot}
            <br />
            We&apos;ll text {phone} to confirm and schedule your free on-site measure.
            <div className="mt-4">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Full name</label>
                <input className={control} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label>
                <input className={control} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(480) 555-0148" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email (for confirmation)</label>
                <input type="email" className={control} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Install address</label>
                <input className={control} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 W Main St, Chandler, AZ" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Project type</label>
                <select className={control} value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (wall sizes, surfaces, access)</label>
                <textarea className={cn(control, "min-h-20 resize-y")} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Preferred date</label>
                <input type="date" min={minDateStr()} className={control} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Time window</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_WINDOWS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-[13px]",
                        slot === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="w-full" onClick={submit} disabled={busy}>
                {busy ? "Requesting…" : "Request install slot"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
