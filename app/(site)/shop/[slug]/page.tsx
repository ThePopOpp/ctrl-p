import type { Metadata } from "next";

import { ProductDetailPage } from "@/components/shop/product-detail-page";
import { ProductCardPage } from "@/components/shop/product-card-page";
import { loadPublicCardBySlug, publicDb } from "@/lib/products/queries";
import type { PublicCard } from "@/lib/products/types";

// One URL space for both catalogs: a published Product Card wins, and anything
// else falls through to the legacy `products` detail page. Cards migrate onto
// this route as they are published, with no redirect and no broken links.
async function findCard(slug: string): Promise<PublicCard | null> {
  try {
    return await loadPublicCardBySlug(publicDb(), slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const card = await findCard(slug);
  if (!card) return {};

  const title = card.seoTitle || `${card.title} — ControlP.io`;
  const description =
    card.seoDescription || card.description?.slice(0, 155) || card.subtitle || `${card.title} from ControlP.io.`;

  return {
    title,
    description,
    alternates: { canonical: `/shop/${card.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: card.featuredImage ? [{ url: card.featuredImage.url, alt: card.featuredImage.alt }] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await findCard(slug);

  if (card) return <ProductCardPage card={card} />;
  return <ProductDetailPage slug={slug} />;
}
