import Link from "next/link";
import { Facebook, Instagram, Linkedin, Mail, Phone } from "lucide-react";

import { DownloadAppButton } from "@/components/pwa/download-app-button";

const SHOP_LINKS = ["All products", "Signs", "Banners", "Vehicle wraps", "Business cards", "Apparel & merch"];

const SERVICE_LINKS = [
  { label: "Graphic design", href: "/contact" },
  { label: "Installation", href: "/contact" },
  { label: "Web development", href: "/contact" },
  { label: "Video production", href: "/contact" },
  { label: "Templates", href: "/templates" },
];

const COMPANY_LINKS = [
  { label: "About us", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "FAQs", href: "/faq" },
  { label: "Contact", href: "/contact" },
  { label: "Support", href: "/resources" },
];

/** Shared marketing footer used across all public/frontend pages. */
export function SiteFooter() {
  return (
    <footer className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-800 pt-16 pb-8">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-8 pb-12 border-b border-zinc-200 dark:border-zinc-800">
          {/* Brand col */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center mb-4">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-8 w-auto dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-8 w-auto dark:block" />
            </Link>
            <p className="text-[13px] text-zinc-500 max-w-[340px] leading-relaxed mb-5">
              Arizona&apos;s premier print provider — prints, signs, wraps, and designs at wholesale prices with agency-grade design services.
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
            <DownloadAppButton
              label="Download the app"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            />
          </div>

          {/* Shop col */}
          <div>
            <h4 className="font-semibold text-[13px] mb-4">Shop</h4>
            <ul className="space-y-2.5 text-[13px] text-zinc-500">
              {SHOP_LINKS.map((l) => (
                <li key={l}><Link href="/shop" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>

          {/* Services col */}
          <div>
            <h4 className="font-semibold text-[13px] mb-4">Services</h4>
            <ul className="space-y-2.5 text-[13px] text-zinc-500">
              {SERVICE_LINKS.map((l) => (
                <li key={l.label}><Link href={l.href} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company col */}
          <div>
            <h4 className="font-semibold text-[13px] mb-4">Company</h4>
            <ul className="space-y-2.5 text-[13px] text-zinc-500">
              {COMPANY_LINKS.map((l) => (
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
  );
}
