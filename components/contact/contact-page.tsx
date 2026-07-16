"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronRight, Clock, Mail, MapPin, MessageCircle, Phone, Send, Upload } from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("Get a quote for a project");
  const [message, setMessage] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !email.trim() || !message.trim()) {
      setErrorMsg("Please fill in first name, email, and message.");
      return;
    }
    setFormState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, phone, company, subject, message }),
      });
      if (res.ok) {
        setFormState("success");
        setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setCompany(""); setMessage("");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        setFormState("error");
      }
    } catch {
      setErrorMsg("Could not send message. Please try again.");
      setFormState("error");
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">

      {/* Hero */}
      <section className="py-16 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1280px] mx-auto px-6 text-center">
          <h1 className="text-[48px] font-bold tracking-tight mb-4">Let&apos;s talk.</h1>
          <p className="text-[16px] text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            Quotes, complex jobs, installation questions, or just want to swing by the shop — we&apos;re here.
          </p>
        </div>
      </section>

      {/* Main */}
      <section className="py-16">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">

            {/* Contact form */}
            <div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8">
                <h2 className="text-[24px] font-bold tracking-tight mb-1">Send us a message</h2>
                <p className="text-[13.5px] text-zinc-500 mb-6">We reply within 4 business hours.</p>

                {formState === "success" ? (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                      <Send className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="font-semibold text-[16px] text-emerald-800 dark:text-emerald-300 mb-1">Message sent!</div>
                    <p className="text-[13.5px] text-emerald-700 dark:text-emerald-400">Thanks for reaching out. We'll get back to you within 4 business hours.</p>
                    <button onClick={() => setFormState("idle")} className="mt-4 text-[13px] font-medium text-emerald-700 dark:text-emerald-400 underline underline-offset-2">Send another message</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[13px] font-medium mb-1.5">First name *</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jane"
                          className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[14px] bg-white dark:bg-zinc-800 outline-none focus:border-zinc-900 dark:focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/8 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium mb-1.5">Last name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[14px] bg-white dark:bg-zinc-800 outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium mb-1.5">Email *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@company.com"
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[14px] bg-white dark:bg-zinc-800 outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium mb-1.5">Phone <span className="text-zinc-400 font-normal">(optional)</span></label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(480) 555-0100"
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[14px] bg-white dark:bg-zinc-800 outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium mb-1.5">Company <span className="text-zinc-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Your company"
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[14px] bg-white dark:bg-zinc-800 outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium mb-1.5">What can we help with?</label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[14px] bg-white dark:bg-zinc-800 outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                      >
                        <option>Get a quote for a project</option>
                        <option>Vehicle wrap inquiry</option>
                        <option>Large format / signage</option>
                        <option>Business cards and stationery</option>
                        <option>Design services</option>
                        <option>Order status question</option>
                        <option>Something else</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium mb-1.5">Tell us more *</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                        placeholder="Size, quantity, timeline, any details that will help us quote accurately..."
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[14px] bg-white dark:bg-zinc-800 outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium mb-1.5">Files <span className="text-zinc-400 font-normal">(optional)</span></label>
                      <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg p-5 text-center hover:border-zinc-400 dark:hover:border-zinc-500 cursor-pointer transition-colors">
                        <Upload className="mx-auto mb-2 h-7 w-7 text-zinc-400" />
                        <div className="text-[13px] font-semibold">Drop files or browse</div>
                        <div className="text-[11.5px] text-zinc-400 mt-0.5">Artwork, references, photos — up to 250MB</div>
                      </div>
                    </div>

                    {errorMsg && (
                      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-[13px] text-red-700 dark:text-red-400">
                        {errorMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={formState === "submitting"}
                      className="w-full inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md px-5 py-3 text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 transition-colors"
                    >
                      {formState === "submitting" ? "Sending..." : <><Send className="h-4 w-4" />Send message</>}
                    </button>
                    <p className="text-[11.5px] text-zinc-400 text-center">By sending this message, you agree to our Privacy Policy.</p>
                  </form>
                )}
              </div>
            </div>

            {/* Contact info + map */}
            <div className="space-y-6">
              {/* Map placeholder */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div
                  className="aspect-[5/3] relative flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #e0e7ff 0%, #ede9fe 50%, #fce7f3 100%)",
                    backgroundImage: `
                      linear-gradient(135deg, #e0e7ff 0%, #ede9fe 50%, #fce7f3 100%),
                      linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)
                    `,
                    backgroundSize: "100% 100%, 40px 40px, 40px 40px",
                  }}
                >
                  {/* Grid overlay */}
                  <div className="absolute inset-0" style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }} />
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-lg z-10">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-zinc-900 opacity-10 animate-ping" />
                  </div>
                </div>
                <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Our shop</div>
                    <div className="font-semibold text-[14px] mt-0.5">Chandler, AZ 85226</div>
                  </div>
                  <a
                    href="https://maps.google.com/?q=Chandler+AZ+85226"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-[13px] font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Get directions
                  </a>
                </div>
              </div>

              {/* Quick contact cards */}
              <div className="grid grid-cols-2 gap-4">
                <a href="tel:+14809999906" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                  <div className="w-10 h-10 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center mb-3">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Call us</div>
                  <div className="text-[18px] font-bold mt-0.5">(480) 999-9906</div>
                  <div className="text-[12px] text-zinc-500">Mon–Fri · 8am–6pm MST</div>
                </a>

                <a href="mailto:hello@controlp.io" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                  <div className="w-10 h-10 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center mb-3">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Email</div>
                  <div className="text-[16px] font-bold mt-0.5 break-all">hello@controlp.io</div>
                  <div className="text-[12px] text-zinc-500">Reply within 4 hours</div>
                </a>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                  <div className="w-10 h-10 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center mb-3">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Text us</div>
                  <div className="text-[18px] font-bold mt-0.5">Text PRINT</div>
                  <div className="text-[12px] text-zinc-500">to (480) 999-9906</div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                  <div className="w-10 h-10 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center mb-3">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Hours</div>
                  <div className="text-[16px] font-bold mt-0.5">Mon–Fri 8–6</div>
                  <div className="text-[12px] text-zinc-500">Sat 9–2 · Sun closed</div>
                </div>
              </div>

              {/* Quick links */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <h3 className="font-semibold text-[15px] mb-4">Looking for something specific?</h3>
                <div className="space-y-3">
                  {[
                    { href: "/dashboard/customer/orders", title: "Check order status", desc: "Track your active orders and view history" },
                    { href: "/faq", title: "FAQ and help center", desc: "Common questions about files, shipping, turnaround" },
                    { href: "/templates", title: "Design guidelines & templates", desc: "File specs, bleed, color profiles, templates" },
                  ].map((link) => (
                    <Link key={link.title} href={link.href} className="flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 transition-colors">
                      <div className="flex-1">
                        <div className="text-[13.5px] font-semibold">{link.title}</div>
                        <div className="text-[11.5px] text-zinc-500">{link.desc}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
