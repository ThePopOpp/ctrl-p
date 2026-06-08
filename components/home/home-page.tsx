"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Facebook, Instagram, Linkedin, Phone, Mail, Zap } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

function Star({ filled = true }: { filled?: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? undefined : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z" />
    </svg>
  );
}

function Stars({ count, outOf = 5 }: { count: number; outOf?: number }) {
  return (
    <div className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: outOf }).map((_, i) => (
        <Star key={i} filled={i < count} />
      ))}
    </div>
  );
}

/* ── Category icon SVGs ─────────────────────────────────── */
function WrapIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17V19C4 20.1046 4.89543 21 6 21C7.10457 21 8 20.1046 8 19V17M16 17V19C16 20.1046 16.8954 21 18 21C19.1046 21 20 20.1046 20 19V17M21 7L19 9L18.094 6.28211C17.7006 5.10188 17.5039 4.51176 17.1391 4.07547C16.8169 3.6902 16.4031 3.39198 15.9357 3.20816C15.4065 3 14.7844 3 13.5404 3L10.4596 3C9.21557 3 8.59354 3 8.06426 3.20816C7.59688 3.39198 7.18312 3.6902 6.86093 4.07547C6.49608 4.51176 6.29937 5.10188 5.90596 6.28211L5 9L3 7M17 13V13.0099M7 13V13.0099M17 17H7C6.07003 17 5.60504 17 5.22354 16.8978C4.18827 16.6204 3.37962 15.8117 3.10222 14.7765C3 14.395 3 13.93 3 13C3 12.07 3 11.605 3.10222 11.2235C3.37962 10.1883 4.18827 9.37962 5.22354 9.10222C5.60504 9 6.07003 9 7 9H17C17.93 9 18.395 9 18.7765 9.10222C19.8117 9.37962 20.6204 10.1883 20.8978 11.2235C21 11.605 21 12.07 21 13C21 13.93 21 14.395 20.8978 14.7765C20.6204 15.8117 19.8117 16.6204 18.7765 16.8978C18.395 17 17.93 17 17 17Z" />
    </svg>
  );
}
function SignsIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2L4 22M4 3H20L17.3333 8L20 13H4V3Z" />
    </svg>
  );
}
function BannerIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}
function CardsIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6.99995H9C7.13872 6.99995 6.20808 6.99995 5.45491 7.24467C3.93273 7.73926 2.73931 8.93267 2.24472 10.4549M15 6.99995C16.8613 6.99995 17.7919 6.99995 18.5451 7.24467C20.0673 7.73926 21.2607 8.93267 21.7553 10.4549C22 11.208 22 12.1387 22 13.9999C22 15.8612 22 16.7919 21.7553 17.545C21.2607 19.0672 20.0673 20.2606 18.5451 20.7552C17.7919 20.9999 16.8613 20.9999 15 20.9999H9C7.13872 20.9999 6.20808 20.9999 5.45491 20.7552C3.93273 20.2606 2.73931 19.0672 2.24472 17.545C2 16.7919 2 15.8612 2 13.9999C2 12.1387 2 11.208 2.24472 10.4549M15 6.99995C16.3267 6.99995 17.1805 6.99995 17.8343 7.08857C17.735 6.45299 17.5761 5.94744 17.322 5.51057C16.7272 4.48803 15.7891 3.7095 14.6745 3.31333C13.4039 2.86174 11.7778 3.16663 8.52569 3.77641C6.20344 4.21183 5.04231 4.42954 4.17274 5.0257C3.40603 5.55134 2.80104 6.28031 2.4257 7.13075C2 8.0953 2 9.27666 2 11.6394V12C2 12.386 2 12.7453 2.00143 13.0809C2.00793 11.8094 2.04405 11.0725 2.24472 10.4549M22 15.9999H18C16.8954 15.9999 16 15.1045 16 13.9999C16 12.8954 16.8954 11.9999 18 11.9999H22V15.9999Z" />
    </svg>
  );
}
function MerchIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.282C12.8366 21.282 13.6732 21.0723 14.4282 20.6528L18.4282 18.4306C20.0155 17.5487 21 15.8756 21 14.0598V9.94383C21 9.1706 20.8215 8.42326 20.4939 7.75187L12 11.9988M12 21.282V11.9988M12 21.282C11.1634 21.282 10.3268 21.0725 9.57178 20.653L5.57178 18.4308C3.98446 17.549 3 15.8759 3 14.06V9.94405C3 9.17077 3.17853 8.42338 3.50612 7.75196L12 11.9988M7.5 14.0001V9.5001L16.5 4.5001M20.4946 7.75275L12.0001 12L3.50538 7.75265C3.947 6.84678 4.6599 6.07909 5.57175 5.5725L9.57175 3.35028C11.0819 2.51133 12.9181 2.51133 14.4282 3.35028L18.4282 5.5725C19.3401 6.07911 20.053 6.84684 20.4946 7.75275Z" />
    </svg>
  );
}
function DisplaysIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20h18M12 3L3 20M12 3l9 17M9 20l3-6 3 6" />
    </svg>
  );
}
function WindowIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18M12 3v18" />
    </svg>
  );
}

