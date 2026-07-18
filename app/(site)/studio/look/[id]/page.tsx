import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadVisualization } from "@/lib/wall-studio/server";
import { WS_CATEGORY_LABEL } from "@/lib/wall-studio/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const look = await loadVisualization(id);
  if (!look) return { title: "Look not found — Ctrl+P Wall Studio" };
  const title = `${look.product?.name ?? "A wall look"} — Ctrl+P Wall Studio`;
  return {
    title,
    description: "A wall wrap / wallpaper preview created in Ctrl+P Wall Studio.",
    openGraph: { title, images: look.snapshot_url ? [look.snapshot_url] : undefined },
    twitter: { card: "summary_large_image", title, images: look.snapshot_url ? [look.snapshot_url] : undefined },
  };
}

export default async function LookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const look = await loadVisualization(id);
  if (!look) notFound();

  return (
    <main className="mx-auto max-w-[900px] px-6 py-12 lg:py-16">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Wall Studio · Saved look</p>
      <h1 className="text-[30px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {look.product?.name ?? "Your wall look"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {look.product ? `${WS_CATEGORY_LABEL[look.product.category]} · ` : ""}
        {look.wall_w_ft && look.wall_h_ft ? `${look.wall_w_ft}′ × ${look.wall_h_ft}′` : "Preview"}
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        {look.snapshot_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={look.snapshot_url} alt={look.product?.name ?? "Saved wall look"} className="h-auto w-full" />
        ) : (
          <div className="grid h-64 place-items-center text-sm text-zinc-500">Preview unavailable.</div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/studio"
          className="inline-flex items-center rounded-md bg-zinc-900 px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Try it on your wall
        </Link>
        {look.product && (
          <Link
            href="/studio#ws-designs"
            className="inline-flex items-center rounded-md border border-zinc-300 px-5 py-2.5 text-[15px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Browse designs
          </Link>
        )}
      </div>
    </main>
  );
}
