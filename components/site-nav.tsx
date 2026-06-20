"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, MapPin, Menu, Moon, Search, ShoppingCart, Sun, Truck, X } from "lucide-react";

const CART_KEY = "ctrlp_cart";

function readCartCount(): number {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return 0;
    const items = JSON.parse(raw) as Array<{ quantity: number }>;
    return items.reduce((s, i) => s + (i.quantity || 0), 0);
  } catch {
    return 0;
  }
}

function ShopIcon({ name }: { name: string }) {
  if (name === "largeformat")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8C13 7.44772 12.5523 7 12 7C11.4477 7 11 7.44772 11 8H13ZM11 12C11 12.5522 11.4477 13 12 13C12.5523 13 13 12.5522 13 12H11ZM10.0574 1.93526L4.05743 5.26859L5.02872 7.0169L11.0287 3.68357L10.0574 1.93526ZM2 8.76522V15.2348H4V8.76522H2ZM4.05743 18.7314L10.0574 22.0648L11.0287 20.3164L5.02871 16.9831L4.05743 18.7314ZM13.9426 22.0648L19.9426 18.7314L18.9713 16.9831L12.9713 20.3164L13.9426 22.0648ZM22 15.2348V8.76522H20V15.2348H22ZM19.9426 5.26859L13.9426 1.93526L12.9713 3.68357L18.9713 7.0169L19.9426 5.26859ZM11 8V12H13V8H11ZM22 8.76522C22 7.31255 21.2124 5.97407 19.9426 5.26859L18.9713 7.0169C19.6062 7.36964 20 8.03888 20 8.76522H22ZM19.9426 18.7314C21.2124 18.0259 22 16.6875 22 15.2348H20C20 15.9611 19.6062 16.6304 18.9713 16.9831L19.9426 18.7314ZM10.0574 22.0648C11.2655 22.7359 12.7345 22.7359 13.9426 22.0648L12.9713 20.3164C12.3672 20.652 11.6328 20.652 11.0287 20.3164L10.0574 22.0648ZM2 15.2348C2 16.6875 2.78757 18.0259 4.05743 18.7314L5.02871 16.9831C4.39378 16.6304 4 15.9611 4 15.2348H2ZM4.05743 5.26859C2.78757 5.97407 2 7.31255 2 8.76522H4C4 8.03888 4.39378 7.36964 5.02872 7.0169L4.05743 5.26859ZM11.0287 3.68357C11.6328 3.34799 12.3672 3.34799 12.9713 3.68357L13.9426 1.93526C12.7345 1.2641 11.2655 1.26409 10.0574 1.93526L11.0287 3.68357Z" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "signs")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2L4 22M4 3H20L17.3333 8L20 13H4V3Z" />
      </svg>
    );
  if (name === "wrap")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17V19C4 20.1046 4.89543 21 6 21C7.10457 21 8 20.1046 8 19V17M16 17V19C16 20.1046 16.8954 21 18 21C19.1046 21 20 20.1046 20 19V17M21 7L19 9L18.094 6.28211C17.7006 5.10188 17.5039 4.51176 17.1391 4.07547C16.8169 3.6902 16.4031 3.39198 15.9357 3.20816C15.4065 3 14.7844 3 13.5404 3L10.4596 3C9.21557 3 8.59354 3 8.06426 3.20816C7.59688 3.39198 7.18312 3.6902 6.86093 4.07547C6.49608 4.51176 6.29937 5.10188 5.90596 6.28211L5 9L3 7M17 13V13.0099M7 13V13.0099M17 17H7C6.07003 17 5.60504 17 5.22354 16.8978C4.18827 16.6204 3.37962 15.8117 3.10222 14.7765C3 14.395 3 13.93 3 13C3 12.07 3 11.605 3.10222 11.2235C3.37962 10.1883 4.18827 9.37962 5.22354 9.10222C5.60504 9 6.07003 9 7 9H17C17.93 9 18.395 9 18.7765 9.10222C19.8117 9.37962 20.6204 10.1883 20.8978 11.2235C21 11.605 21 12.07 21 13C21 13.93 21 14.395 20.8978 14.7765C20.6204 15.8117 19.8117 16.6204 18.7765 16.8978C18.395 17 17.93 17 17 17Z" />
      </svg>
    );
  if (name === "cards")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6.99995H9C7.13872 6.99995 6.20808 6.99995 5.45491 7.24467C3.93273 7.73926 2.73931 8.93267 2.24472 10.4549M15 6.99995C16.8613 6.99995 17.7919 6.99995 18.5451 7.24467C20.0673 7.73926 21.2607 8.93267 21.7553 10.4549C22 11.208 22 12.1387 22 13.9999C22 15.8612 22 16.7919 21.7553 17.545C21.2607 19.0672 20.0673 20.2606 18.5451 20.7552C17.7919 20.9999 16.8613 20.9999 15 20.9999H9C7.13872 20.9999 6.20808 20.9999 5.45491 20.7552C3.93273 20.2606 2.73931 19.0672 2.24472 17.545C2 16.7919 2 15.8612 2 13.9999C2 12.1387 2 11.208 2.24472 10.4549M15 6.99995C16.3267 6.99995 17.1805 6.99995 17.8343 7.08857C17.735 6.45299 17.5761 5.94744 17.322 5.51057C16.7272 4.48803 15.7891 3.7095 14.6745 3.31333C13.4039 2.86174 11.7778 3.16663 8.52569 3.77641C6.20344 4.21183 5.04231 4.42954 4.17274 5.0257C3.40603 5.55134 2.80104 6.28031 2.4257 7.13075C2 8.0953 2 9.27666 2 11.6394V12C2 12.386 2 12.7453 2.00143 13.0809C2.00793 11.8094 2.04405 11.0725 2.24472 10.4549M22 15.9999H18C16.8954 15.9999 16 15.1045 16 13.9999C16 12.8954 16.8954 11.9999 18 11.9999H22V15.9999Z" />
      </svg>
    );
  if (name === "merch")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21.282C12.8366 21.282 13.6732 21.0723 14.4282 20.6528L18.4282 18.4306C20.0155 17.5487 21 15.8756 21 14.0598V9.94383C21 9.1706 20.8215 8.42326 20.4939 7.75187L12 11.9988M12 21.282V11.9988M12 21.282C11.1634 21.282 10.3268 21.0725 9.57178 20.653L5.57178 18.4308C3.98446 17.549 3 15.8759 3 14.06V9.94405C3 9.17077 3.17853 8.42338 3.50612 7.75196L12 11.9988M7.5 14.0001V9.5001L16.5 4.5001M20.4946 7.75275L12.0001 12L3.50538 7.75265C3.947 6.84678 4.6599 6.07909 5.57175 5.5725L9.57175 3.35028C11.0819 2.51133 12.9181 2.51133 14.4282 3.35028L18.4282 5.5725C19.3401 6.07911 20.053 6.84684 20.4946 7.75275Z" />
      </svg>
    );
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2L4 22M4 3H20L17.3333 8L20 13H4V3Z" />
    </svg>
  );
}

