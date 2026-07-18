"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Card sizing + snap. Scoped to .ws-track/.ws-card so it never touches globals.
// 3.5 cards desktop / 2.5 tablet / 1.5 mobile — half-card peek on the right.
const SLIDER_CSS = `
.ws-track{display:flex;gap:1.1rem;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:thin;cursor:grab;padding-bottom:.6rem;}
.ws-track.ws-dragging{cursor:grabbing;scroll-snap-type:none;user-select:none;}
.ws-track.ws-dragging .ws-card{pointer-events:none;}
.ws-track>.ws-card{flex:0 0 calc((100% - 3.3rem)/3.5);scroll-snap-align:start;}
@media(max-width:900px){.ws-track>.ws-card{flex-basis:calc((100% - 2.2rem)/2.5);}}
@media(max-width:600px){.ws-track>.ws-card{flex-basis:calc((100% - 1.1rem)/1.5);}}
`;

export function DesignSlider({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function slideBy(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(".ws-card");
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).gap) || 18;
    track.scrollBy({ left: dir * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  }

  // Ported drag-to-scroll: mouse drags the row with momentum; touch/pen use
  // native scrolling; a drag suppresses the click so card buttons don't fire.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let down = false;
    let dragged = false;
    let startX = 0;
    let startScroll = 0;
    let lastX = 0;
    let vel = 0;
    let momentumId: number | null = null;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      down = true;
      dragged = false;
      startX = lastX = e.clientX;
      startScroll = track.scrollLeft;
      vel = 0;
      if (momentumId) {
        cancelAnimationFrame(momentumId);
        momentumId = null;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) > 5) {
        dragged = true;
        track.classList.add("ws-dragging");
        track.setPointerCapture(e.pointerId);
      }
      if (dragged) {
        vel = e.clientX - lastX;
        lastX = e.clientX;
        track.scrollLeft = startScroll - dx;
      }
    };
    const release = () => {
      if (!down) return;
      down = false;
      if (dragged) {
        let v = vel;
        const glide = () => {
          v *= 0.92;
          track.scrollLeft -= v;
          if (Math.abs(v) > 0.5) momentumId = requestAnimationFrame(glide);
          else {
            momentumId = null;
            track.classList.remove("ws-dragging");
          }
        };
        momentumId = requestAnimationFrame(glide);
        window.setTimeout(() => track.classList.remove("ws-dragging"), 400);
      }
    };
    const onClickCapture = (e: MouseEvent) => {
      if (dragged) {
        e.stopPropagation();
        e.preventDefault();
        dragged = false;
      }
    };

    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", release);
    track.addEventListener("pointerleave", release);
    track.addEventListener("pointercancel", release);
    track.addEventListener("click", onClickCapture, true);
    return () => {
      if (momentumId) cancelAnimationFrame(momentumId);
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", release);
      track.removeEventListener("pointerleave", release);
      track.removeEventListener("pointercancel", release);
      track.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return (
    <div>
      <style>{SLIDER_CSS}</style>
      <div className="mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => slideBy(-1)}
          aria-label="Previous designs"
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => slideBy(1)}
          aria-label="Next designs"
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div ref={trackRef} className="ws-track">
        {children}
      </div>
    </div>
  );
}
