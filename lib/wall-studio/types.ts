// ─── Wall Studio domain types ───────────────────────────────────────────────

export type WsCategory = "wallpaper" | "wall_wrap" | "window_film";
export type WsBlendMode = "multiply" | "normal";

/** A catalog design (row of ws_products, or the client-side shape). */
export type WsProduct = {
  id: string;
  slug: string;
  name: string;
  category: WsCategory;
  price_per_sqft: number;
  install_rate_per_sqft: number;
  accent_hex: string;
  blend_mode: WsBlendMode;
  repeat_pattern: boolean;
  tile_url: string | null;
  tile_svg: string | null;
  active: boolean;
};

/** Human-facing category labels (used for chips + install-rate lookup by label). */
export const WS_CATEGORY_LABEL: Record<WsCategory, string> = {
  wallpaper: "Wallpaper",
  wall_wrap: "Wall wrap",
  window_film: "Window film",
};

/** A fractional point (0..1) within the visualizer stage. */
export type Corner = { x: number; y: number };

/** A freeform cutout — a polygon of fractional stage points. Never affects price. */
export type Cutout = { pts: Corner[] };

/** A line in the cart: a design sized to a wall. */
export type WsCartItem = {
  productId: string;
  w: number; // wall width, ft
  h: number; // wall height, ft
  sqft: number; // billed sqft = max(raw, min_sqft)
};

// ─── Pricing ─────────────────────────────────────────────────────────────────

export type InstallLocation = "int" | "ext";
export type SurfaceCondition = "good" | "textured" | "damaged";

/** User-selected job factors for the installation quote. */
export type InstallFactors = {
  location: InstallLocation;
  condition: SurfaceCondition;
  obstacles: number;
  miles: number;
  removal: boolean;
  cleaning: boolean;
  access: boolean;
  rush: boolean;
};

export type InstallLine = { label: string; amount: number };
export type InstallEstimate = { lines: InstallLine[]; total: number };

/**
 * All pricing constants — sourced from ws_pricing_rules so rates are editable
 * without a deploy. `DEFAULT_PRICING_RULES` (in pricing.ts) holds the v1 seed.
 */
export type PricingRules = {
  minSqft: number;
  installBaseRates: Record<WsCategory, number>;
  heightLadderThreshold: number;
  heightLadderPct: number;
  heightLiftThreshold: number;
  heightLiftPct: number;
  heightLiftFlat: number;
  exteriorPct: number;
  texturedPct: number;
  repairPct: number;
  repairFlat: number;
  removalPerSqft: number;
  cleaningPerSqft: number;
  obstacleEach: number;
  accessFlat: number;
  travelFreeMiles: number;
  travelPerMile: number;
  rushPct: number;
  rushWindowDays: number;
  serviceFloor: number;
};

/** Inputs to the installation computation (derived from the cart or visualizer). */
export type InstallInputs = {
  sqft: number;
  maxHeightFt: number;
  blendedBaseRate: number;
  factors: InstallFactors;
};
