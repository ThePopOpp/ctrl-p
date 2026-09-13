import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Slot } from "@/components/placements/slot";
import { ProductCardGrid } from "@/components/shop/product-card-grid";
import { loadPublicCategories, publicDb } from "@/lib/products/queries";

// Spec §13 lists this as `app/shop/[category]/page.tsx`, which cannot coexist
// with `app/shop/[slug]/page.tsx` — Next.js allows one dynamic segment per
// level. The static `category` segment keeps both routes, and the slug route
// stays the canonical product URL.

async function findCategory(slug: string) {
  try {
    const categories = await loadPublicCategories(publicDb());
    return categories.find((category) => category.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await findCategory(slug);
  if (!category) return {};

  return {
    title: `${category.name} — ControlP.io`,
    description: `${category.name} from ControlP.io — priced and ready to order.`,
    alternates: { canonical: `/shop/category/${category.slug}` },
  };
}

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = await findCategory(slug);
  if (!category) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <Slot slotKey="category_spotlight" contextId={category.id} heading={`Featured in ${category.name}`} />
      <ProductCardGrid categorySlug={category.slug} heading={category.name} showCategoryNav limit={48} />
    </div>
  );
}
