"use client";

import { useState } from "react";
import { Download, FileText, Palette, Truck, Wrench, BookOpen, Video } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All resources", "File prep", "Design guides", "Materials", "Vehicle wraps", "Downloads"];

const RESOURCES = [
  {
    id: 1,
    category: "File prep",
    type: "Guide",
    icon: "file",
    title: "The complete print file prep guide",
    desc: "Everything you need to know about resolution, bleed, color space, and font handling before submitting artwork.",
    badge: "Essential",
    badgeColor: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
    readTime: "12 min read",
  },
  {
    id: 2,
    category: "Materials",
    type: "Guide",
    icon: "palette",
    title: "Matte vs. gloss: choosing the right finish",
    desc: "When gloss makes sense, when matte wins, and how to match your finish to your design style and environment.",
    badge: "Popular",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    readTime: "6 min read",
  },
  {
    id: 3,
    category: "File prep",
    type: "Download",
    icon: "download",
    title: "Print-ready templates — Illustrator & Photoshop",
    desc: "Pre-sized templates with bleed marks, safe zones, and guides for business cards, banners, yard signs, and more.",
    badge: "Free download",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    readTime: "28 files",
  },
  {
    id: 4,
    category: "Materials",
    type: "Guide",
    icon: "palette",
    title: "Vinyl weight guide: 13oz vs 15oz vs 18oz banners",
    desc: "The practical differences between vinyl weights — durability, light-blocking, and which to choose for indoor vs outdoor use.",
    badge: "Popular",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    readTime: "5 min read",
  },
  {
    id: 5,
    category: "Vehicle wraps",
    type: "Guide",
    icon: "wrench",
    title: "How to care for your vehicle wrap",
    desc: "Washing, waxing, storage, and repair — everything that extends the life of your wrap and keeps it looking sharp.",
    badge: null,
    badgeColor: "",
    readTime: "8 min read",
  },
  {
    id: 6,
    category: "Design guides",
    type: "Guide",
    icon: "book",
    title: "Typography rules for print design",
    desc: "Minimum font sizes for viewing distance, spacing, contrast ratios, and the fonts that always work well in print.",
    badge: null,
    badgeColor: "",
    readTime: "7 min read",
  },
  {
    id: 7,
    category: "File prep",
    type: "Guide",
    icon: "file",
    title: "CMYK vs RGB: understanding color for print",
    desc: "Why your digital colors sometimes look different on print, and how to set up your files correctly from the start.",
    badge: "Essential",
    badgeColor: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
    readTime: "5 min read",
  },
  {
    id: 8,
    category: "Downloads",
    type: "Download",
    icon: "download",
    title: "Vehicle wrap design templates",
    desc: "Accurate body templates for Tesla Model 3, Model Y, Model S, pickup trucks, sprinter vans, and cargo vans.",
    badge: "Free download",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    readTime: "12 templates",
  },
  {
    id: 9,
    category: "Design guides",
    type: "Guide",
    icon: "palette",
    title: "Color psychology in print marketing",
    desc: "How color choices affect perception, brand recognition, and response rates across different industries and audiences.",
    badge: null,
    badgeColor: "",
    readTime: "9 min read",
  },
  {
    id: 10,
    category: "Vehicle wraps",
    type: "Video",
    icon: "video",
    title: "Full vehicle wrap installation: Tesla Model Y",
    desc: "Time-lapse of a complete Tesla Model Y commercial wrap installation from surface prep to final install.",
    badge: "Video",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    readTime: "14 min watch",
  },
  {
    id: 11,
    category: "File prep",
    type: "Download",
    icon: "download",
    title: "Pre-press checklist PDF",
    desc: "A single-page PDF checklist to run through before submitting any print job. Save it, print it, pin it up.",
    badge: "Free download",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    readTime: "1 page",
  },
  {
    id: 12,
    category: "Design guides",
    type: "Guide",
    icon: "book",
    title: "Designing for large-format: what's different",
    desc: "Viewing distance, resolution trade-offs, bleed requirements, and design principles that change at large scale.",
    badge: null,
    badgeColor: "",
    readTime: "8 min read",
  },
];

function ResourceIcon({ type }: { type: string }) {
  const cls = "h-5 w-5";
  if (type === "download") return <Download className={cls} />;
  if (type === "palette") return <Palette className={cls} />;
  if (type === "wrench") return <Wrench className={cls} />;
  if (type === "book") return <BookOpen className={cls} />;
  if (type === "video") return <Video className={cls} />;
  if (type === "truck") return <Truck className={cls} />;
  return <FileText className={cls} />;
}

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState("All resources");

  const filtered = RESOURCES.filter(
    (r) => activeCategory === "All resources" || r.category === activeCategory
  );

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <SiteNav />

      {/* Hero */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Resources & guides</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            File prep guides, material comparisons, design templates, and everything else you need to get perfect results.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <div className="sticky top-16 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-5xl">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn("shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap", activeCategory === cat ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800")}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.id} className="group flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <ResourceIcon type={r.icon} />
                </div>
                {r.badge && (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", r.badgeColor)}>{r.badge}</span>
                )}
              </div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{r.category} · {r.type}</div>
              <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">{r.title}</h3>
              <p className="flex-1 text-[14px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{r.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[12px] text-zinc-400">{r.readTime}</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:underline">{r.type === "Download" ? "Download →" : r.type === "Video" ? "Watch →" : "Read →"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 px-8 py-10 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white dark:text-zinc-900">Need something specific?</h2>
          <p className="mb-6 text-zinc-400 dark:text-zinc-600">
            Can't find what you're looking for? Ask us — we've answered most print questions already.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/faq" className="inline-flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 px-5 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              Browse FAQ
            </a>
            <a href="/contact" className="inline-flex items-center justify-center rounded-lg border border-zinc-700 dark:border-zinc-300 px-5 py-2.5 font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
              Ask a question
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 text-center text-sm text-zinc-400">
        © 2026 controlp.io · Chandler, Arizona · (480) 999-9906
      </footer>
    </div>
  );
}
