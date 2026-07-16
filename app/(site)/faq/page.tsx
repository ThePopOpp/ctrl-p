"use client";

import { useState } from "react";
import { ChevronDown, MessageSquare, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQ_SECTIONS = [
  {
    id: "orders",
    title: "Orders & Shipping",
    items: [
      {
        q: "What's your typical turnaround time?",
        a: "Most products ship within 3–5 business days from proof approval. Rush options are available for 1–2 business day turnaround on select products. Same-day local pickup is available in Chandler, AZ for orders placed before 2 PM MST.",
      },
      {
        q: "Do you ship nationwide?",
        a: "Yes. We ship to all 50 states via UPS and FedEx. Free shipping is included on all orders over $75.",
      },
      {
        q: "Can I pick up my order locally?",
        a: "Absolutely. Local pickup is available at our Chandler, AZ location. Orders placed before 2 PM MST are typically ready same-day.",
      },
      {
        q: "How do I track my order?",
        a: "You'll receive SMS and email updates at every stage — from proof approval through shipping and delivery. You can also check live order status in your account dashboard.",
      },
      {
        q: "What if something arrives damaged or wrong?",
        a: "We stand behind our work. If your order arrives damaged or doesn't match your approved proof, we'll reprint it for free. Just send us a photo within 7 days of delivery.",
      },
      {
        q: "How do I place an order?",
        a: "You can order directly through our online shop — configure your product, upload your artwork, and check out. For complex or custom requests, contact us and we'll walk you through it.",
      },
    ],
  },
  {
    id: "files",
    title: "File Preparation",
    items: [
      {
        q: "What file formats do you accept?",
        a: "We accept PDF, AI, EPS, PSD, PNG, and JPG. For best results, submit print-ready PDF files with embedded fonts and CMYK color space.",
      },
      {
        q: "What resolution should my artwork be?",
        a: "300 DPI for business cards, flyers, and small-format items. 150 DPI for most banners and signs. 100 DPI is acceptable for very large-format prints viewed from a distance (8ft+).",
      },
      {
        q: "Do I need to add bleed to my files?",
        a: "Yes — 0.125\" (⅛ inch) bleed for business cards and flyers; 0.25\" for banners, signs, and most other products. This prevents white edges after cutting.",
      },
      {
        q: "CMYK or RGB?",
        a: "Always use CMYK for print files. RGB colors can shift noticeably when converted to print. If you submit an RGB file, we'll convert it and notify you if any significant color changes occur.",
      },
      {
        q: "Should I outline my fonts?",
        a: "Yes — converting text to outlines (or embedding fonts) ensures your typography prints exactly as designed, even if we don't have your specific font installed.",
      },
    ],
  },
  {
    id: "products",
    title: "Products & Materials",
    items: [
      {
        q: "What's the difference between 13oz, 15oz, and 18oz vinyl?",
        a: "Weight indicates density and durability. 13oz is our standard indoor/short-term outdoor vinyl. 15oz is heavier and more durable for extended outdoor use. 18oz is our heavy-duty option that also blocks light — ideal for long-term outdoor banners.",
      },
      {
        q: "Are your materials outdoor-safe?",
        a: "Yes. All our print inks are UV-stable and rated for 2–5+ years of outdoor exposure depending on the material. We'll recommend the right material for your specific application.",
      },
      {
        q: "Can I request a physical sample before ordering?",
        a: "Yes. Email us at hello@controlp.io and we'll send you material samples so you can see and feel the difference before committing to a large order.",
      },
      {
        q: "Can I customize my own products in real-time?",
        a: "Yes — every product on controlp.io has a built-in online customizer. Select your size, material, and finishing options, upload your artwork, and see a live price update before checkout.",
      },
      {
        q: "Do you offer installation for signs and wraps?",
        a: "Yes. We offer professional installation for vehicle wraps, large-format signs, and window graphics throughout the greater Phoenix/Chandler, AZ area. Contact us for installation quotes.",
      },
      {
        q: "What sizes do banners come in?",
        a: "We offer standard sizes from 2'×4' up to 6'×12' and larger. Custom sizes are also available. Use our online configurator to enter your exact dimensions and get an instant price.",
      },
      {
        q: "What is the difference between matte and gloss?",
        a: "Gloss finishes are shiny and vibrant — great for photos and bold colors. Matte finishes are flat with no glare — easier to read in bright environments and more professional-looking for text-heavy designs.",
      },
      {
        q: "Do you offer same-day printing?",
        a: "Yes, for select products with local pickup. Order before 10 AM MST and we can often have standard products ready by end of day. Contact us to confirm availability for your specific order.",
      },
      {
        q: "What's your largest print size?",
        a: "We regularly produce prints up to 10'×20' for trade show displays and event backdrops. For truly oversized projects, contact us for a custom quote.",
      },
    ],
  },
  {
    id: "vehicles",
    title: "Vehicle Wraps",
    items: [
      {
        q: "How long does a vehicle wrap take?",
        a: "Full wraps typically take 3–5 business days (1–2 days for installation, plus design/production time). Partial wraps and spot graphics can often be done in 1–2 days.",
      },
      {
        q: "Can you wrap a Tesla?",
        a: "Yes — Tesla wraps are our specialty. We've wrapped over 180 Teslas across all models including Model 3, Y, S, and X. Our installers are trained on Tesla's unique panel geometry and glass roofs.",
      },
      {
        q: "Will a wrap damage my paint?",
        a: "No — when properly installed and removed, quality vinyl actually protects your paint. We use 3M and Avery cast vinyl products with a clean-release adhesive designed to remove without damage.",
      },
      {
        q: "How long does a vehicle wrap last?",
        a: "A professionally installed wrap using quality cast vinyl typically lasts 5–7 years with proper care. Color-change wraps may show some fading after 3–5 years depending on sun exposure.",
      },
    ],
  },
  {
    id: "billing",
    title: "Billing & Payment",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit cards (Visa, Mastercard, Amex, Discover), Apple Pay, Google Pay, and ACH bank transfer for larger orders.",
      },
      {
        q: "Do you charge sales tax?",
        a: "Arizona sales tax (8.6%) applies to all local orders. Out-of-state orders shipped outside Arizona are generally exempt from sales tax.",
      },
      {
        q: "Do you offer bulk or volume discounts?",
        a: "Yes. Significant discounts are available for large quantity orders and repeat customers. Contact us or request a quote and we'll provide tiered pricing for your order volume.",
      },
    ],
  },
];

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 py-4 text-left"
      >
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{q}</span>
        <ChevronDown className={cn("mt-0.5 h-5 w-5 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="pb-4 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{a}</div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [activeSection, setActiveSection] = useState("orders");

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Hero */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-14 text-center">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">How can we help?</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            Browse answers below, or contact us directly. Our team replies within 4 business hours.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar nav */}
          <aside className="lg:w-56 shrink-0">
            <nav className="sticky top-24 space-y-1">
              {FAQ_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn("w-full rounded-lg px-4 py-2.5 text-left text-[14px] font-medium transition-colors", activeSection === section.id ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* FAQ content */}
          <div className="flex-1 min-w-0">
            {FAQ_SECTIONS.filter((s) => s.id === activeSection).map((section) => (
              <div key={section.id}>
                <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{section.title}</h2>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6">
                  {section.items.map((item, i) => (
                    <AccordionItem key={i} q={item.q} a={item.a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-14 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Still have questions?</h2>
            <p className="mb-8 text-zinc-500 dark:text-zinc-400">
              Our team replies within 4 business hours. For urgent requests, text us for the fastest response.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:4809999906" className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-5 py-3 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <Phone className="h-4 w-4" />
                (480) 999-9906
              </a>
              <a href="mailto:hello@controlp.io" className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-5 py-3 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <Mail className="h-4 w-4" />
                hello@controlp.io
              </a>
              <a href="/contact" className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-3 font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
                <MessageSquare className="h-4 w-4" />
                Send a message
              </a>
            </div>
          </div>
        </div>

        {/* Popular articles */}
        <div className="mt-10">
          <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Popular resources</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { title: "File prep guide — getting your artwork print-ready", href: "/resources" },
              { title: "Matte vs. gloss: which finish is right for your project?", href: "/blog" },
              { title: "How to care for your vehicle wrap", href: "/blog" },
              { title: "Rush orders — what's possible and how to request one", href: "/contact" },
            ].map((article) => (
              <a
                key={article.title}
                href={article.href}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <span className="flex-1">{article.title}</span>
                <span className="text-zinc-400">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
