// ─── ProductCardGrid ────────────────────────────────────────────────────────
//
// Server component. Reads through the PUBLIC client, so RLS and the
// column-level grants apply and cost is not merely omitted — it was never
// fetched. Renders nothing when the catalog has no published cards yet.

import Link from "next/link";

import { ProductCard } from "@/components/products/product-card";
import { loadPublicCards, loadPublicCategories, publicDb } from "@/lib/products/queries";

type Props = {
  categorySlug?: string;
  search?: string;
  limit?: number;
  heading?: string;
  description?: string;
  showCategoryNav?: boolean;
};

export async function ProductCardGrid({
  categorySlug,
  search,
  limit = 48,
  heading,
  description,
  showCategoryNav = false,
}: Props) {
  let cards: Awaited<ReturnType<typeof loadPublicCards>> = [];
  let categories: Awaited<ReturnType<typeof loadPublicCategories>> = [];

  try {
    const db = publicDb();
    [cards, categories] = await Promise.all([
      loadPublicCards(db, { categorySlug, search, limit }),
      showCategoryNav ? loadPublicCategories(db) : Promise.resolve([]),
    ]);
  } catch {
    return null;
  }

  if (!cards.length) return null;

  return (
    <section className="space-y-5">
      {heading ? (
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}

      {showCategoryNav && categories.length > 0 ? (
        <nav className="flex flex-wrap gap-2">
          <CategoryLink href="/shop" label="All" active={!categorySlug} />
          {categories.map((category) => (
            <CategoryLink
              key={category.id}
              href={`/shop/category/${category.slug}`}
              label={category.name}
              active={categorySlug === category.slug}
            />
          ))}
        </nav>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <ProductCard key={card.id} card={card} displayMode="tile" />
        ))}
      </div>
    </section>
  );
}

function CategoryLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          : "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
      }
    >
      {label}
    </Link>
  );
}
