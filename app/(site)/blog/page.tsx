"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All articles", "Design tips", "File prep", "Vehicle wraps", "Materials guide", "Case studies", "Small business", "Industry news"];

const ARTICLES = [
  {
    id: 1,
    category: "Design tips",
    title: "The 7 deadly sins of banner design (and how to avoid every one)",
    excerpt: "Seventy percent of banner artwork we see contains at least one of these seven issues. Here's how to spot and fix each one before you submit.",
    author: "Sofia Mendes",
    date: "April 14, 2026",
    readTime: "8 min read",
    featured: true,
  },
  {
    id: 2,
    category: "Vehicle wraps",
    title: "How we wrapped a fleet of 12 Tesla Model Ys in 10 days",
    excerpt: "Behind-the-scenes documentation of our largest Tesla fleet project — strategy, materials, timeline, and lessons learned.",
    author: "Marcus Rivera",
    date: "Apr 11, 2026",
    readTime: "12 min read",
    featured: false,
  },
  {
    id: 3,
    category: "Design tips",
    title: "Business card design: the 2-second rule",
    excerpt: "If someone can't understand your name, role, and how to reach you in two seconds flat, your card is working against you.",
    author: "Sofia Mendes",
    date: "Apr 8, 2026",
    readTime: "6 min read",
    featured: false,
  },
  {
    id: 4,
    category: "Materials guide",
    title: "Choosing between 13oz, 15oz, and 18oz vinyl banners",
    excerpt: "Weight isn't just about durability. Here's a practical breakdown of when each vinyl weight makes sense for your project.",
    author: "Jeremy Waters",
    date: "Apr 2, 2026",
    readTime: "5 min read",
    featured: false,
  },
  {
    id: 5,
    category: "File prep",
    title: "CMYK vs RGB: what's the deal with color for print?",
    excerpt: "Why your vibrant digital colors sometimes come out dull or muddy on print — and how to prevent it every time.",
    author: "Sofia Mendes",
    date: "Mar 28, 2026",
    readTime: "4 min read",
    featured: false,
  },
  {
    id: 6,
    category: "Case studies",
    title: "How a local bakery tripled weekend foot traffic with one sign",
    excerpt: "A well-placed A-frame sign with the right design took a neighborhood bakery from 40 to 120 visitors on Saturday mornings.",
    author: "Jeremy Waters",
    date: "Mar 22, 2026",
    readTime: "7 min read",
    featured: false,
  },
  {
    id: 7,
    category: "Small business",
    title: "The yard sign campaign playbook for local service businesses",
    excerpt: "Everything we've learned from producing over 40,000 yard signs — quantity strategy, placement, messaging, and timing.",
    author: "Jeremy Waters",
    date: "Mar 18, 2026",
    readTime: "9 min read",
    featured: false,
  },
  {
    id: 8,
    category: "Design tips",
    title: "Perforated window graphics: when they work and when they don't",
    excerpt: "One-way perforated vinyl is one of the most misunderstood print materials. Here's when to use it and when to pick something else.",
    author: "Marcus Rivera",
    date: "Mar 14, 2026",
    readTime: "5 min read",
    featured: false,
  },
  {
    id: 9,
    category: "Industry news",
    title: "3M just launched a new premium cast vinyl — here's what we think",
    excerpt: "We've been testing 3M's latest premium cast film on a few luxury vehicles. Here's our honest take after two weeks.",
    author: "Marcus Rivera",
    date: "Mar 8, 2026",
    readTime: "6 min read",
    featured: false,
  },
  {
    id: 10,
    category: "Design tips",
    title: "Design rules for A-frame signs that actually stop traffic",
    excerpt: "A-frames have about 2 seconds to communicate at sidewalk speed. These rules make every one of those seconds count.",
    author: "Sofia Mendes",
    date: "Mar 3, 2026",
    readTime: "5 min read",
    featured: false,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Design tips": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "File prep": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Vehicle wraps": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Materials guide": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Case studies": "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  "Small business": "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  "Industry news": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", CATEGORY_COLORS[category] || "bg-zinc-100 text-zinc-600")}>
      {category}
    </span>
  );
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All articles");
  const [email, setEmail] = useState("");

  const filtered = ARTICLES.filter(
    (a) => activeCategory === "All articles" || a.category === activeCategory
  );
  const featured = filtered.find((a) => a.featured);
  const rest = filtered.filter((a) => !a.featured);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Hero */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">The controlp.io blog</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Print, design, and the business of branding.</p>
        </div>
      </section>

      {/* Category filter */}
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

      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* Featured article */}
        {featured && (
          <div className="mb-10 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 hover:shadow-md transition-shadow cursor-pointer">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-white dark:text-zinc-900">Featured</span>
              <CategoryBadge category={featured.category} />
              <span className="text-[12px] text-zinc-400">{featured.readTime}</span>
            </div>
            <h2 className="mb-3 text-2xl font-bold text-zinc-900 dark:text-zinc-100 leading-snug hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
              {featured.title}
            </h2>
            <p className="mb-5 text-[16px] leading-relaxed text-zinc-500 dark:text-zinc-400">{featured.excerpt}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  {featured.author.split(" ").map((n) => n[0]).join("")}
                </div>
                <span>{featured.author}</span>
                <span>·</span>
                <span>{featured.date}</span>
              </div>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline">Read article →</span>
            </div>
          </div>
        )}

        {/* Articles grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((article) => (
            <div key={article.id} className="group flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="mb-3 flex items-center gap-2">
                <CategoryBadge category={article.category} />
                <span className="text-[11px] text-zinc-400">{article.readTime}</span>
              </div>
              <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors flex-1">{article.title}</h3>
              <p className="mb-4 text-[14px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-3">{article.excerpt}</p>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold">
                    {article.author.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span>{article.author}</span>
                  <span>·</span>
                  <span>{article.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-10 flex justify-center gap-2">
          {[1, 2, 3, 4].map((p) => (
            <button
              key={p}
              className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors", p === 1 ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800")}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Newsletter */}
        <div className="mt-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">Subscribe to the print newsletter</h2>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            Monthly emails with design guidance, case studies, and exclusive promotions. No fluff.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); setEmail(""); }}
            className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" className="h-10 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
              Subscribe
            </button>
          </form>
        </div>
      </main>

    </div>
  );
}
