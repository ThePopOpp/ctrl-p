"use client";

import { cn } from "@/lib/utils";
import { BookingDialog } from "@/components/wall-studio/BookingDialog";
import { DesignCard } from "@/components/wall-studio/DesignCard";
import { DesignSlider } from "@/components/wall-studio/DesignSlider";
import { InstallQuoteSheet } from "@/components/wall-studio/InstallQuoteSheet";
import { SizeDialog } from "@/components/wall-studio/SizeDialog";
import { VisualizerDrawer } from "@/components/wall-studio/VisualizerDrawer";
import { useWallStudio } from "@/lib/wall-studio/store";
import type { WsCategory } from "@/lib/wall-studio/types";

const CATS: Array<{ value: WsCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "wallpaper", label: "Wallpaper" },
  { value: "wall_wrap", label: "Wall wrap" },
  { value: "window_film", label: "Window film" },
];

export function StudioApp() {
  const { products, selected, openVisualizer, openSizeDialog, setInstallOpen, setBookingOpen, cat, setCat } =
    useWallStudio();
  const accent = selected?.accent_hex ?? "#2f6b4f";
  const list = products.filter((p) => cat === "all" || p.category === cat);

  return (
    <div style={{ "--ws-accent": accent } as React.CSSProperties} className="bg-white dark:bg-zinc-950">
      {/* Hero */}
      <section className="mx-auto max-w-[1280px] px-6 pb-8 pt-14 lg:pt-20">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Wall Studio</p>
        <h1 className="max-w-[18ch] text-[40px] font-bold leading-[1.05] tracking-tight text-zinc-900 dark:text-zinc-50 lg:text-[52px]">
          See it on{" "}
          <span style={{ color: "var(--ws-accent)" }}>your wall</span> before it ships.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Wall wraps, wallpaper, and window film for homes and businesses. Point your camera at a wall or upload a
          photo, drop a design on it in real perspective, then order and book installation — all in one place.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openVisualizer()}
            className="inline-flex items-center rounded-md bg-zinc-900 px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Try the visualizer
          </button>
          <a
            href="#ws-designs"
            className="inline-flex items-center rounded-md border border-zinc-300 px-5 py-2.5 text-[15px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Browse designs
          </a>
          <button
            type="button"
            onClick={() => setInstallOpen(true)}
            className="inline-flex items-center rounded-md border border-zinc-300 px-5 py-2.5 text-[15px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Installation quote
          </button>
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className="inline-flex items-center rounded-md border border-zinc-300 px-5 py-2.5 text-[15px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Book installation
          </button>
        </div>
      </section>

      {/* Catalog */}
      <section id="ws-designs" className="mx-auto max-w-[1280px] px-6 pb-20">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-[26px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Designs</h2>
          <span className="text-[13px] text-zinc-500">Priced per square foot · 25 sq ft minimum per panel</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {CATS.map((c) => {
            const active = cat === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCat(c.value)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-transparent text-white"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
                style={active ? { backgroundColor: "var(--ws-accent)" } : undefined}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No designs available yet.
          </div>
        ) : (
          <DesignSlider>
            {list.map((p) => (
              <DesignCard
                key={p.id}
                product={p}
                selected={selected?.id === p.id}
                onPreview={() => openVisualizer(p)}
                onAdd={() => openSizeDialog(p)}
              />
            ))}
          </DesignSlider>
        )}
      </section>

      <VisualizerDrawer />
      <SizeDialog />
      <InstallQuoteSheet />
      <BookingDialog />
    </div>
  );
}
