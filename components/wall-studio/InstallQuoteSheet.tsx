"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { computeInstall, isRushFromDate, money } from "@/lib/wall-studio/pricing";
import { useWallStudio } from "@/lib/wall-studio/store";
import type { InstallInputs } from "@/lib/wall-studio/types";

const INSTALL_LINE_ID = "wall-install";

export function InstallQuoteSheet() {
  const { installOpen, setInstallOpen, factors, setFactors, rules } = useWallStudio();
  const { items, addItem, removeItem } = useCart();

  const wallLines = items.filter((i) => i.wallStudio?.kind === "wall_design");
  const hasInstallLine = items.some((i) => i.wallStudio?.kind === "wall_install");

  // Build install inputs from the wall design lines currently in the cart.
  let inputs: InstallInputs | null = null;
  if (wallLines.length) {
    let sqft = 0;
    let maxHeightFt = 0;
    let rateWeighted = 0;
    for (const l of wallLines) {
      const m = l.wallStudio as Extract<typeof l.wallStudio, { kind: "wall_design" }>;
      sqft += m.sqft;
      maxHeightFt = Math.max(maxHeightFt, m.h);
      rateWeighted += m.sqft * rules.installBaseRates[m.category];
    }
    inputs = { sqft, maxHeightFt, blendedBaseRate: sqft ? rateWeighted / sqft : 0, factors };
  }

  const estimate = inputs ? computeInstall(inputs, rules) : null;

  function upsertInstall() {
    if (!estimate) return;
    removeItem(INSTALL_LINE_ID);
    addItem({
      product_id: INSTALL_LINE_ID,
      name: "Professional installation",
      sku: "WS-INSTALL",
      unit_price: estimate.total,
      quantity: 1,
      image: null,
      wallStudio: { kind: "wall_install", factors },
    });
    setInstallOpen(false);
  }

  const twoCol = "grid grid-cols-2 gap-3";
  const fieldLabel = "mb-1 block text-xs font-medium text-muted-foreground";
  const control = "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm";
  const check = "flex items-center gap-2 text-sm";

  return (
    <Sheet open={installOpen} onOpenChange={setInstallOpen}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Installation quote</SheetTitle>
          <SheetDescription>Wall height and material type are read from your cart. Cutouts never change price.</SheetDescription>
        </SheetHeader>

        {!wallLines.length ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Add a wall design to your cart to build an installation quote.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className={twoCol}>
              <div>
                <label className={fieldLabel}>Location</label>
                <select
                  className={control}
                  value={factors.location}
                  onChange={(e) => setFactors({ location: e.target.value as "int" | "ext" })}
                >
                  <option value="int">Interior</option>
                  <option value="ext">Exterior (+20%)</option>
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Surface condition</label>
                <select
                  className={control}
                  value={factors.condition}
                  onChange={(e) => setFactors({ condition: e.target.value as "good" | "textured" | "damaged" })}
                >
                  <option value="good">Good / smooth</option>
                  <option value="textured">Textured (+15%)</option>
                  <option value="damaged">Needs repair (+$120 &amp; +10%)</option>
                </select>
              </div>
            </div>

            <div className={twoCol}>
              <div>
                <label className={fieldLabel}>Obstacles (outlets, fixtures, moves)</label>
                <input
                  type="number"
                  min={0}
                  className={control}
                  value={factors.obstacles}
                  onChange={(e) => setFactors({ obstacles: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>
              <div>
                <label className={fieldLabel}>Distance from shop (miles)</label>
                <input
                  type="number"
                  min={0}
                  className={control}
                  value={factors.miles}
                  onChange={(e) => setFactors({ miles: Math.max(0, parseFloat(e.target.value) || 0) })}
                />
              </div>
            </div>

            <label className={check}>
              <input type="checkbox" checked={factors.removal} onChange={(e) => setFactors({ removal: e.target.checked })} />
              Remove existing paper / wrap — {money(rules.removalPerSqft)}/sq ft
            </label>
            <label className={check}>
              <input type="checkbox" checked={factors.cleaning} onChange={(e) => setFactors({ cleaning: e.target.checked })} />
              Cleaning &amp; surface prep — {money(rules.cleaningPerSqft)}/sq ft
            </label>
            <label className={check}>
              <input type="checkbox" checked={factors.access} onChange={(e) => setFactors({ access: e.target.checked })} />
              Difficult access — stairs, lifts, tight spaces (+{money(rules.accessFlat)})
            </label>
            <label className={check}>
              <input type="checkbox" checked={factors.rush} onChange={(e) => setFactors({ rush: e.target.checked })} />
              Rush — install within {rules.rushWindowDays} days (+{Math.round(rules.rushPct * 100)}%)
            </label>

            <div>
              <label className={fieldLabel}>Planned install date (auto-flags rush)</label>
              <input
                type="date"
                className={control}
                onChange={(e) => {
                  if (e.target.value) setFactors({ rush: isRushFromDate(e.target.value, Date.now(), rules) });
                }}
              />
            </div>

            {/* Breakdown */}
            {estimate && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                {estimate.lines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3 border-b border-dashed py-1.5 last:border-0">
                    <span className="text-muted-foreground">{l.label}</span>
                    <span>{money(l.amount)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Installation total</span>
                  <span>{money(estimate.total)}</span>
                </div>
              </div>
            )}

            <Button className="w-full" onClick={upsertInstall}>
              {hasInstallLine ? "Update installation in cart" : "Add professional installation"}
            </Button>
            {hasInstallLine && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  removeItem(INSTALL_LINE_ID);
                  setInstallOpen(false);
                }}
              >
                Remove installation
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