function DiscoverIcon({ name }: { name: string }) {
  if (name === "file")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  if (name === "book")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    );
  if (name === "edit")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  if (name === "user")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      </svg>
    );
  if (name === "team")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 14C13.6569 14 15 12.6569 15 11C15 9.34315 13.6569 8 12 8C10.3431 8 9 9.34315 9 11C9 12.6569 10.3431 14 12 14ZM12 14C11.071 14 10.6065 14 10.2178 14.0616C8.07837 14.4004 6.40042 16.0784 6.06156 18.2178C6.03792 18.3671 6.02336 18.5275 6.01439 18.7212C7.60493 20.1386 9.70187 21 12 21M12 14C12.929 14 13.3935 14 13.7822 14.0616C15.9216 14.4004 17.5996 16.0784 17.9384 18.2178C17.9621 18.3671 17.9766 18.5275 17.9856 18.7212C16.3951 20.1386 14.2981 21 12 21M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" />
      </svg>
    );
  if (name === "clock")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    );
  if (name === "services")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3V6a3 3 0 00-3-3z" />
      </svg>
    );
  if (name === "support")
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" />
    </svg>
  );
}

const SHOP_CATEGORIES = [
  { href: "/shop?category=banners", icon: "largeformat", title: "Banners", desc: "Vinyl, mesh, fabric, step-repeat" },
  { href: "/shop?category=signage", icon: "signs", title: "Signs & Yard Signs", desc: "Coroplast, foam board, A-frame" },
  { href: "/shop?category=displays", icon: "wrap", title: "Displays & Stands", desc: "Retractable, tension fabric, pop-up" },
  { href: "/shop?category=print", icon: "cards", title: "Business Cards", desc: "Standard, ultra-thick, premium" },
  { href: "/shop?category=flags", icon: "flags", title: "Flags", desc: "Feather, teardrop, pole banners" },
  { href: "/shop?category=wall-art", icon: "merch", title: "Wall Art", desc: "Framed prints, canvas, photo prints" },
];

