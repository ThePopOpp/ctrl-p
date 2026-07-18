import type { Metadata } from "next";

import { StudioApp } from "@/components/wall-studio/StudioApp";
import { CartProvider } from "@/lib/cart/cart-context";
import { loadStudioCatalog } from "@/lib/wall-studio/server";
import { WallStudioProvider } from "@/lib/wall-studio/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wall Studio — Ctrl+P",
  description:
    "Preview wall wraps, wallpaper, and window film on your own wall in real perspective, price it live, and book installation.",
};

export default async function StudioPage() {
  const { products, rules } = await loadStudioCatalog();
  return (
    <CartProvider>
      <WallStudioProvider initialProducts={products} initialRules={rules}>
        <StudioApp />
      </WallStudioProvider>
    </CartProvider>
  );
}
