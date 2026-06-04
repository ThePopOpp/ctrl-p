"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Image,
  Moon,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { LogOut } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData, saveAdminProduct } from "@/lib/admin/admin-api";
import type { ProductPayload } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, Product } from "@/lib/admin/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function jsonCount(value: unknown) {
  return Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : 0;
}

function jsonText(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === "") return fallback;
  return JSON.stringify(value, null, 2);
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminProducts() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [wooSyncing, setWooSyncing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }

      setAuthState("allowed");
      setData(await loadAdminDashboardData());
    }

    boot();
  }, []);

  const products = data?.products ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const orders = data?.orders ?? [];
  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) => [
      product.name,
      product.sku,
      product.slug,
      product.category,
      product.product_type,
      product.status,
    ].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [products, query]);

  const customizerCount = products.filter((product) => product.customizer_enabled).length;
  const categoryCount = new Set(products.map((product) => product.category).filter(Boolean)).size;

  async function refreshProducts() {
    setData(await loadAdminDashboardData());
  }

  async function importWooProducts() {
    setWooSyncing(true);
    setNotice("");
    try {
      const db = getSupabaseBrowserClient();
      const session = db ? (await db.auth.getSession()).data.session : null;
      const token = session?.access_token;
      if (!token) throw new Error("Sign in again before importing WooCommerce products.");

      const response = await fetch("/api/admin/products/woocommerce", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "WooCommerce import failed.");
      setNotice(`WooCommerce import complete: ${payload.imported || 0} imported, ${payload.updated || 0} updated.`);
      await refreshProducts();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "WooCommerce import failed.");
    } finally {
      setWooSyncing(false);
    }
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-5 px-2 pt-[5px]">
            <a href="/admin">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
            </a>
          </div>

          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link
                      href={href}
                      key={label}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="absolute bottom-3 left-3 right-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JW</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">Jeremy Waters</div>
                <div className="truncate text-[10px] text-muted-foreground">Owner - Super Admin</div>
              </div>
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>Super Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Products</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search products, SKUs, categories..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30">
              <CardContent className="p-5">
                <div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div>
                <p className="mt-2 text-sm text-muted-foreground">Sign in with an active staff or admin account before opening products.</p>
                <Button className="mt-4" asChild><a href="/login?redirect=/admin/products">Go to login</a></Button>
              </CardContent>
            </Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Products</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    Catalog, pricing, product designer settings, production requirements, storefront details, variants, options, and proofing rules.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add product</Button>
                  <Button variant="outline"><SlidersHorizontal className="h-4 w-4" /> Import CSV</Button>
                  <Button variant="outline" onClick={importWooProducts} disabled={wooSyncing}>
                    <SlidersHorizontal className="h-4 w-4" /> {wooSyncing ? "Syncing..." : "Woo sync"}
                  </Button>
                </div>
              </div>

              {notice && (
                <div className="mb-4 rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                  {notice}
                </div>
              )}

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <ProductStat label="Products" value={String(products.length)} hint="Catalog records" />
                <ProductStat label="Designer ready" value={String(customizerCount)} hint="Customizer enabled" />
                <ProductStat label="Categories" value={String(categoryCount)} hint="Catalog groupings" />
                <ProductStat label="Featured" value={String(products.filter((product) => product.featured).length)} hint="Storefront priority" />
                <ProductStat label="Woo sync" value={String(products.filter((product) => product.woo_sync_enabled).length)} hint="Connected products" />
              </section>

              <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Product catalog</CardTitle>
                    <CardDescription>Click a product to inspect designer, pricing, and production fields</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Designer</TableHead>
                          <TableHead>Options</TableHead>
                          <TableHead className="text-right">Base</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleProducts.map((product) => (
                          <TableRow key={product.id} className="cursor-pointer" onClick={() => setSelectedProduct(product)}>
                            <TableCell className="pl-4">
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-muted-foreground">{product.sku} - {product.category}</div>
                            </TableCell>
                            <TableCell>{human(product.product_type || product.category)}</TableCell>
                            <TableCell><Badge className="bg-secondary text-secondary-foreground">{human(product.stock_status || "in_stock")}</Badge></TableCell>
                            <TableCell><Badge className={product.customizer_enabled ? "bg-primary/15 text-foreground" : "bg-secondary text-secondary-foreground"}>{product.customizer_enabled ? "Enabled" : "Off"}</Badge></TableCell>
                            <TableCell>{jsonCount(product.sizes) + jsonCount(product.materials) + jsonCount(product.print_options) + jsonCount(product.finishing_options)}</TableCell>
                            <TableCell className="text-right font-semibold">{money.format(numberValue(product.base_price || product.base_cost))}</TableCell>
                          </TableRow>
                        ))}
                        {!visibleProducts.length && (
                          <TableRow><TableCell className="p-6 text-center text-muted-foreground" colSpan={6}>No products found.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Designer readiness</CardTitle>
                    <CardDescription>Fields every customizable product should define</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {["Sizes or dimensions", "Materials", "Print sides/options", "Finishing choices", "Quantity tiers", "Turnaround times", "File requirements", "Template surfaces"].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-lg border bg-background/35 px-3 py-2 text-sm">
                        <Palette className="h-4 w-4 text-primary" />
                        {item}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <WorkflowCard icon={<Palette />} title="Online designer" items={["Customizer enabled", "Design surfaces", "Bleed and safe area", "Template JSON", "Allowed uploads"]} />
                <WorkflowCard icon={<SlidersHorizontal />} title="Product options" items={["Sizes", "Materials", "Print options", "Finishing", "Quantity tiers"]} />
                <WorkflowCard icon={<Image />} title="Storefront" items={["Gallery", "Featured product", "SEO title", "Related products", "Shipping choices"]} />
              </section>
            </>
          )}
        </main>

        <ProductSheet
          product={selectedProduct}
          open={Boolean(selectedProduct)}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
          onSaved={refreshProducts}
          mode="edit"
        />
        <ProductSheet product={null} open={addOpen} onOpenChange={setAddOpen} onSaved={refreshProducts} mode="add" />
      </div>
    </div>
  );
}

function ProductStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-[22px] font-semibold leading-none">{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function WorkflowCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => <div key={item} className="rounded-lg border bg-background/35 px-3 py-2 text-sm">{item}</div>)}
      </CardContent>
    </Card>
  );
}

function ProductSheet({
  product,
  open,
  onOpenChange,
  onSaved,
  mode,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  mode: "edit" | "add";
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [tagline, setTagline] = useState("");
  const [productType, setProductType] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [baseCost, setBaseCost] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [vendor, setVendor] = useState("in_house");
  const [status, setStatus] = useState("active");
  const [stockStatus, setStockStatus] = useState("in_stock");
  const [customizer, setCustomizer] = useState("enabled");
  const [featured, setFeatured] = useState("false");
  const [taxStatus, setTaxStatus] = useState("taxable");
  const [taxClass, setTaxClass] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [dimensionLengthIn, setDimensionLengthIn] = useState("");
  const [dimensionWidthIn, setDimensionWidthIn] = useState("");
  const [dimensionHeightIn, setDimensionHeightIn] = useState("");
  const [shippingClass, setShippingClass] = useState("");
  const [wooProductId, setWooProductId] = useState("");
  const [wooPermalink, setWooPermalink] = useState("");
  const [wooSyncEnabled, setWooSyncEnabled] = useState("false");
  const [wooSyncStatus, setWooSyncStatus] = useState("not_synced");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [alternateSkus, setAlternateSkus] = useState("[]");
  const [tags, setTags] = useState("[]");
  const [brands, setBrands] = useState("[]");
  const [accessories, setAccessories] = useState("[]");
  const [specifications, setSpecifications] = useState("{}");
  const [photoGallery, setPhotoGallery] = useState("[]");
  const [faqs, setFaqs] = useState("[]");
  const [tips, setTips] = useState("[]");
  const [attributes, setAttributes] = useState("[]");
  const [similarProducts, setSimilarProducts] = useState("[]");
  const [linkedProducts, setLinkedProducts] = useState("[]");
  const [templateFiles, setTemplateFiles] = useState("[]");
  const [importSources, setImportSources] = useState("[]");
  const [gallery, setGallery] = useState("[]");
  const [sizes, setSizes] = useState("[]");
  const [materials, setMaterials] = useState("[]");
  const [printOptions, setPrintOptions] = useState("[]");
  const [finishingOptions, setFinishingOptions] = useState("[]");
  const [quantityTiers, setQuantityTiers] = useState("[]");
  const [turnaroundTimes, setTurnaroundTimes] = useState("[]");
  const [shippingOptions, setShippingOptions] = useState("[]");
  const [fileRequirements, setFileRequirements] = useState("{}");
  const [priceRules, setPriceRules] = useState("[]");
  const [designerTemplate, setDesignerTemplate] = useState("{}");
  const [designerSurfaces, setDesignerSurfaces] = useState("[]");
  const [designerConstraints, setDesignerConstraints] = useState("{}");
  const [personalizationSchema, setPersonalizationSchema] = useState("[]");
  const [proofingSettings, setProofingSettings] = useState("{}");
  const [productionRequirements, setProductionRequirements] = useState("{}");
  const [productAssets, setProductAssets] = useState("[]");
  const [meta, setMeta] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(product?.name || "");
    setSku(product?.sku || "");
    setSlug(product?.slug || "");
    setCategory(product?.category || "");
    setTagline(product?.tagline || "");
    setProductType(product?.product_type || "");
    setBasePrice(product?.base_price ? String(product.base_price) : "");
    setBaseCost(product?.base_cost ? String(product.base_cost) : "");
    setSalePrice(product?.sale_price ? String(product.sale_price) : "");
    setVendor(product?.vendor || "in_house");
    setStatus(product?.status || "active");
    setStockStatus(product?.stock_status || "in_stock");
    setCustomizer(product?.customizer_enabled === false ? "disabled" : "enabled");
    setFeatured(product?.featured ? "true" : "false");
    setTaxStatus(product?.tax_status || "taxable");
    setTaxClass(product?.tax_class || "");
    setCouponCode(product?.coupon_code || "");
    setVideoUrl(product?.video_url || "");
    setWeightLbs(product?.weight_lbs ? String(product.weight_lbs) : "");
    setDimensionLengthIn(product?.dimension_length_in ? String(product.dimension_length_in) : "");
    setDimensionWidthIn(product?.dimension_width_in ? String(product.dimension_width_in) : "");
    setDimensionHeightIn(product?.dimension_height_in ? String(product.dimension_height_in) : "");
    setShippingClass(product?.shipping_class || "");
    setWooProductId(product?.woo_product_id || "");
    setWooPermalink(product?.woo_permalink || "");
    setWooSyncEnabled(product?.woo_sync_enabled ? "true" : "false");
    setWooSyncStatus(product?.woo_sync_status || "not_synced");
    setDescription(product?.description || "");
    setShortDescription(product?.short_description || "");
    setAlternateSkus(jsonText(product?.alternate_skus, "[]"));
    setTags(jsonText(product?.tags, "[]"));
    setBrands(jsonText(product?.brands, "[]"));
    setAccessories(jsonText(product?.accessories, "[]"));
    setSpecifications(jsonText(product?.specifications, "{}"));
    setPhotoGallery(jsonText(product?.photo_gallery, "[]"));
    setFaqs(jsonText(product?.faqs, "[]"));
    setTips(jsonText(product?.tips, "[]"));
    setAttributes(jsonText(product?.attributes, "[]"));
    setSimilarProducts(jsonText(product?.similar_products, "[]"));
    setLinkedProducts(jsonText(product?.linked_products, "[]"));
    setTemplateFiles(jsonText(product?.template_files, '[\n  { "label": "Print template", "format": "pdf", "url": "" },\n  { "label": "Vector template", "format": "svg", "url": "" }\n]'));
    setImportSources(jsonText(product?.import_sources, "[]"));
    setGallery(jsonText(product?.gallery, "[]"));
    setSizes(jsonText(product?.sizes, '[\n  { "label": "3x6 ft", "width": 36, "height": 72, "unit": "in" }\n]'));
    setMaterials(jsonText(product?.materials, '[\n  { "label": "13oz Vinyl", "key": "13oz-vinyl" }\n]'));
    setPrintOptions(jsonText(product?.print_options, '[\n  { "label": "Full color", "key": "full-color" }\n]'));
    setFinishingOptions(jsonText(product?.finishing_options, '[\n  { "label": "Grommets", "key": "grommets" }\n]'));
    setQuantityTiers(jsonText(product?.quantity_tiers, '[\n  { "quantity": 1, "price": 96 }\n]'));
    setTurnaroundTimes(jsonText(product?.turnaround_times, '[\n  { "label": "Standard", "days": 3 }\n]'));
    setShippingOptions(jsonText(product?.shipping_options, '[\n  { "label": "Pickup", "key": "pickup" }\n]'));
    setFileRequirements(jsonText(product?.file_upload_requirements, '{\n  "min_dpi": 300,\n  "formats": ["pdf", "ai", "eps", "png", "jpg"],\n  "color_mode": "cmyk"\n}'));
    setPriceRules(jsonText(product?.price_rules, "[]"));
    setDesignerTemplate(jsonText(product?.designer_template, "{}"));
    setDesignerSurfaces(jsonText(product?.designer_surfaces || product?.meta, '[\n  { "key": "front", "label": "Front", "width": 36, "height": 72, "unit": "in" }\n]'));
    setDesignerConstraints(jsonText(product?.designer_constraints, '{\n  "bleed": 0.125,\n  "safe_area": 0.125,\n  "min_dpi": 300\n}'));
    setPersonalizationSchema(jsonText(product?.personalization_schema, "[]"));
    setProofingSettings(jsonText(product?.proofing_settings, '{\n  "proof_required": true,\n  "allow_auto_proof": false\n}'));
    setProductionRequirements(jsonText(product?.production_requirements, "{}"));
    setProductAssets(jsonText(product?.product_assets, "[]"));
    setMeta(jsonText(product?.meta, "{}"));
    setMessage("");
  }, [open, product]);

  function parseJson(label: string, value: string) {
    try {
      return JSON.parse(value || "null");
    } catch {
      throw new Error(`${label} must be valid JSON.`);
    }
  }

  async function saveProduct() {
    setSaving(true);
    setMessage("");
    try {
      if (!name.trim()) throw new Error("Product name is required.");
      if (!sku.trim()) throw new Error("SKU is required.");
      if (!slug.trim()) throw new Error("Slug is required.");
      if (!category.trim()) throw new Error("Category is required.");

      const payload: ProductPayload = {
        id: product?.id,
        sku,
        slug,
        name,
        category,
        tagline,
        description,
        short_description: shortDescription,
        product_type: productType,
        base_cost: Number(baseCost || 0),
        base_price: Number(basePrice || 0),
        sale_price: Number(salePrice || 0),
        vendor,
        active: status !== "archived",
        status,
        stock_status: stockStatus,
        featured: featured === "true",
        customizer_enabled: customizer === "enabled",
        alternate_skus: parseJson("Alternate SKUs", alternateSkus),
        tags: parseJson("Tags", tags),
        brands: parseJson("Brands", brands),
        tax_status: taxStatus,
        tax_class: taxClass,
        coupon_code: couponCode,
        accessories: parseJson("Accessories", accessories),
        specifications: parseJson("Specifications", specifications),
        video_url: videoUrl,
        photo_gallery: parseJson("Photo gallery", photoGallery),
        faqs: parseJson("FAQ", faqs),
        tips: parseJson("Tips", tips),
        attributes: parseJson("Attributes", attributes),
        similar_products: parseJson("Similar products", similarProducts),
        linked_products: parseJson("Linked products", linkedProducts),
        weight_lbs: Number(weightLbs || 0),
        dimension_length_in: Number(dimensionLengthIn || 0),
        dimension_width_in: Number(dimensionWidthIn || 0),
        dimension_height_in: Number(dimensionHeightIn || 0),
        shipping_class: shippingClass,
        template_files: parseJson("Template files", templateFiles),
        import_sources: parseJson("Import sources", importSources),
        woo_product_id: wooProductId,
        woo_permalink: wooPermalink,
        woo_sync_enabled: wooSyncEnabled === "true",
        woo_sync_status: wooSyncStatus,
        gallery: parseJson("Gallery", gallery),
        sizes: parseJson("Sizes / dimensions", sizes),
        materials: parseJson("Materials", materials),
        print_options: parseJson("Print options", printOptions),
        finishing_options: parseJson("Finishing options", finishingOptions),
        quantity_tiers: parseJson("Quantity tiers", quantityTiers),
        turnaround_times: parseJson("Turnaround times", turnaroundTimes),
        shipping_options: parseJson("Shipping options", shippingOptions),
        file_upload_requirements: parseJson("File upload requirements", fileRequirements),
        price_rules: parseJson("Price rules", priceRules),
        designer_template: parseJson("Designer template", designerTemplate),
        designer_surfaces: parseJson("Designer surfaces", designerSurfaces),
        designer_constraints: parseJson("Designer constraints", designerConstraints),
        personalization_schema: parseJson("Personalization schema", personalizationSchema),
        proofing_settings: parseJson("Proofing settings", proofingSettings),
        production_requirements: parseJson("Production requirements", productionRequirements),
        product_assets: parseJson("Product assets", productAssets),
        meta: parseJson("Meta", meta),
      };

      await saveAdminProduct(payload);
      setMessage("Product saved.");
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>{mode === "add" ? "Add product" : product?.name || "Product"}</SheetTitle>
          <SheetDescription>{mode === "add" ? "Define the fields needed for storefront, production, and the online product designer." : `${product?.sku || "SKU"} - ${product?.category || "Catalog"}`}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={name} onChange={setName} placeholder="Vinyl Banner" />
            <Field label="SKU" value={sku} onChange={setSku} placeholder="bn" />
            <Field label="Slug" value={slug} onChange={setSlug} placeholder="vinyl-banner" />
            <Field label="Category" value={category} onChange={setCategory} placeholder="Signs and Banners" />
            <Field label="Tagline" value={tagline} onChange={setTagline} placeholder="Fast custom signs built online" />
            <Field label="Product type" value={productType} onChange={setProductType} placeholder="banner, card, sign, apparel" />
            <Field label="Base price" value={basePrice} onChange={setBasePrice} placeholder="99.00" />
            <Field label="Sale price" value={salePrice} onChange={setSalePrice} placeholder="79.00" />
            <Field label="Base cost" value={baseCost} onChange={setBaseCost} placeholder="48.00" />
            <Field label="Vendor" value={vendor} onChange={setVendor} placeholder="in_house" />
            <Field label="Coupon code" value={couponCode} onChange={setCouponCode} placeholder="BANNER10" />
            <Field label="Video URL" value={videoUrl} onChange={setVideoUrl} placeholder="https://..." />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  {["draft", "active", "archived"].map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Stock status</div>
              <Select value={stockStatus} onValueChange={setStockStatus}>
                <SelectTrigger><SelectValue placeholder="Stock" /></SelectTrigger>
                <SelectContent>
                  {["in_stock", "out_of_stock", "backorder", "made_to_order", "discontinued"].map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Online designer</div>
              <Select value={customizer} onValueChange={setCustomizer}>
                <SelectTrigger><SelectValue placeholder="Designer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Featured</div>
              <Select value={featured} onValueChange={setFeatured}>
                <SelectTrigger><SelectValue placeholder="Featured" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Featured</SelectItem>
                  <SelectItem value="false">Not featured</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Tax status</div>
              <Select value={taxStatus} onValueChange={setTaxStatus}>
                <SelectTrigger><SelectValue placeholder="Tax" /></SelectTrigger>
                <SelectContent>
                  {["taxable", "shipping", "none"].map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Field label="Tax class" value={taxClass} onChange={setTaxClass} placeholder="standard, reduced-rate" />
            <Field label="Shipping class" value={shippingClass} onChange={setShippingClass} placeholder="oversized, flat-rate" />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Weight (lbs)" value={weightLbs} onChange={setWeightLbs} placeholder="2.5" />
            <Field label="Length (in)" value={dimensionLengthIn} onChange={setDimensionLengthIn} placeholder="24" />
            <Field label="Width (in)" value={dimensionWidthIn} onChange={setDimensionWidthIn} placeholder="18" />
            <Field label="Height (in)" value={dimensionHeightIn} onChange={setDimensionHeightIn} placeholder="2" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Woo product ID" value={wooProductId} onChange={setWooProductId} placeholder="1234" />
            <Field label="Woo permalink" value={wooPermalink} onChange={setWooPermalink} placeholder="https://www.controlp.io/product/..." />
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Woo sync</div>
              <Select value={wooSyncEnabled} onValueChange={setWooSyncEnabled}>
                <SelectTrigger><SelectValue placeholder="Woo sync" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Woo sync status</div>
              <Select value={wooSyncStatus} onValueChange={setWooSyncStatus}>
                <SelectTrigger><SelectValue placeholder="Woo status" /></SelectTrigger>
                <SelectContent>
                  {["not_synced", "imported", "pulled", "pushed", "synced", "failed"].map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Short description</div>
            <Textarea value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} placeholder="Customer-facing summary." />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Description</div>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Longer storefront description." />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <JsonField label="Alternate SKUs" value={alternateSkus} onChange={setAlternateSkus} />
            <JsonField label="Tags" value={tags} onChange={setTags} />
            <JsonField label="Brands" value={brands} onChange={setBrands} />
            <JsonField label="Accessories" value={accessories} onChange={setAccessories} />
            <JsonField label="Specifications" value={specifications} onChange={setSpecifications} />
            <JsonField label="Photo gallery" value={photoGallery} onChange={setPhotoGallery} />
            <JsonField label="FAQ" value={faqs} onChange={setFaqs} />
            <JsonField label="Tips" value={tips} onChange={setTips} />
            <JsonField label="Attributes" value={attributes} onChange={setAttributes} />
            <JsonField label="Similar products" value={similarProducts} onChange={setSimilarProducts} />
            <JsonField label="Linked products" value={linkedProducts} onChange={setLinkedProducts} />
            <JsonField label="Template files (PDF, PNG, SVG, EPS)" value={templateFiles} onChange={setTemplateFiles} />
            <JsonField label="Import sources / CSV / WooCommerce" value={importSources} onChange={setImportSources} />
            <JsonField label="Sizes / dimensions" value={sizes} onChange={setSizes} />
            <JsonField label="Materials" value={materials} onChange={setMaterials} />
            <JsonField label="Print options" value={printOptions} onChange={setPrintOptions} />
            <JsonField label="Finishing options" value={finishingOptions} onChange={setFinishingOptions} />
            <JsonField label="Quantity tiers" value={quantityTiers} onChange={setQuantityTiers} />
            <JsonField label="Turnaround times" value={turnaroundTimes} onChange={setTurnaroundTimes} />
            <JsonField label="Shipping options" value={shippingOptions} onChange={setShippingOptions} />
            <JsonField label="File upload requirements" value={fileRequirements} onChange={setFileRequirements} />
            <JsonField label="Price rules" value={priceRules} onChange={setPriceRules} />
            <JsonField label="Designer template" value={designerTemplate} onChange={setDesignerTemplate} />
            <JsonField label="Designer surfaces" value={designerSurfaces} onChange={setDesignerSurfaces} />
            <JsonField label="Designer constraints" value={designerConstraints} onChange={setDesignerConstraints} />
            <JsonField label="Personalization schema" value={personalizationSchema} onChange={setPersonalizationSchema} />
            <JsonField label="Proofing settings" value={proofingSettings} onChange={setProofingSettings} />
            <JsonField label="Production requirements" value={productionRequirements} onChange={setProductionRequirements} />
            <JsonField label="Product assets" value={productAssets} onChange={setProductAssets} />
            <JsonField label="Gallery" value={gallery} onChange={setGallery} />
            <JsonField label="Meta" value={meta} onChange={setMeta} />
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving} onClick={saveProduct}>{saving ? "Saving..." : "Save product"}</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function JsonField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <Textarea className="min-h-[150px] font-mono text-xs" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
