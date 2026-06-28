"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Calendar, CalendarCheck, ChevronRight,
  Gift, Layers, QrCode, Smartphone, Ticket, Trophy, Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProductConfig = {
  name: string;
  icon: React.ReactNode;
  tagline: string;
  description: string;
  features: string[];
  useCases: string[];
  color: string;
};

const PRODUCT_CONFIGS: Record<string, ProductConfig> = {
  "qr-pages": {
    name: "QR Code Landing Pages",
    icon: <QrCode className="h-8 w-8" />,
    tagline: "Scannable destinations for every surface",
    description: "Create standalone QR-linked pages for menus, flyers, signage, packaging, events, and anywhere you print a code. Update the destination any time without reprinting.",
    features: [
      "Custom branded landing page per QR code",
      "Real-time destination updates without reprinting",
      "Scan analytics — location, time, device type",
      "Password-protected or time-limited pages",
      "Connect to a digital business card or external URL",
      "Bulk QR generation for campaigns",
    ],
    useCases: ["Restaurant menus", "Event check-in", "Product packaging", "Real estate signs", "Print campaigns"],
    color: "text-blue-500",
  },
  "nfc-products": {
    name: "NFC Tap Products",
    icon: <Wifi className="h-8 w-8" />,
    tagline: "Physical products with programmable digital destinations",
    description: "Program NFC-enabled business cards, stickers, tags, and wristbands to redirect to any digital destination — a card, a page, a booking link, or a payment form. Update the destination without touching the physical product.",
    features: [
      "Tap-to-open digital card or custom URL",
      "NFC tap tracking and analytics",
      "Multiple redirect options per NFC product",
      "Compatible with all NFC-enabled phones",
      "Physical product order management",
      "Batch programming for teams",
    ],
    useCases: ["Business cards", "Name badges", "Packaging inserts", "Event wristbands", "Product tags"],
    color: "text-purple-500",
  },
  "lead-forms": {
    name: "Lead Capture Forms",
    icon: <BookOpen className="h-8 w-8" />,
    tagline: "Standalone forms with automated follow-up",
    description: "Build standalone lead capture pages with custom fields, file uploads, and conditional logic. Connect automations to send instant follow-ups, tag leads by source, and route submissions to your CRM.",
    features: [
      "Drag-and-drop form builder",
      "Custom fields, file uploads, conditional logic",
      "Instant email/SMS follow-up automations",
      "CRM tagging and routing",
      "Embeddable on any website",
      "Lead scoring and pipeline view",
    ],
    useCases: ["Contact forms", "Event registrations", "Quote requests", "Newsletter sign-ups", "Job applications"],
    color: "text-green-500",
  },
  "slideshow": {
    name: "Slideshow Cards",
    icon: <Layers className="h-8 w-8" />,
    tagline: "Multi-page animated digital presentations",
    description: "Create animated multi-page digital experiences — portfolios, product demos, sales decks, and pitch presentations — all shareable via a single link or QR code.",
    features: [
      "Multi-page swipeable card format",
      "Animated transitions and entrance effects",
      "Video, image, and text blocks per page",
      "Shareable link and QR code",
      "View and engagement analytics",
      "Password protection and expiry dates",
    ],
    useCases: ["Portfolio presentations", "Product demos", "Sales pitches", "Event programs", "Digital menus"],
    color: "text-yellow-500",
  },
  "scratch-coupons": {
    name: "Scratch / Reveal Coupons",
    icon: <Gift className="h-8 w-8" />,
    tagline: "Gamified digital promotions and prize reveals",
    description: "Create interactive digital scratch cards for promotions, prize giveaways, loyalty rewards, and gamified marketing campaigns. Control win rates, prize pools, and redemption rules.",
    features: [
      "Interactive scratch-to-reveal animation",
      "Configurable win rates and prize pools",
      "Unique code generation per card",
      "Redemption tracking and expiry",
      "Shareable via link, QR, or NFC",
      "Integration with loyalty program",
    ],
    useCases: ["Retail promotions", "Event giveaways", "Holiday campaigns", "Referral rewards", "VIP unlocks"],
    color: "text-orange-500",
  },
  "loyalty-cards": {
    name: "Loyalty / Punch Cards",
    icon: <Trophy className="h-8 w-8" />,
    tagline: "Digital loyalty programs with stamp tracking",
    description: "Replace paper punch cards with digital loyalty programs. Customers collect stamps via QR scan or NFC tap, and you control reward thresholds, expiry, and tier bonuses.",
    features: [
      "Digital stamp collection via QR or NFC",
      "Configurable reward thresholds and tiers",
      "Customer-facing balance and history",
      "Automated reward notifications",
      "Multi-location stamp validation",
      "Analytics on redemption and retention",
    ],
    useCases: ["Coffee shops", "Retail stores", "Salons", "Restaurants", "Fitness studios"],
    color: "text-amber-500",
  },
  "bundles": {
    name: "Product Bundles",
    icon: <Ticket className="h-8 w-8" />,
    tagline: "Package products with custom pricing and access",
    description: "Group digital and physical products into bundles with custom pricing, access controls, and subscription options. Perfect for starter kits, membership tiers, and partner packages.",
    features: [
      "Bundle digital + physical products together",
      "Custom bundle pricing and discounts",
      "Subscription and one-time purchase options",
      "Access management per bundle tier",
      "Gifting and transfer support",
      "Bundle performance analytics",
    ],
    useCases: ["Starter kits", "Membership tiers", "Partner packages", "Event passes", "Gift sets"],
    color: "text-cyan-500",
  },
};

export default function ProductComingSoonPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("controlp_customer_theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const config = PRODUCT_CONFIGS[type];

  if (!config) {
    return (
      <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground flex items-center justify-center")}>
        <div className="text-center">
          <p className="text-muted-foreground">Product type not found.</p>
          <Button className="mt-4" onClick={() => router.push("/dashboard/customer/manage-products")}>Back to My Products</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="flex h-12 items-center gap-3 px-5">
          <button
            type="button"
            onClick={() => router.push("/dashboard/customer/manage-products")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            My Products
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{config.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className={cn("mb-4 flex justify-center", config.color)}>
            {config.icon}
          </div>
          <Badge variant="secondary" className="mb-4 border border-dashed text-xs">Coming Soon</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{config.name}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{config.tagline}</p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{config.description}</p>
        </div>

        {/* Features + Use cases */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 text-sm font-semibold">What&apos;s included</div>
              <ul className="space-y-2">
                {config.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className={cn("mt-0.5 shrink-0 text-[10px] font-bold", config.color)}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 text-sm font-semibold">Perfect for</div>
              <div className="flex flex-wrap gap-2">
                {config.useCases.map((uc) => (
                  <span key={uc} className="rounded-full border bg-secondary/60 px-3 py-1 text-xs">{uc}</span>
                ))}
              </div>
              <div className="mt-6">
                <div className="mb-3 text-sm font-semibold">Get notified when it launches</div>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll send an update to your account email when {config.name} becomes available. No action needed — you&apos;re already on the list.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => router.push("/dashboard/customer/manage-products")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Products
          </Button>
        </div>
      </main>
    </div>
  );
}