const CATEGORIES = [
  { icon: WrapIcon, title: "Vehicle Wraps", desc: "6 products · Tesla specialty", href: "/shop" },
  { icon: SignsIcon, title: "Signs", desc: "Acrylic · Aluminum · Coroplast", href: "/shop" },
  { icon: BannerIcon, title: "Banners", desc: "Vinyl · Mesh · Fabric · Retractable", href: "/shop" },
  { icon: CardsIcon, title: "Business Cards", desc: "Standard · Die-cut · Foil", href: "/shop" },
  { icon: SignsIcon, title: "Flags", desc: "Feather · Teardrop · Pole", href: "/shop" },
  { icon: DisplaysIcon, title: "Displays & Tents", desc: "Event tents · Tabletop · Fabric", href: "/shop" },
  { icon: MerchIcon, title: "Apparel & Merch", desc: "Shirts · Hats · Bags · Mugs", href: "/shop" },
  { icon: WindowIcon, title: "Window Graphics", desc: "Perforated · Cling · Frosted", href: "/shop" },
];

type ProductCard = {
  badge?: { label: string; color: string };
  image?: string;
  category: string;
  name: string;
  price: string;
  stars: number;
  filter: string;
};

const POPULAR_PRODUCTS: ProductCard[] = [
  { badge: { label: "New", color: "bg-zinc-900 text-white" }, image: "https://www.b2sign.com/image/thumb/240228/oaKpnDtM-s1000.jpg", category: "Rigid Sign", name: "Gatorboard", price: "From $28/ea", stars: 5, filter: "Signs" },
  { badge: { label: "Best Seller", color: "bg-emerald-500 text-white" }, image: "https://www.b2sign.com/image/thumb/240404/dNDEb9Bb-s1000.jpg", category: "Sign", name: "Standard A-Frame Sign", price: "From $89/ea", stars: 5, filter: "Signs" },
  { image: "https://www.b2sign.com/image/thumb/240228/snlYm2Bs-s1000.jpg", category: "Flags", name: "Pole Banner Set", price: "From $145/set", stars: 4, filter: "Banners" },
  { badge: { label: "Premium", color: "bg-zinc-100 text-zinc-700" }, image: "https://www.b2sign.com/image/thumb/240228/XWKEnh55-s1000.jpg", category: "Display", name: "Tension Fabric Stand", price: "From $325", stars: 5, filter: "Signs" },
  { category: "Window", name: "Perforated Window Cling", price: "From $18/sqft", stars: 5, filter: "Signs" },
  { category: "Business Cards", name: "Standard Business Cards", price: "From $24/100", stars: 5, filter: "Cards" },
  { badge: { label: "New", color: "bg-zinc-900 text-white" }, category: "Business Cards", name: "Die-Cut Business Cards", price: "From $48/100", stars: 5, filter: "Cards" },
  { image: "https://www.b2sign.com/image/thumb/240430/WvsHtoYW-s1000.jpg", category: "Banner", name: "Mesh Banners", price: "From $3.50/sqft", stars: 4, filter: "Banners" },
];

