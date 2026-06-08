import { ProductDetailPage } from "@/components/shop/product-detail-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetailPage slug={slug} />;
}
