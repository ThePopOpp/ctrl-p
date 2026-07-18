"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { PreviewControls } from "@/components/wall-studio/PreviewControls";
import { VisualizerStage, type StageApi } from "@/components/wall-studio/VisualizerStage";
import { useWallStudio } from "@/lib/wall-studio/store";

const DRAWER_CSS = `
@keyframes wsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes wsFade { from { opacity: 0; } to { opacity: 1; } }
.ws-drawer-content[data-state="open"] { animation: wsSlideUp .3s ease; }
.ws-drawer-overlay[data-state="open"] { animation: wsFade .2s ease; }
`;

export function VisualizerDrawer() {
  const { open, closeVisualizer, selected } = useWallStudio();
  const accent = selected?.accent_hex ?? "#2f6b4f";
  const stageRef = useRef<StageApi>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cutting, setCutting] = useState(false);

  // The stage has zero size while the drawer is closed; recalibrate once it's
  // visible so the overlay + pricing reflect the real stage geometry.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => stageRef.current?.recalibrate(), 350);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeVisualizer()}>
      <Dialog.Portal>
        <style>{DRAWER_CSS}</style>
        <Dialog.Overlay className="ws-drawer-overlay fixed inset-0 z-[94] bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ "--ws-accent": accent } as React.CSSProperties}
          className="ws-drawer-content fixed inset-x-0 bottom-0 z-[95] max-h-[93vh] overflow-y-auto rounded-t-[20px] border-t border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="sticky top-0 z-10 mb-4 flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-950">
            <Dialog.Title className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-100">
              Visualizer
            </Dialog.Title>
            <span className="hidden text-[13px] text-zinc-500 sm:inline">
              Drag the four corners to fit your wall or window
            </span>
            <Dialog.Close className="ml-auto grid h-8 w-8 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="mx-auto max-w-[1100px] px-6 pb-8">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                <VisualizerStage
                  ref={stageRef}
                  onCameraChange={setCameraOn}
                  onCuttingChange={setCutting}
                />
              </div>
              <PreviewControls stageApi={stageRef} cameraOn={cameraOn} cutting={cutting} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
