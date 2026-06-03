"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  CustomerShell,
  EmptyState,
  fmtDateTime,
  human,
  useCustomerSession,
  type CustomerMessage,
} from "@/components/dashboard/customer-shell";
import { cn } from "@/lib/utils";

export function CustomerMessages() {
  const { data, state, errorMessage, theme, setTheme, messages, setMessages, bookings, getToken, signOut } = useCustomerSession();
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeOrderId, setComposeOrderId] = useState<string | null>(null);
  const [composeSending, setComposeSending] = useState(false);

  // Pre-fill compose from URL params (e.g. coming from orders page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");
    const subject = params.get("subject");
    const body = params.get("body");
    if (orderId || subject || body) {
      setComposeOpen(true);
      if (orderId) setComposeOrderId(orderId);
      if (subject) setComposeSubject(subject);
      if (body) setComposeBody(body);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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

  async function sendMessage() {
    const body = composeBody.trim();
    if (!body) return;
    setComposeSending(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/dashboard/customer/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: composeSubject.trim() || null, body, order_id: composeOrderId }),
      });
      const payload = await res.json().catch(() => ({})) as { message?: CustomerMessage; error?: string };
      if (!res.ok) { alert(payload.error || "Could not send message."); return; }
      if (payload.message) setMessages((prev) => [payload.message!, ...prev]);
      setComposeBody("");
      setComposeSubject("");
      setComposeOrderId(null);
      setComposeOpen(false);
    } finally {
      setComposeSending(false);
    }
  }

  const orders = data?.orders ?? [];
  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");

  return (
    <CustomerShell
      profile={data?.profile}
      unreadCount={unreadMessages.length}
      upcomingBookingsCount={upcomingBookings.length}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      onSignOut={signOut}
      activePage="Messages"
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
                  <MessageSquare className="h-4 w-4 text-primary" />Messages
                </CardTitle>
                <CardDescription>Your conversation history with the Ctrl+P team.</CardDescription>
              </div>
              <Button
                size="sm"
                variant={composeOpen ? "outline" : "default"}
                onClick={() => {
                  setComposeOpen((v) => !v);
                  if (composeOpen) { setComposeOrderId(null); setComposeSubject(""); setComposeBody(""); }
                }}
              >
                {composeOpen ? "Cancel" : <><Send className="h-3.5 w-3.5" />New message</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {composeOpen && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                {orders.length > 0 && (
                  <Select value={composeOrderId ?? "none"} onValueChange={(v) => setComposeOrderId(v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Link to an order (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No order linked</SelectItem>
                      {orders.slice(0, 30).map((o) => (
                        <SelectItem key={o.id} value={o.id}>Order #{o.order_number || o.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
                  placeholder="Subject (optional)"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
                <Textarea
                  className="min-h-[80px] resize-none text-sm"
                  placeholder="Write your message to the team..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); sendMessage(); } }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Ctrl+Enter to send</span>
                  <Button size="sm" disabled={composeSending || !composeBody.trim()} onClick={sendMessage}>
                    {composeSending ? "Sending..." : <><Send className="h-3.5 w-3.5" />Send</>}
                  </Button>
                </div>
              </div>
            )}

            {messages.length > 0 ? (
              <div className="space-y-2">
                {messages.map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  return (
                    <div key={msg.id} className={cn("rounded-lg border p-3", isOutbound ? "bg-background/35" : "border-primary/20 bg-primary/5")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{msg.subject || (isOutbound ? "From Ctrl+P" : "Your message")}</span>
                            <Badge variant="outline" className="text-[10px]">{human(msg.channel)}</Badge>
                            {!isOutbound && <Badge className="border-primary/20 bg-primary/10 text-[10px] text-primary">Sent</Badge>}
                            {msg.order_id && (() => { const o = orders.find((x) => x.id === msg.order_id); return o ? <Badge variant="outline" className="text-[10px]">Order #{o.order_number || o.id.slice(0, 8)}</Badge> : null; })()}
                          </div>
                          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{msg.body || "No message body."}</p>
                        </div>
                        {!msg.read_at && isOutbound && <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">{fmtDateTime(msg.sent_at || msg.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No messages yet. Send us a message using the button above." />
            )}
          </CardContent>
        </Card>
      )}
    </CustomerShell>
  );
}
