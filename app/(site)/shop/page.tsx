import { Slot } from "@/components/placements/slot";
import { ProductCardGrid } from "@/components/shop/product-card-grid";
import { ShopPage } from "@/components/shop/shop-page";

export const metadata = {
  title: "Print Shop — ControlP.io",
  description: "Custom print products — banners, signs, business cards, apparel and more.",
};

// Slot and catalog contents come from the database, so this page cannot be
// frozen at build time — a newly published card would never appear.
export const revalidate = 60;

// The promoted band and the product-card grid both render nothing until staff
// place or publish something, so this page is unchanged for customers until the
// catalog is populated.
export default function Page() {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 pt-8 empty:hidden sm:px-6 lg:px-8">
        <Slot slotKey="shop_promoted" heading="Featured right now" />
        <ProductCardGrid
          heading="Catalog"
          description="Priced and ready to order."
          showCategoryNav
          limit={24}
        />
      </div>
      <ShopPage />
    </>
  );
}
