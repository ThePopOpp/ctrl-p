"use client";

import { useRef, useState } from "react";
import { AlertCircle, CreditCard, ExternalLink, FileText, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import {
  CustomerShell,
  EmptyState,
  StatusBadge,
  amount,
  fmtDate,
  human,
  useCustomerSession,
} from "@/components/dashboard/customer-shell";

export function CustomerInvoices() {
  const { data, state, errorMessage, theme, setTheme, messages, setMessages, bookings, getToken, signOut } = useCustomerSession();
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  async function openNotifications() {
    setNotifOpen((o) => !o);
    const unread = messages.filter((m) => !m.read_at && m.direction === "outbound");
    if (!unread.length) return;
    setMessages((prev) => prev.map((m) => (!m.read_at && m.direction === "outbound" ? { ...m, read_at: new Date().toISOString() } : m)));
    const token = await getToken();
    if (!token) return;
    await fetch("/api/dashboard/customer/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: unread.map((m) => m.id) }),
    }).catch(() => null);
  }

  const payments = data?.payments ?? [];
  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");

  const failedPayments = payments.filter((p) => String(p.status ?? "") === "failed");
  const outstandingPayments = payments.filter((p) => !["paid", "refunded", "canceled", "failed"].includes(String(p.status ?? "")));
  const paidPayments = payments.filter((p) => ["paid", "refunded"].includes(String(p.status ?? "")));

  function displayAmount(p: typeof payments[number]) {
    const bal = Number(p.balance_due);
    const tot = Number(p.amount);
    if (!Number.isNaN(bal) && bal > 0 && bal !== tot) return amount(bal);
    return amount(tot);
  }

  function isPartiallyPaid(p: typeof payments[number]) {
    const bal = Number(p.balance_due);
    const tot = Number(p.amount);
    return !Number.isNaN(bal) && !Number.isNaN(tot) && bal > 0 && bal < tot;
  }

  return (
    <CustomerShell
      profile={data?.profile}
      unreadCount={unreadMessages.length}
      upcomingBookingsCount={upcomingBookings.length}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      onSignOut={signOut}
      activePage="Invoices"
      state={state}
      errorMessage={errorMessage}
      messages={messages}
      onOpenNotifications={openNotifications}
      notifOpen={notifOpen}
      notifRef={notifRef}
      onCloseNotif={() => setNotifOpen(false)}
    >
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-primary" />Invoices &amp; payments
                </CardTitle>
                <CardDescription>Outstanding invoices and payment history for your orders.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/customer">← Overview</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Failed payment banner */}
            {failedPayments.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="text-sm">
                  <div className="font-semibold text-red-600 dark:text-red-300">
                    Failed payment{failedPayments.length > 1 ? "s" : ""}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {failedPayments.map((p) => `${p.invoice_number || "Invoice"} — ${amount(p.amount)}`).join(" · ")}
                    {" · "}Please use the Pay now link or contact us to resolve.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {failedPayments.filter((p) => p.payment_link_url).map((p) => (
                      <Button key={p.id} size="sm" variant="destructive" className="h-7 text-xs" asChild>
                        <a href={p.payment_link_url!} target="_blank" rel="noreferrer">
                          Pay now <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Outstanding invoices */}
            {outstandingPayments.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Outstanding ({outstandingPayments.length})
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {outstandingPayments.map((payment) => (
                    <div key={payment.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{payment.invoice_number || "Invoice"}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {human(payment.method || payment.provider)} · {payment.currency?.toUpperCase() ?? "USD"}
                          </div>
                          {isPartiallyPaid(payment) && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Total: {amount(payment.amount)} · Remaining: <span className="font-semibold text-foreground">{amount(payment.balance_due)}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-semibold">{displayAmount(payment)}</div>
                          <StatusBadge value={payment.status} />
                        </div>
                      </div>
                      {payment.invoice_due_at && (
                        <div className="text-xs text-muted-foreground">Due {fmtDate(payment.invoice_due_at)}</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {payment.payment_link_url && (
                          <Button size="sm" className="h-8 flex-1 text-xs" asChild>
                            <a href={payment.payment_link_url} target="_blank" rel="noreferrer">
                              Pay now <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                          <a href={`/api/payments/${payment.id}/document`} target="_blank" rel="noreferrer">
                            <FileText className="h-3.5 w-3.5" /> View invoice
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment history */}
            {paidPayments.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</div>
                <div className="space-y-2">
                  {paidPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{payment.invoice_number || "Payment"}</div>
                        <div className="text-xs text-muted-foreground">
                          {human(payment.method || payment.provider)} · {fmtDate(payment.received_at || payment.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold">{amount(payment.amount)}</span>
                        <StatusBadge value={payment.status} />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                          <a href={`/api/payments/${payment.id}/document?kind=receipt`} target="_blank" rel="noreferrer" title="View receipt">
                            <Receipt className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!payments.length && <EmptyState text="No invoices or payments yet." />}
          </CardContent>
        </Card>
      )}
    </CustomerShell>
  );
}
