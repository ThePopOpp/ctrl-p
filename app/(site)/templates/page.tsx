"use client";

import { useState } from "react";
import { Search, Star, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "All templates",
  "Business cards",
  "Banners",
  "Yard signs",
  "Posters",
  "Flyers",
  "Event signage",
  "Real estate",
  "Restaurants",
  "Holiday",
];

const SORT_OPTIONS = ["Most popular", "Newest", "A–Z"];

const TEMPLATES = [
  { id: 1, type: "Business Card", name: "Clean Minimal", badge: "Free", uses: 4820, rating: 4.9, color: "#f0fdf4", accent: "#16a34a" },
  { id: 2, type: "Banner", name: "Grand Opening", badge: "Trending", uses: 3210, rating: 4.8, color: "#fff7ed", accent: "#ea580c" },
  { id: 3, type: "Yard Sign", name: "Real Estate Pro", badge: "Premium", uses: 2890, rating: 4.9, color: "#eff6ff", accent: "#2563eb" },
  { id: 4, type: "Poster", name: "Event Announcement", badge: "Free", uses: 5100, rating: 4.7, color: "#fdf4ff", accent: "#9333ea" },
  { id: 5, type: "Business Card", name: "Bold Contrast", badge: "Premium", uses: 1940, rating: 4.8, color: "#0f172a", accent: "#a3e635" },
  { id: 6, type: "Banner", name: "Sale Promotion", badge: "Free", uses: 6730, rating: 4.9, color: "#fef2f2", accent: "#dc2626" },
  { id: 7, type: "Flyer", name: "Restaurant Menu", badge: "Trending", uses: 2440, rating: 4.6, color: "#fefce8", accent: "#ca8a04" },
  { id: 8, type: "Event Signage", name: "Conference Backdrop", badge: "Premium", uses: 890, rating: 4.9, color: "#f0f9ff", accent: "#0284c7" },
  { id: 9, type: "Business Card", name: "Rounded Soft", badge: "Free", uses: 7200, rating: 4.8, color: "#fdf4ff", accent: "#c026d3" },
  { id: 10, type: "Yard Sign", name: "Political Campaign", badge: "Free", uses: 3670, rating: 4.7, color: "#eff6ff", accent: "#1d4ed8" },
  { id: 11, type: "Banner", name: "Now Hiring", badge: "Free", uses: 4180, rating: 4.8, color: "#f0fdf4", accent: "#15803d" },
  { id: 12, type: "Poster", name: "Concert Night", badge: "Trending", uses: 2960, rating: 4.9, color: "#1e1b4b", accent: "#818cf8" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3 w-3", i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600")} />
      ))}
    </div>
  );
}

function badgeClass(badge: string) {
  if (badge === "Free") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  if (badge === "Premium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400";
}

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("All templates");
  const [sort, setSort] = useState("Most popular");
  const [search, setSearch] = useState("");

  const filtered = TEMPLATES.filter((t) => {
    const matchesCat = activeCategory === "All templates" || t.type.toLowerCase().includes(activeCategory.toLowerCase().replace(" cards","").replace(" signs","").replace(" signage",""));
    const needle = search.toLowerCase();
    return matchesCat && (!needle || t.name.toLowerCase().includes(needle) || t.type.toLowerCase().includes(needle));
  });

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Hero */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-lime-100 dark:bg-lime-900/30 px-4 py-1.5 text-sm font-medium text-lime-700 dark:text-lime-400">
            <Sparkles className="h-4 w-4" />
            480+ ready-to-print designs
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Start with a template,<br />make it yours.
          </h1>
          <p className="mb-8 text-lg text-zinc-500 dark:text-zinc-400">
            Professional designs built for print. Customize in your browser, then order in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#templates" className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-[15px] font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
              Browse templates
            </a>
            <a href="/shop" className="inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-6 py-3 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Upload your own design
            </a>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div id="templates" className="sticky top-16 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="search"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-52 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-background pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 flex-1">
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
            <div className="relative shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-background pl-3 pr-8 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</p>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((t) => (
            <div key={t.id} className="group overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:shadow-md transition-shadow">
              {/* Preview area */}
              <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundColor: t.color }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                  <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: t.accent, opacity: 0.8 }} />
                  <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: t.accent, opacity: 0.4 }} />
                  <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: t.accent, opacity: 0.3 }} />
                </div>
                <div className="absolute left-2 top-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", badgeClass(t.badge))}>{t.badge}</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <a href={`/shop`} className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-zinc-900 shadow-lg hover:bg-zinc-50 transition-colors">Customize</a>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{t.type}</div>
                <div className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{t.name}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Stars rating={t.rating} />
                    <span className="text-[11px] text-zinc-400">{t.rating}</span>
                  </div>
                  <span className="text-[11px] text-zinc-400">{t.uses.toLocaleString()} uses</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <section className="mt-16 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { step: "1", title: "Pick a template", desc: "Browse 480+ designs sorted by product type and industry. Filter by style, size, or use case." },
              { step: "2", title: "Customize in browser", desc: "Change colors, fonts, photos, and text using our live editor — no design software needed." },
              { step: "3", title: "Print and ship", desc: "We produce your order with professional-grade equipment and ship it to your door in days." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xl font-bold">{s.step}</div>
                <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

    </div>
  );
}