const DISCOVER_RESOURCES = [
  { href: "/templates", icon: "file", title: "Templates", desc: "Designed for quick edits" },
  { href: "/resources", icon: "book", title: "Resources", desc: "Prep guides & downloads" },
  { href: "/blog", icon: "edit", title: "Blog", desc: "Trends, tips, and stories" },
];
const DISCOVER_COMPANY = [
  { href: "/about", icon: "user", title: "About", desc: "Learn about our company" },
  { href: "/team", icon: "team", title: "Team", desc: "Meet our talented team" },
  { href: "/mission", icon: "clock", title: "Mission", desc: "Our values and vision" },
];
const DISCOVER_SUPPORT = [
  { href: "/contact", icon: "services", title: "Services", desc: "What we offer" },
  { href: "/faq", icon: "support", title: "Support", desc: "Help and guidance" },
  { href: "/contact", icon: "contact", title: "Contact", desc: "Talk with our team" },
];

export function SiteNav() {
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setCartCount(readCartCount());
    const interval = setInterval(() => setCartCount(readCartCount()), 500);
    const onStorage = () => setCartCount(readCartCount());
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchInput("");
    }
  }, [searchOpen]);

  function submitSearch(q: string) {
    const trimmed = q.trim();
    setSearchOpen(false);
    if (trimmed) router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    else router.push("/shop");
  }

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("cp-theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <>
      {/* Search overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => { e.preventDefault(); submitSearch(searchInput); }}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-700"
            >
              <Search className="h-5 w-5 shrink-0 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products..."
                className="flex-1 bg-transparent text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput("")} className="text-zinc-400 hover:text-zinc-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>
            <div className="px-4 py-3 flex items-center justify-between text-xs text-zinc-400">
              <span>Press <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-600">↵</kbd> to search</span>
              {searchInput.trim() && (
                <button
                  onClick={() => submitSearch(searchInput)}
                  className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Search for "{searchInput.trim()}"
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Announcement bar */}
      <div className="w-full bg-zinc-900 text-zinc-50 text-[12.5px] py-2 px-4 text-center">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="hidden sm:flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Made in Chandler, Arizona
          </span>
          <span className="hidden sm:inline opacity-30">·</span>
          <span className="flex items-center gap-1.5">
            <Truck className="h-3 w-3" />
            Free shipping on orders over $75
          </span>
          <span className="opacity-30">·</span>
          <a href="/resources" className="underline underline-offset-2 hover:text-white">Resources &amp; file prep guides</a>
        </div>
      </div>

      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">

            {/* Logo + Desktop Nav */}
            <div className="flex items-center gap-6 lg:gap-8 min-w-0">
              <Link href="/" className="flex items-center shrink-0">
                <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-8 w-auto dark:hidden" />
                <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-8 w-auto dark:block" />
              </Link>

              <nav className="hidden lg:flex items-center gap-1 text-[14px]">
                {/* Shop mega menu */}
                <div className="group/shop relative">
                  <button type="button" className="flex items-center gap-1 rounded-md px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    Shop <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute top-full left-0 z-50 mt-0 grid w-[560px] grid-cols-2 gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-xl opacity-0 pointer-events-none group-hover/shop:opacity-100 group-hover/shop:pointer-events-auto transition-all duration-150 -translate-y-1 group-hover/shop:translate-y-0">
                    {SHOP_CATEGORIES.map((item) => (
                      <Link key={item.title} href={item.href} className="flex items-start gap-3 p-3 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors">
                        <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
                          <ShopIcon name={item.icon} />
                        </div>
                        <div>
                          <div className="font-semibold text-[13.5px] text-zinc-900 dark:text-zinc-100">{item.title}</div>
                          <div className="text-[12px] text-zinc-500">{item.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Discover mega menu */}
                <div className="group/discover relative">
                  <button type="button" className="flex items-center gap-1 rounded-md px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    Discover <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute top-full left-0 z-50 mt-0 grid w-[635px] grid-cols-3 gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-xl opacity-0 pointer-events-none group-hover/discover:opacity-100 group-hover/discover:pointer-events-auto transition-all duration-150 -translate-y-1 group-hover/discover:translate-y-0">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-3 pt-2 pb-1">Resources</div>
                      {DISCOVER_RESOURCES.map((item) => (
                        <Link key={item.title} href={item.href} className="flex items-start gap-3 p-3 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors">
                          <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
                            <DiscoverIcon name={item.icon} />
                          </div>
                          <div>
                            <div className="font-semibold text-[13.5px] text-zinc-900 dark:text-zinc-100">{item.title}</div>
                            <div className="text-[12px] text-zinc-500 whitespace-nowrap">{item.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-3 pt-2 pb-1">Company</div>
                      {DISCOVER_COMPANY.map((item) => (
                        <Link key={item.title} href={item.href} className="flex items-start gap-3 p-3 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors">
                          <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
                            <DiscoverIcon name={item.icon} />
                          </div>
                          <div>
                            <div className="font-semibold text-[13.5px] text-zinc-900 dark:text-zinc-100">{item.title}</div>
                            <div className="text-[12px] text-zinc-500 whitespace-nowrap">{item.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-3 pt-2 pb-1">Support</div>
                      {DISCOVER_SUPPORT.map((item) => (
                        <Link key={item.title} href={item.href} className="flex items-start gap-3 p-3 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors">
                          <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
                            <DiscoverIcon name={item.icon} />
                          </div>
                          <div>
                            <div className="font-semibold text-[13.5px] text-zinc-900 dark:text-zinc-100">{item.title}</div>
                            <div className="text-[12px] text-zinc-500 whitespace-nowrap">{item.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <Link href="/shop" className="rounded-md px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Deals</Link>
                <Link href="/faq" className="rounded-md px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">FAQ</Link>
                <Link href="/contact" className="rounded-md px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Contact</Link>
              </nav>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button type="button" onClick={toggleDark} aria-label="Toggle color mode" className="rounded-md p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </button>

              <button type="button" onClick={() => setSearchOpen(true)} className="hidden md:flex items-center gap-2 text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 w-[220px] justify-start hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <Search className="h-3.5 w-3.5" />
                <span className="text-[13px]">Search products...</span>
                <kbd className="ml-auto text-[10.5px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-600">⌘K</kbd>
              </button>

              <Link href="/cart" aria-label="Cart" className="relative rounded-md p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-semibold flex items-center justify-center">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>

              <Link href="/login" className="hidden sm:inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-[14px] font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Sign in</Link>

              <Link href="/contact" className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-[14px] font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">Get a quote</Link>

              <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden rounded-md p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 -mr-1">
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4 space-y-1">
            <Link href="/shop" className="block rounded-md px-3 py-2 text-[14px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setMobileOpen(false)}>Shop</Link>
            <Link href="/shop" className="block rounded-md px-3 py-2 text-[14px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setMobileOpen(false)}>Deals</Link>
            <Link href="/faq" className="block rounded-md px-3 py-2 text-[14px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setMobileOpen(false)}>FAQ</Link>
            <Link href="/contact" className="block rounded-md px-3 py-2 text-[14px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setMobileOpen(false)}>Contact</Link>
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
              <Link href="/login" className="flex-1 text-center rounded-md border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-[14px] font-medium text-zinc-900 dark:text-zinc-100" onClick={() => setMobileOpen(false)}>Sign in</Link>
              <Link href="/contact" className="flex-1 text-center rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-[14px] font-medium" onClick={() => setMobileOpen(false)}>Get a quote</Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
