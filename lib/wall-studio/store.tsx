"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_CORNERS } from "@/lib/wall-studio/constants";
import { quadArea } from "@/lib/wall-studio/geometry";
import type { Corner, Cutout, InstallFactors, PricingRules, WsCategory, WsProduct } from "@/lib/wall-studio/types";

type CategoryFilter = WsCategory | "all";

const DEFAULT_FACTORS: InstallFactors = {
  location: "int",
  condition: "good",
  obstacles: 2,
  miles: 8,
  removal: false,
  cleaning: true,
  access: false,
  rush: false,
};

type WallStudioContextType = {
  products: WsProduct[];
  productsById: Record<string, WsProduct>;
  rules: PricingRules;

  cat: CategoryFilter;
  setCat: (c: CategoryFilter) => void;

  selected: WsProduct | null;
  selectProduct: (p: WsProduct) => void;

  // Visualizer drawer
  open: boolean;
  openVisualizer: (p?: WsProduct) => void;
  closeVisualizer: () => void;

  // Commerce dialogs / sheets
  sizeDialog: { product: WsProduct; fromViz: boolean } | null;
  openSizeDialog: (product: WsProduct, fromViz?: boolean) => void;
  closeSizeDialog: () => void;
  installOpen: boolean;
  setInstallOpen: (v: boolean) => void;
  bookingOpen: boolean;
  setBookingOpen: (v: boolean) => void;

  // Quad + calibration
  corners: Corner[];
  setCorner: (i: number, c: Corner) => void;
  resetCorners: () => void;
  dims: { w: number; h: number };
  setDims: (d: { w?: number; h?: number }) => void;
  calibArea: number | null;
  recalibrate: () => void;

  cutouts: Cutout[];
  setCutouts: (c: Cutout[]) => void;

  scale: number;
  setScale: (n: number) => void;
  opacity: number;
  setOpacity: (n: number) => void;

  factors: InstallFactors;
  setFactors: (f: Partial<InstallFactors>) => void;
};

const WallStudioContext = createContext<WallStudioContextType | null>(null);

export function WallStudioProvider({
  initialProducts,
  initialRules,
  children,
}: {
  initialProducts: WsProduct[];
  initialRules: PricingRules;
  children: React.ReactNode;
}) {
  const [cat, setCat] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<WsProduct | null>(initialProducts[0] ?? null);
  const [open, setOpen] = useState(false);
  const [sizeDialog, setSizeDialog] = useState<{ product: WsProduct; fromViz: boolean } | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  const [corners, setCornersState] = useState<Corner[]>(DEFAULT_CORNERS);
  const cornersRef = useRef(corners);
  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  const [dims, setDimsState] = useState({ w: 20, h: 10 });
  const [calibArea, setCalibArea] = useState<number | null>(null);
  const [cutouts, setCutouts] = useState<Cutout[]>([]);
  const [scale, setScale] = useState(220);
  const [opacity, setOpacity] = useState(0.92);
  const [factors, setFactorsState] = useState<InstallFactors>(DEFAULT_FACTORS);

  const productsById = useMemo(
    () => Object.fromEntries(initialProducts.map((p) => [p.id, p])),
    [initialProducts],
  );

  function selectProduct(p: WsProduct) {
    setSelected(p);
    setCutouts([]); // new design starts clean
  }

  function openVisualizer(p?: WsProduct) {
    if (p) selectProduct(p);
    setOpen(true);
  }
  function closeVisualizer() {
    setOpen(false);
  }

  function openSizeDialog(product: WsProduct, fromViz = false) {
    setSizeDialog({ product, fromViz });
  }
  function closeSizeDialog() {
    setSizeDialog(null);
  }

  function setCorner(i: number, c: Corner) {
    setCornersState((prev) => prev.map((p, idx) => (idx === i ? c : p)));
  }
  function recalibrate() {
    setCalibArea(quadArea(cornersRef.current));
  }
  function resetCorners() {
    setCornersState(DEFAULT_CORNERS);
    setCalibArea(quadArea(DEFAULT_CORNERS));
  }
  function setDims(d: { w?: number; h?: number }) {
    setDimsState((prev) => ({ w: d.w ?? prev.w, h: d.h ?? prev.h }));
    setCalibArea(quadArea(cornersRef.current));
  }

  function setFactors(f: Partial<InstallFactors>) {
    setFactorsState((prev) => ({ ...prev, ...f }));
  }

  const value: WallStudioContextType = {
    products: initialProducts,
    productsById,
    rules: initialRules,
    cat,
    setCat,
    selected,
    selectProduct,
    open,
    openVisualizer,
    closeVisualizer,
    sizeDialog,
    openSizeDialog,
    closeSizeDialog,
    installOpen,
    setInstallOpen,
    bookingOpen,
    setBookingOpen,
    corners,
    setCorner,
    resetCorners,
    dims,
    setDims,
    calibArea,
    recalibrate,
    cutouts,
    setCutouts,
    scale,
    setScale,
    opacity,
    setOpacity,
    factors,
    setFactors,
  };

  return <WallStudioContext.Provider value={value}>{children}</WallStudioContext.Provider>;
}

export function useWallStudio() {
  const ctx = useContext(WallStudioContext);
  if (!ctx) throw new Error("useWallStudio must be used inside <WallStudioProvider>");
  return ctx;
}
