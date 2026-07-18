"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { PricingRules, WsCartItem, WsCategory, WsProduct } from "@/lib/wall-studio/types";

type CategoryFilter = WsCategory | "all";

type WallStudioContextType = {
  products: WsProduct[];
  productsById: Record<string, WsProduct>;
  rules: PricingRules;

  cat: CategoryFilter;
  setCat: (c: CategoryFilter) => void;

  selected: WsProduct | null;
  selectProduct: (p: WsProduct) => void;

  cart: WsCartItem[];
  addCartItem: (item: WsCartItem) => number; // returns the new item's index
  removeCartItem: (index: number) => void;
  clearCart: () => void;
};

const WallStudioContext = createContext<WallStudioContextType | null>(null);

const CART_KEY = "wallstudio:cart";

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
  const [cart, setCart] = useState<WsCartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const productsById = useMemo(
    () => Object.fromEntries(initialProducts.map((p) => [p.id, p])),
    [initialProducts],
  );

  // Load persisted cart (client only).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (stored) setCart(JSON.parse(stored));
    } catch {
      /* ignore parse errors */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* ignore storage errors */
    }
  }, [cart, loaded]);

  function selectProduct(p: WsProduct) {
    setSelected(p);
  }

  function addCartItem(item: WsCartItem): number {
    let index = -1;
    setCart((prev) => {
      index = prev.length;
      return [...prev, item];
    });
    return index;
  }

  function removeCartItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function clearCart() {
    setCart([]);
  }

  const value: WallStudioContextType = {
    products: initialProducts,
    productsById,
    rules: initialRules,
    cat,
    setCat,
    selected,
    selectProduct,
    cart,
    addCartItem,
    removeCartItem,
    clearCart,
  };

  return <WallStudioContext.Provider value={value}>{children}</WallStudioContext.Provider>;
}

export function useWallStudio() {
  const ctx = useContext(WallStudioContext);
  if (!ctx) throw new Error("useWallStudio must be used inside <WallStudioProvider>");
  return ctx;
}
