"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { DEMO_ROOM_SVG, SURFACE_H, SURFACE_W } from "@/lib/wall-studio/constants";
import { buildMaskUrl, polyCentroid } from "@/lib/wall-studio/cutouts";
import { estimatedSqft, quadArea } from "@/lib/wall-studio/geometry";
import { matrix3dString, projection, type Point } from "@/lib/wall-studio/homography";
import { money } from "@/lib/wall-studio/pricing";
import { composeSnapshot } from "@/lib/wall-studio/snapshot";
import { useWallStudio } from "@/lib/wall-studio/store";
import { tileDataUri } from "@/lib/wall-studio/tiles";
import type { Corner, Cutout } from "@/lib/wall-studio/types";

export type StageApi = {
  toggleCamera: () => void;
  uploadPhoto: (file: File) => void;
  snapshot: () => Promise<void>;
  getSnapshotBlob: () => Promise<Blob | null>;
  toggleCut: () => void;
  reset: () => void;
  recalibrate: () => void;
};

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const ACCENT = "var(--ws-accent)";

export const VisualizerStage = forwardRef<
  StageApi,
  { onCameraChange?: (on: boolean) => void; onCuttingChange?: (on: boolean) => void }
>(function VisualizerStage({ onCameraChange, onCuttingChange }, ref) {
  const { selected, corners, setCorner, cutouts, setCutouts, scale, opacity, dims, calibArea, recalibrate } =
    useWallStudio();

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cameraOn, setCameraOn] = useState(false);
  const [imageSrc, setImageSrc] = useState(tileDataUri(DEMO_ROOM_SVG));
  const [cutting, setCutting] = useState<Cutout | null>(null);
  const [dragTip, setDragTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [note, setNote] = useState("Demo room loaded — use your camera or upload a photo of your space");

  useEffect(() => onCameraChange?.(cameraOn), [cameraOn, onCameraChange]);
  useEffect(() => onCuttingChange?.(!!cutting), [cutting, onCuttingChange]);

  // Stop the camera when the stage unmounts (drawer close).
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // Measure the stage (zero-sized while the drawer is closed).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = size.w;
  const Hpx = size.h;
  const sized = W > 0 && Hpx > 0;
  const cornersPx = useMemo<Point[]>(() => corners.map((c) => ({ x: c.x * W, y: c.y * Hpx })), [corners, W, Hpx]);
  const Hmat = useMemo(() => (sized ? projection(SURFACE_W, SURFACE_H, cornersPx) : null), [sized, cornersPx]);
  const maskUrl = useMemo(
    () => (Hmat ? buildMaskUrl(Hmat, W, Hpx, cutouts) : null),
    [Hmat, W, Hpx, cutouts],
  );

  // ── Imperative API for PreviewControls ──
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }
  async function toggleCamera() {
    if (cameraOn) {
      stopCamera();
      setNote("Camera off — demo room restored");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setCameraOn(true);
      setNote("Live camera — point at your wall and fit the corners");
    } catch {
      setNote("Camera unavailable in this environment — upload a photo instead");
    }
  }
  function uploadPhoto(file: File) {
    stopCamera();
    setImageSrc(URL.createObjectURL(file));
    setNote("Photo loaded — drag the corners to fit your wall");
  }
  async function composeBlob(): Promise<Blob | null> {
    if (!selected) return null;
    const backdrop = cameraOn && videoRef.current ? videoRef.current : imgRef.current;
    if (!backdrop) return null;
    return composeSnapshot({ backdrop, product: selected, corners, scale, opacity, cutouts });
  }
  async function snapshot() {
    const blob = await composeBlob();
    if (!blob || !selected) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wall-preview-${selected.slug}.png`;
    a.click();
  }
  function finishCutting(cancel: boolean) {
    setCutting((cur) => {
      if (!cancel && cur && cur.pts.length >= 3) setCutouts([...cutouts, { pts: cur.pts }]);
      return null;
    });
    setNote("Cutouts are printed full and trimmed on site — no price change");
  }
  function toggleCut() {
    if (cutting) finishCutting(false);
    else {
      setCutting({ pts: [] });
      setNote("Click around the object to outline it — click the first point (or Done) to close the cutout");
    }
  }

  useImperativeHandle(ref, () => ({
    toggleCamera,
    uploadPhoto,
    snapshot,
    getSnapshotBlob: composeBlob,
    toggleCut,
    reset: () => recalibrate(),
    recalibrate: () => {
      setSize({ w: stageRef.current?.clientWidth ?? 0, h: stageRef.current?.clientHeight ?? 0 });
      recalibrate();
    },
  }));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && cutting) finishCutting(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutting, cutouts]);

  // ── Corner drag ──
  function onHandleDown(e: React.PointerEvent, i: number) {
    if (cutting) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r = stageRef.current!.getBoundingClientRect();
      const nx = clamp((ev.clientX - r.left) / r.width);
      const ny = clamp((ev.clientY - r.top) / r.height);
      setCorner(i, { x: nx, y: ny });
      const next = corners.map((c, idx) => (idx === i ? { x: nx, y: ny } : c));
      const est = estimatedSqft(quadArea(next), calibArea, dims);
      const price = Math.max(25, est) * (selected?.price_per_sqft ?? 0);
      setDragTip({ x: nx * r.width, y: ny * r.height, text: `≈ ${est} sq ft · ${money(price)} materials` });
    };
    const up = () => {
      setDragTip(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ── Cut-design: click to place points ──
  function onStageDown(e: React.PointerEvent) {
    if (!cutting) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-handle]") || target.closest("[data-cut-del]")) return;
    const r = stageRef.current!.getBoundingClientRect();
    const fx = clamp((e.clientX - r.left) / r.width);
    const fy = clamp((e.clientY - r.top) / r.height);
    const pts = cutting.pts;
    if (pts.length >= 3) {
      const first = { x: pts[0].x * r.width, y: pts[0].y * r.height };
      if (Math.hypot(e.clientX - r.left - first.x, e.clientY - r.top - first.y) < 12) {
        finishCutting(false);
        return;
      }
    }
    setCutting({ pts: [...pts, { x: fx, y: fy }] });
  }

  // ── Drag an existing cutout ──
  function onCutoutDown(e: React.PointerEvent, index: number) {
    if (cutting) return;
    e.preventDefault();
    e.stopPropagation();
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const r = stageRef.current!.getBoundingClientRect();
      const dx = (ev.clientX - last.x) / r.width;
      const dy = (ev.clientY - last.y) / r.height;
      last = { x: ev.clientX, y: ev.clientY };
      setCutouts(
        cutouts.map((c, i) =>
          i === index
            ? { pts: c.pts.map((p) => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) })) }
            : c,
        ),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const ptsStr = (pts: Corner[]) => pts.map((p) => `${p.x * W},${p.y * Hpx}`).join(" ");

  return (
    <div
      ref={stageRef}
      onPointerDown={onStageDown}
      className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-[10px] bg-zinc-300"
      style={{ touchAction: "none", cursor: cutting ? "crosshair" : "default" }}
    >
      {/* backdrop */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Room preview"
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ display: cameraOn ? "none" : "block" }}
      />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        style={{ display: cameraOn ? "block" : "none" }}
      />

      {/* quad outline */}
      <svg className="pointer-events-none absolute inset-0 z-[4] h-full w-full">
        {sized && (
          <polygon
            points={ptsStr([corners[0], corners[1], corners[3], corners[2]])}
            fill="none"
            stroke="#ffffffaa"
            strokeWidth={1.5}
            strokeDasharray="6 5"
          />
        )}
      </svg>

      {/* pattern surface */}
      {selected && Hmat && (
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            width: SURFACE_W,
            height: SURFACE_H,
            transformOrigin: "0 0",
            transform: matrix3dString(Hmat),
            backgroundImage: `url("${tileDataUri(selected.tile_svg ?? "")}")`,
            backgroundRepeat: selected.repeat_pattern ? "repeat" : "no-repeat",
            backgroundSize: selected.repeat_pattern ? `${scale}px` : "100% 100%",
            mixBlendMode: selected.blend_mode,
            opacity,
            maskImage: maskUrl ?? undefined,
            WebkitMaskImage: maskUrl ?? undefined,
            maskSize: maskUrl ? "100% 100%" : undefined,
            WebkitMaskSize: maskUrl ? "100% 100%" : undefined,
          }}
        />
      )}

      {/* cutouts */}
      <svg className="pointer-events-none absolute inset-0 z-[7] h-full w-full">
        {cutouts.map((c, i) => (
          <polygon
            key={i}
            points={ptsStr(c.pts)}
            onPointerDown={(e) => onCutoutDown(e, i)}
            className={cutting ? "pointer-events-none" : "cursor-move"}
            style={{ pointerEvents: cutting ? "none" : "auto", fill: "rgba(255,255,255,.07)", stroke: "#fff", strokeWidth: 2, strokeDasharray: "6 4" }}
          />
        ))}
        {cutting && cutting.pts.length > 0 && (
          <>
            <polyline points={ptsStr(cutting.pts)} fill="none" stroke={ACCENT} strokeWidth={2.5} />
            {cutting.pts.map((p, idx) => (
              <circle
                key={idx}
                cx={p.x * W}
                cy={p.y * Hpx}
                r={idx === 0 ? 7 : 5}
                fill={idx === 0 ? ACCENT : "#fff"}
                stroke={idx === 0 ? "#fff" : ACCENT}
                strokeWidth={3}
              />
            ))}
          </>
        )}
      </svg>

      {/* cutout delete buttons */}
      {!cutting &&
        cutouts.map((c, i) => {
          const ct = polyCentroid(c.pts.map((p) => ({ x: p.x * W, y: p.y * Hpx })));
          return (
            <button
              key={i}
              data-cut-del
              title="Remove cutout"
              onClick={() => setCutouts(cutouts.filter((_, idx) => idx !== i))}
              className="absolute z-[8] grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-zinc-900 text-[12px] text-white"
              style={{ left: ct.x, top: ct.y }}
            >
              ✕
            </button>
          );
        })}

      {/* handles */}
      {sized &&
        cornersPx.map((p, i) => (
          <div
            key={i}
            data-handle
            onPointerDown={(e) => onHandleDown(e, i)}
            className="absolute z-[5] h-[26px] w-[26px] rounded-full border-[3px] bg-white shadow-md"
            style={{
              left: p.x,
              top: p.y,
              marginLeft: -13,
              marginTop: -13,
              borderColor: ACCENT,
              cursor: cutting ? "default" : "grab",
              opacity: cutting ? 0.35 : 1,
              pointerEvents: cutting ? "none" : "auto",
            }}
          />
        ))}

      {/* drag tooltip */}
      {dragTip && (
        <div
          className="pointer-events-none absolute z-[20] -translate-x-1/2 -translate-y-[170%] whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[12px] text-white"
          style={{ left: dragTip.x, top: dragTip.y }}
        >
          {dragTip.text}
        </div>
      )}

      {/* note */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] bg-zinc-900/80 px-3 py-1.5 text-center text-[12px] text-white">
        {note}
      </div>
    </div>
  );
});
