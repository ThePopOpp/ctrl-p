"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const LIME = "#b4f13a";
const DRAW_MS = 2200;
const CYCLE_MS = 3600;

type Product = {
  label: string;
  main: string;
  details: string[];
  circles?: Array<[number, number, number]>; // cx, cy, r
  transform?: string;
};

const PRODUCTS: Product[] = [
  {
    label: "Digital Cards",
    main:
      "M182 60 H238 A22 22 0 0 1 260 82 V258 A22 22 0 0 1 238 280 H182 A22 22 0 0 1 160 258 V82 A22 22 0 0 1 182 60 Z",
    details: ["M196 74 H224", "M220 118 A24 24 0 1 0 220 166", "M184 198 H236", "M184 216 H218", "M184 234 H232", "M184 252 H206"],
  },
  {
    label: "Business Cards",
    transform: "rotate(-9 210 175)",
    main:
      "M124 130 H296 A14 14 0 0 1 310 144 V206 A14 14 0 0 1 296 220 H124 A14 14 0 0 1 110 206 V144 A14 14 0 0 1 124 130 Z",
    details: ["M132 148 H160 V176 H132 Z", "M176 152 H286", "M176 168 H256", "M176 184 H276", "M176 200 H236"],
  },
  {
    label: "Banners",
    main: "M96 96 H324 V214 L210 246 L96 214 Z",
    details: ["M124 126 H296", "M124 148 H276", "M124 170 H288"],
    circles: [
      [108, 108, 4],
      [312, 108, 4],
    ],
  },
  {
    label: "Yard Signs",
    main:
      "M142 92 H278 A8 8 0 0 1 286 100 V178 A8 8 0 0 1 278 186 H142 A8 8 0 0 1 134 178 V100 A8 8 0 0 1 142 92 Z",
    details: ["M168 186 V250", "M252 186 V250", "M160 118 H260", "M160 140 H236", "M160 162 H272"],
  },
];

export function HeroPlotter() {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) return;
    const id = setInterval(() => setIndex((p) => (p + 1) % PRODUCTS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const product = PRODUCTS[index];
  const pathId = `cp-path-${index}`;

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="relative h-[440px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl lg:h-[560px]">
        {/* Grid backdrop */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse at center, black 55%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 55%, transparent 100%)",
          }}
        />
        {/* Ambient lime glow */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: LIME }}
        />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-zinc-500">
            <span className="inline-block h-2 w-2 bg-zinc-600" />
            PLOTTING
          </div>
          <div className="flex items-center gap-1.5">
            {PRODUCTS.map((_, k) => (
              <span
                key={k}
                className={cn("h-1.5 rounded-full transition-all duration-500", k === index ? "w-5" : "w-1.5 bg-zinc-700")}
                style={k === index ? { background: LIME, boxShadow: `0 0 8px ${LIME}` } : undefined}
              />
            ))}
          </div>
        </div>

        {/* Plotter drawing */}
        <svg viewBox="0 0 420 340" className="absolute inset-0 h-full w-full">
          <g key={index} transform={product.transform}>
            {product.details.map((d, di) => (
              <path
                key={di}
                d={d}
                pathLength={1}
                className="cp-stroke"
                style={{ stroke: "#d4d4d8", strokeWidth: 2, animationDelay: `${0.35 + di * 0.14}s` }}
              />
            ))}
            <path id={pathId} d={product.main} pathLength={1} className="cp-stroke" style={{ stroke: "#fafafa" }} />
            {product.circles?.map(([cx, cy, r], ci) => (
              <circle
                key={ci}
                cx={cx}
                cy={cy}
                r={r}
                className="cp-fade"
                style={{ fill: "none", stroke: "#d4d4d8", strokeWidth: 2, animationDelay: "1.2s" }}
              />
            ))}

            {/* Pen node tracing the outline */}
            {!reduced && (
              <>
                <circle r="8" fill={LIME} opacity="0.25">
                  <animateMotion dur={`${DRAW_MS}ms`} fill="freeze" calcMode="linear">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
                <circle r="4" fill={LIME} style={{ filter: `drop-shadow(0 0 6px ${LIME})` }}>
                  <animateMotion dur={`${DRAW_MS}ms`} fill="freeze" calcMode="linear">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              </>
            )}
          </g>
        </svg>

        {/* Rotating product label */}
        <div className="absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-[12px] font-semibold text-zinc-100 backdrop-blur">
          <span className="h-2 w-2 rounded-full" style={{ background: LIME, boxShadow: `0 0 8px ${LIME}` }} />
          {product.label}
        </div>

        {/* Stats badge */}
        <div className="absolute bottom-5 right-5 flex items-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 backdrop-blur">
          <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: LIME }}>
            <Check className="h-4 w-4 text-zinc-900" />
          </span>
          <div>
            <div className="text-[13px] font-semibold text-zinc-100">2,400+ projects</div>
            <div className="text-[11px] text-zinc-500">delivered statewide</div>
          </div>
        </div>
      </div>
    </div>
  );
}
