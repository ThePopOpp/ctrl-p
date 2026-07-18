"use client";

import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { estimatedDims, quadArea } from "@/lib/wall-studio/geometry";
import { billedSqft, money, rawSqft } from "@/lib/wall-studio/pricing";
import { useWallStudio } from "@/lib/wall-studio/store";
import { tileDataUri } from "@/lib/wall-studio/tiles";

export function SizeDialog() {
  const { sizeDialog, closeSizeDialog, corners, calibArea, dims, rules } = useWallStudio();
  const { addItem } = useCart();
  const [w, setW] = useState(10);
  const [h, setH] = useState(8);

  const product = sizeDialog?.product ?? null;

  // Prefill from the visualizer's estimated wall size when opened from there.
  useEffect(() => {
    if (!sizeDialog) return;
    if (sizeDialog.fromViz) {
      const d = estimatedDims(quadArea(corners), calibArea, dims);
      setW(d.w);
      setH(d.h);
    } else {
      setW(10);
      setH(8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeDialog]);

  if (!product) return null;

  const raw = rawSqft(w, h);
  const billed = billedSqft(w, h, rules);
  const materials = billed * product.price_per_sqft;

  function confirm() {
    if (!product) return;
    addItem({
      product_id: product.id,
      name: `${product.name} — ${w}′ × ${h}′`,
      sku: `WS-${product.slug.toUpperCase()}`,
      unit_price: Number(materials.toFixed(2)),
      quantity: 1,
      image: product.tile_svg ? tileDataUri(product.tile_svg) : null,
      wallStudio: { kind: "wall_design", wsProductId: product.id, category: product.category, w, h, sqft: billed },
    });
    closeSizeDialog();
  }

  return (
    <Dialog open={!!sizeDialog} onOpenChange={(o) => !o && closeSizeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Size it — {product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Width (ft)</label>
            <input
              type="number"
              min={1}
              step={0.5}
              value={w}
              onChange={(e) => setW(parseFloat(e.target.value) || 1)}
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Height (ft)</label>
            <input
              type="number"
              min={1}
              step={0.5}
              value={h}
              onChange={(e) => setH(parseFloat(e.target.value) || 1)}
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          {w}′ × {h}′ = <strong>{raw} sq ft</strong>
          {raw < rules.minSqft && <span className="text-muted-foreground"> (billed at {rules.minSqft} sq ft minimum)</span>}
          <br />
          Materials: <strong>{money(materials)}</strong> · Installation priced in the Installation Quote
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeSizeDialog}>
            Cancel
          </Button>
          <Button onClick={confirm}>Add to cart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
