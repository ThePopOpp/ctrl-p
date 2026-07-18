"use client";

import { useRef, useState, type RefObject } from "react";
import { Bookmark, Camera, Check, Copy, Download, ImageUp, Loader2, RotateCcw, Scissors, Square } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { estimatedDims, estimatedSqft, quadArea } from "@/lib/wall-studio/geometry";
import { computeInstall, money } from "@/lib/wall-studio/pricing";
import { useWallStudio } from "@/lib/wall-studio/store";
import { tileDataUri } from "@/lib/wall-studio/tiles";
import { WS_CATEGORY_LABEL } from "@/lib/wall-studio/types";
import type { StageApi } from "@/components/wall-studio/VisualizerStage";

export function PreviewControls({
  stageApi,
  cameraOn,
  cutting,
}: {
  stageApi: RefObject<StageApi | null>;
  cameraOn: boolean;
  cutting: boolean;
}) {
  const { selected, corners, dims, calibArea, cutouts, scale, opacity, rules, factors, setDims, setScale, setOpacity, resetCorners, openSizeDialog } =
    useWallStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedUrl, setSavedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function saveLook() {
    if (!selected) return;
    setSaveState("saving");
    try {
      const blob = await stageApi.current?.getSnapshotBlob();
      if (!blob) throw new Error("no snapshot");
      const fd = new FormData();
      fd.append("png", blob, "look.png");
      fd.append("product_id", selected.id);
      fd.append("corners", JSON.stringify(corners));
      fd.append("cutouts", JSON.stringify(cutouts));
      fd.append("wall_w_ft", String(dims.w));
      fd.append("wall_h_ft", String(dims.h));
      fd.append("pattern_scale", String(scale));
      fd.append("opacity", opacity.toFixed(2));
      const headers: Record<string, string> = {};
      try {
        const db = getSupabaseBrowserClient();
        const token = db ? (await db.auth.getSession()).data.session?.access_token : null;
        if (token) headers.authorization = `Bearer ${token}`;
      } catch {
        /* guest save */
      }
      const res = await fetch("/api/wall-studio/visualizations", { method: "POST", headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "save failed");
      const shareUrl = data.id ? `${window.location.origin}/studio/look/${data.id}` : data.snapshot_url;
      setSavedUrl(shareUrl);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  if (!selected) return null;

  const area = quadArea(corners);
  const est = estimatedSqft(area, calibArea, dims);
  const billed = Math.max(rules.minSqft, est);
  const materials = billed * selected.price_per_sqft;
  const install = computeInstall(
    {
      sqft: billed,
      maxHeightFt: estimatedDims(area, calibArea, dims).h,
      blendedBaseRate: rules.installBaseRates[selected.category],
      factors,
    },
    rules,
  ).total;

  const btn =
    "flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">Preview controls</h3>

      {/* Selected design */}
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
        <div
          className="h-11 w-11 shrink-0 rounded-md"
          style={{
            backgroundImage: `url("${tileDataUri(selected.tile_svg ?? "")}")`,
            backgroundSize: selected.repeat_pattern ? "60px" : "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selected.name}</div>
          <div className="text-[12px] text-zinc-500">
            {WS_CATEGORY_LABEL[selected.category]} · {money(selected.price_per_sqft)}/sq ft
          </div>
        </div>
      </div>

      {/* Wall size */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">Wall size (real feet)</label>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <input
              type="number"
              min={1}
              step={0.5}
              value={dims.w}
              onChange={(e) => setDims({ w: parseFloat(e.target.value) || 1 })}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <span className="mt-1 block text-[11px] text-zinc-400">Width (ft)</span>
          </div>
          <div>
            <input
              type="number"
              min={1}
              step={0.5}
              value={dims.h}
              onChange={(e) => setDims({ h: parseFloat(e.target.value) || 1 })}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <span className="mt-1 block text-[11px] text-zinc-400">Height (ft)</span>
          </div>
        </div>
      </div>

      {/* Live price */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-800/40">
        ≈ <strong className="text-[15px]">{est} sq ft</strong>
        {est < rules.minSqft && <span className="text-zinc-500"> (billed at {rules.minSqft} min)</span>}
        <br />
        Materials <strong>{money(materials)}</strong> · Est. install {money(install)}
        {cutouts.length > 0 && (
          <>
            <br />
            <span className="text-zinc-500">
              {cutouts.length} cutout(s) — printed full, trimmed on site, no price change
            </span>
          </>
        )}
      </div>

      {/* Source */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btn} onClick={() => stageApi.current?.toggleCamera()}>
          <Camera className="h-4 w-4" />
          {cameraOn ? "Stop camera" : "Camera"}
        </button>
        <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
          <ImageUp className="h-4 w-4" />
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) stageApi.current?.uploadPhoto(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Pattern scale */}
      {selected.repeat_pattern && (
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">Pattern scale</label>
          <input
            type="range"
            min={80}
            max={500}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--ws-accent)" }}
          />
        </div>
      )}

      {/* Blend strength */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">Blend strength</label>
        <input
          type="range"
          min={30}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          className="w-full"
          style={{ accentColor: "var(--ws-accent)" }}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          onClick={() => openSizeDialog(selected, true)}
        >
          Add this design to cart
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold text-white"
          style={{ backgroundColor: "var(--ws-accent)" }}
          onClick={() => stageApi.current?.snapshot()}
        >
          <Download className="h-4 w-4" />
          Download preview
        </button>
        <button type="button" className={btn} onClick={saveLook} disabled={saveState === "saving"}>
          {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
          {saveState === "saving" ? "Saving…" : "Save this look"}
        </button>
        {saveState === "saved" && savedUrl && (
          <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[12px] dark:border-zinc-700 dark:bg-zinc-800/40">
            <a href={savedUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-zinc-600 underline dark:text-zinc-300">
              {savedUrl}
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(savedUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100"
              title="Copy link"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        {saveState === "error" && <p className="text-[12px] text-red-600">Could not save. Try again.</p>}
        <button type="button" className={btn} onClick={() => stageApi.current?.toggleCut()}>
          {cutting ? <Square className="h-4 w-4" /> : <Scissors className="h-4 w-4" />}
          {cutting ? "Done cutting" : "Cut Design"}
        </button>
        <button type="button" className={btn} onClick={() => resetCorners()}>
          <RotateCcw className="h-4 w-4" />
          Reset corners
        </button>
      </div>
    </div>
  );
}