const PRODUCT_FILTERS = ["All", "Signs", "Banners", "Wraps", "Cards"];

const TESLA_MODELS = [
  { label: "Model S", span: "" },
  { label: "Model 3", span: "" },
  { label: "Model Y", span: "" },
  { label: "Model X", span: "" },
  { label: "Cybertruck", span: "col-span-2" },
];

const REVIEWS = [
  {
    text: "Running a retail chain means consistency is everything. ControlP.io manages all our signage across 12 locations. Their attention to detail and color matching is impeccable.",
    name: "Kristy Dale", role: "Owner, Retail Chain", initials: "KD", color: "bg-amber-400",
  },
  {
    text: "When we needed to rebrand our entire office on a tight deadline, ControlP.io delivered. From wall graphics to illuminated signage, every piece was perfect.",
    name: "Tina Westinghouse", role: "Real Estate Broker", initials: "TW", color: "bg-emerald-500",
  },
  {
    text: "Their vehicle wraps turned our delivery fleet into moving billboards that consistently draw attention and new business. Quality exceeded expectations.",
    name: "Mike Gauthier", role: "Owner · CFP", initials: "MG", color: "bg-blue-500",
  },
];

export function HomePage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const filtered = activeFilter === "All" ? POPULAR_PRODUCTS : POPULAR_PRODUCTS.filter((p) => p.filter === activeFilter);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <SiteNav />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900/60 dark:to-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1280px] mx-auto px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Review chip */}
              <div className="inline-flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 shadow-sm mb-5">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-amber-400 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-semibold text-white">K</div>
                  <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-semibold text-white">T</div>
                  <div className="w-7 h-7 rounded-full bg-blue-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-semibold text-white">M</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold flex items-center gap-1">
                    4.9 <Star />
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z" /></svg>
                  </div>
                  <div className="text-[11px] text-zinc-500">from 340+ reviews</div>
                </div>
              </div>

              {/* Live badge */}
              <div className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full px-3 py-1 text-[11.5px] font-medium mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Now offering same-day business cards in Chandler
              </div>

              <h1 className="text-[52px] lg:text-[56px] leading-[1.05] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-5">
                Prints, signs, wraps &amp; designs.
                <span className="block text-zinc-400">Done right.</span>
              </h1>
              <p className="text-[17px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[540px] mb-8">
                Arizona's premier one-stop shop for premium print, design, and branding. Vehicle wraps, large format, signs, apparel — wholesale prices, agency-grade craft.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Link href="/shop" className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md px-6 py-3 text-[15px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
                  Shop all products <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/contact" className="inline-flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md px-6 py-3 text-[15px] font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  Start my wrap
                </Link>
              </div>

              <div className="flex items-center gap-5 text-[12.5px] text-zinc-500">
                <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" />Nationwide shipping</div>
                <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" />1–3 day turnaround</div>
                <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" />Free design review</div>
              </div>
            </div>

            {/* Hero image grid */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-3">
                <Link href="/shop?category=wall-art" className="group overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 aspect-[4/5] relative block bg-zinc-100 dark:bg-zinc-900">
                  <img src="https://www.b2sign.com/image/thumb/240305/p3UypbTG-s1000.jpg" alt="Wall art framed print" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 backdrop-blur-sm shadow-md border border-white/60 dark:border-zinc-700/60">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><rect x="3" y="3" width="18" height="18" rx="2" /><rect x="7" y="7" width="10" height="10" rx="1" /></svg>
                    Wall Art
                  </span>
                </Link>
                <div className="space-y-3">
                  <Link href="/shop" className="group overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 aspect-square relative block bg-zinc-100 dark:bg-zinc-900">
                    <img src="https://controlp.io/wp-content/uploads/2025/02/cotton.bc_.3.webp" alt="Premium business cards" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 backdrop-blur-sm shadow-md border border-white/60 dark:border-zinc-700/60">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /></svg>
                      Business Cards
                    </span>
                  </Link>
                  <Link href="/shop?category=banners" className="group overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 aspect-square relative block bg-zinc-100 dark:bg-zinc-900">
                    <img src="https://www.b2sign.com/image/thumb/240305/YD25B8Uu-s1000.jpg" alt="Custom banners" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 backdrop-blur-sm shadow-md border border-white/60 dark:border-zinc-700/60">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><path d="M4 2L4 22M4 3H20L17.3333 8L20 13H4V3Z" /></svg>
                      Banners
                    </span>
                  </Link>
                </div>
              </div>

              {/* Floating stat card */}
              <div className="absolute -bottom-4 -left-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 shadow-lg hidden md:flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold">2,400+ projects</div>
                  <div className="text-[11px] text-zinc-500">delivered statewide</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vendor trust bar ───────────────────────────────── */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 py-8 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center text-[11.5px] tracking-[0.15em] uppercase text-zinc-400 font-semibold mb-5">Trusted vendors &amp; materials</div>
          <div className="flex items-center justify-center gap-10 flex-wrap opacity-60 text-zinc-500 text-[14px] font-medium">
            <span>3M</span><span>·</span><span>Avery Dennison</span><span>·</span><span>4Over</span><span>·</span>
            <span>B2Sign</span><span>·</span><span>Max Pro Films</span><span>·</span><span>Rowmark</span><span>·</span><span>SAi Flexi</span>
          </div>
        </div>
      </section>

      {/* ── Shop by Category ───────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[12px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">Browse</div>
              <h2 className="text-[36px] font-bold tracking-tight">Shop by category</h2>
            </div>
            <Link href="/shop" className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              View all categories <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link key={cat.title} href={cat.href} className="group overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 text-zinc-400 dark:text-zinc-600">
                    <Icon />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[15px]">{cat.title}</h3>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <p className="text-[12.5px] text-zinc-500 mt-1">{cat.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Popular Products ───────────────────────────────── */}
      <section className="py-20 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[12px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">Best Sellers</div>
              <h2 className="text-[36px] font-bold tracking-tight">Most popular products</h2>
            </div>
            <div className="hidden md:flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 text-[13px]">
              {PRODUCT_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeFilter === f
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <Link key={product.name} href="/shop" className="group overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="aspect-square relative bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900">
                  {product.badge && (
                    <div className={`absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-medium ${product.badge.color}`}>
                      {product.badge.label}
                    </div>
                  )}
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600">
                      <CardsIcon size={64} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">{product.category}</div>
                  <h3 className="font-semibold text-[14.5px] mt-1 mb-2">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-semibold">{product.price}</div>
                    <Stars count={product.stars} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex justify-center mt-10">
            <Link href="/shop" className="inline-flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md px-8 py-3 text-[15px] font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              View all products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tesla Wraps ────────────────────────────────────── */}
      <section className="py-20 bg-zinc-950 text-zinc-100 relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-zinc-800 text-zinc-300 rounded-full px-3 py-1 text-[11.5px] font-medium mb-5">
                <Zap className="h-3 w-3" /> Tesla Specialists
              </div>
              <h2 className="text-[44px] font-bold tracking-tight leading-[1.1] mb-5">
                Vehicle wraps, spot<br />graphics, color changes &amp; tint
              </h2>
              <p className="text-[16px] text-zinc-400 leading-relaxed mb-8 max-w-[520px]">
                Precision installation on every make and model. We specialize in Tesla wraps — Model S, 3, Y, X, and Cybertruck — with premium 3M and Avery films.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <Link href="/contact" className="inline-flex items-center gap-2 bg-white text-zinc-900 rounded-md px-6 py-3 text-[15px] font-semibold hover:bg-zinc-100 transition-colors">Start my wrap</Link>
                <Link href="/faq" className="inline-flex items-center gap-2 border border-zinc-700 text-zinc-100 rounded-md px-6 py-3 text-[15px] font-medium hover:bg-zinc-800 transition-colors">Finance calculator</Link>
              </div>
              <div className="text-[12px] text-zinc-500 italic">Not affiliated with Tesla, unless Tesla or Elon wants to be...</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {TESLA_MODELS.map((model) => (
                <div key={model.label} className={`bg-zinc-900 border border-zinc-800 rounded-lg aspect-square flex flex-col items-center justify-center p-3 hover:border-zinc-600 transition-colors cursor-pointer ${model.span}`}>
                  <WrapIcon size={40} />
                  <div className="text-[12px] font-semibold mt-1">{model.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[12px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">How it works</div>
            <h2 className="text-[36px] font-bold tracking-tight mb-3">From concept to install in days</h2>
            <p className="text-[15px] text-zinc-500 max-w-[540px] mx-auto">Upload your artwork or use our design tools. We handle the rest — printing, finishing, and professional install if needed.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: "01", title: "Design or upload", body: "Use our online sign designer, start with a template, or upload your print-ready artwork.", cta: "Open designer", href: "/templates" },
              { step: "02", title: "We print & finish", body: "Premium vendor materials, color-matched proofs, and quality checks on every order.", cta: "See materials", href: "/resources" },
              { step: "03", title: "Ship or install", body: "Nationwide shipping, or book a professional install for wraps and signage in Arizona.", cta: "Book install", href: "/contact" },
            ].map((item) => (
              <div key={item.step} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-7">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-[15px] mb-5">{item.step}</div>
                <h3 className="font-semibold text-[17px] mb-2">{item.title}</h3>
                <p className="text-[13.5px] text-zinc-500 leading-relaxed mb-4">{item.body}</p>
                <Link href={item.href} className="text-[13px] font-semibold inline-flex items-center gap-1.5 hover:gap-2.5 transition-all">
                  {item.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Business Cards feature ─────────────────────────── */}
      <section className="py-16 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="grid md:grid-cols-2 items-center">
              <div className="p-10 lg:p-14">
                <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full px-3 py-1 text-[11.5px] font-medium mb-4">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z" /><path d="M11 3L8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></svg>
                  Premium
                </div>
                <h2 className="text-[34px] font-bold tracking-tight leading-[1.15] mb-4">
                  The very-best-for-your premium business cards.
                </h2>
                <p className="text-[14.5px] text-zinc-500 leading-relaxed mb-6 max-w-[440px]">
                  Spend less on the best business cards in the game. Standard, die-cut, and specialty finishes starting at $24/100.
                </p>
                <div className="flex gap-3">
                  <Link href="/shop" className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md px-5 py-2.5 text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">Shop business cards</Link>
                  <Link href="/shop" className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300 rounded-md px-5 py-2.5 text-[14px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">See samples →</Link>
                </div>
              </div>
              <div className="aspect-[4/3] md:aspect-auto md:h-full flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 text-zinc-400 dark:text-zinc-600">
                <CardsIcon size={140} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reviews ────────────────────────────────────────── */}
      <section className="py-20 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[12px] font-semibold tracking-wider uppercase text-zinc-400 mb-2">Testimonials</div>
            <h2 className="text-[36px] font-bold tracking-tight mb-3">Customers love us</h2>
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z" /></svg>
                ))}
              </div>
              <span className="text-[14px] font-semibold">4.9</span>
              <span className="text-[14px] text-zinc-500">from 340+ reviews</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {REVIEWS.map((r) => (
              <div key={r.name} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-0.5 text-amber-500 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z" /></svg>
                  ))}
                </div>
                <p className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300 mb-5">"{r.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className={`w-9 h-9 rounded-full ${r.color} flex items-center justify-center text-white font-semibold text-[13px]`}>{r.initials}</div>
                  <div>
                    <div className="font-semibold text-[13.5px]">{r.name}</div>
                    <div className="text-[12px] text-zinc-500">{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SMS Newsletter ─────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-lg p-10 lg:p-14 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-[540px] mx-auto">
              <div className="inline-flex items-center gap-1.5 bg-white/10 text-white rounded-full px-3 py-1 text-[11.5px] font-medium mb-5">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>
                SMS Newsletter
              </div>
              <h2 className="text-[32px] font-bold tracking-tight mb-3">Design tips &amp; exclusive deals</h2>
              <p className="text-[14.5px] text-zinc-400 mb-7">Print, sign, and wrap deals texted directly to your mobile. No spam, unsubscribe anytime.</p>
              <form className="flex flex-col sm:flex-row gap-2 max-w-[440px] mx-auto" onSubmit={(e) => e.preventDefault()}>
                <input type="tel" placeholder="+1 (480) 555-0100" className="flex-1 px-4 py-3 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 text-[14px] outline-none focus:border-white/30" />
                <button type="submit" className="bg-white text-zinc-900 rounded-md px-6 py-3 text-[15px] font-semibold hover:bg-zinc-100 transition-colors whitespace-nowrap">Subscribe</button>
              </form>
              <p className="text-[11.5px] text-zinc-500 mt-4">By subscribing, you agree to receive marketing texts. Msg &amp; data rates may apply.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 pt-16 pb-8">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 pb-12 border-b border-zinc-200 dark:border-zinc-800">
            {/* Brand col */}
            <div className="md:col-span-2">
              <Link href="/" className="inline-flex items-center mb-4">
                <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-8 w-auto dark:hidden" />
                <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-8 w-auto dark:block" />
              </Link>
              <p className="text-[13px] text-zinc-500 max-w-[340px] leading-relaxed mb-5">
                Arizona's premier print provider — prints, signs, wraps, and designs at wholesale prices with agency-grade design services.
              </p>
              <a href="tel:+14809999906" className="flex items-center gap-2 text-[13px] font-semibold hover:text-zinc-600 dark:hover:text-zinc-300 mb-2 transition-colors">
                <Phone className="h-3.5 w-3.5" /> (480) 999-9906
              </a>
              <a href="mailto:hello@controlp.io" className="flex items-center gap-2 text-[13px] font-semibold hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                <Mail className="h-3.5 w-3.5" /> hello@controlp.io
              </a>
              <div className="flex items-center gap-2 mt-5">
                <a href="#" className="w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  <Facebook className="h-3.5 w-3.5" />
                </a>
                <a href="#" className="w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  <Instagram className="h-3.5 w-3.5" />
                </a>
                <a href="#" className="w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  <Linkedin className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Shop col */}
            <div>
              <h4 className="font-semibold text-[13px] mb-4">Shop</h4>
              <ul className="space-y-2.5 text-[13px] text-zinc-500">
                {["All products", "Signs", "Banners", "Vehicle wraps", "Business cards", "Apparel & merch"].map((l) => (
                  <li key={l}><Link href="/shop" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>

            {/* Services col */}
            <div>
              <h4 className="font-semibold text-[13px] mb-4">Services</h4>
              <ul className="space-y-2.5 text-[13px] text-zinc-500">
                {[
                  { label: "Graphic design", href: "/contact" },
                  { label: "Installation", href: "/contact" },
                  { label: "Web development", href: "/contact" },
                  { label: "Video production", href: "/contact" },
                  { label: "Templates", href: "/templates" },
                ].map((l) => (
                  <li key={l.label}><Link href={l.href} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Company col */}
            <div>
              <h4 className="font-semibold text-[13px] mb-4">Company</h4>
              <ul className="space-y-2.5 text-[13px] text-zinc-500">
                {[
                  { label: "About us", href: "/about" },
                  { label: "Blog", href: "/blog" },
                  { label: "FAQs", href: "/faq" },
                  { label: "Contact", href: "/contact" },
                  { label: "Support", href: "/resources" },
                ].map((l) => (
                  <li key={l.label}><Link href={l.href} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4">
            <div className="text-[12.5px] text-zinc-500">© {new Date().getFullYear()} controlp.io · All rights reserved · Chandler, Arizona</div>
            <div className="flex items-center gap-6 text-[12.5px] text-zinc-500">
              <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Privacy Policy</Link>
              <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Terms of Service</Link>
              <Link href="/faq" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Accessibility</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
