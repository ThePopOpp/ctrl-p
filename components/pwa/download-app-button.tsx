"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Download, Loader2, Plus, Share, Smartphone, X } from "lucide-react";

import { canInstall, isIOS, isStandalone, onChange, promptInstall } from "@/lib/pwa/pwa-client";
import { enablePushNotifications, pushSupported } from "@/lib/pwa/push-client";

type Props = {
  /** Full control over the trigger button's classes. A sensible default is used if omitted. */
  className?: string;
  label?: string;
  /** Hide the text label on small screens (useful in tight toolbars). */
  responsiveLabel?: boolean;
};

const DEFAULT_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-[14px] font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors";

export function DownloadAppButton({ className, label = "Download app", responsiveLabel = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? DEFAULT_CLASS} aria-label={label}>
        <Download className="h-4 w-4 shrink-0" />
        <span className={responsiveLabel ? "hidden sm:inline" : undefined}>{label}</span>
      </button>
      {open && <InstallDialog onClose={() => setOpen(false)} />}
    </>
  );
}

type InstallState = "idle" | "installing" | "installed" | "unavailable";
type NotifState = "idle" | "working" | "enabled" | "denied" | "unsupported";

function InstallDialog({ onClose }: { onClose: () => void }) {
  const [installState, setInstallState] = useState<InstallState>("idle");
  const [installable, setInstallable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [notifState, setNotifState] = useState<NotifState>("idle");
  const [notifMsg, setNotifMsg] = useState("");

  useEffect(() => {
    setInstallable(canInstall());
    setStandalone(isStandalone());
    setIos(isIOS());
    if (!pushSupported()) setNotifState("unsupported");
    else if (typeof Notification !== "undefined" && Notification.permission === "granted") setNotifState("enabled");
    return onChange(() => {
      setInstallable(canInstall());
      setStandalone(isStandalone());
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleInstall() {
    setInstallState("installing");
    const outcome = await promptInstall();
    if (outcome === "accepted") setInstallState("installed");
    else if (outcome === "unavailable") setInstallState("unavailable");
    else setInstallState("idle");
  }

  async function handleEnableNotifications() {
    setNotifState("working");
    setNotifMsg("");
    const res = await enablePushNotifications();
    if (res.ok) {
      setNotifState("enabled");
      setNotifMsg("You're all set — we'll notify you about orders, proofs, and messages.");
    } else {
      setNotifState(res.code === "denied" ? "denied" : res.code === "unsupported" ? "unsupported" : "idle");
      setNotifMsg(res.error || "Could not enable notifications.");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="Ctrl+P" className="h-12 w-12 rounded-xl" />
            <div>
              <h2 className="text-lg font-bold tracking-tight">Get the Ctrl+P app</h2>
              <p className="text-[12.5px] text-zinc-500">Install it on your device for a faster, full-screen experience.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          {/* Install section */}
          {standalone || installState === "installed" ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
              <Check className="h-4 w-4" /> The app is installed on this device.
            </div>
          ) : ios ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
              <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100">
                <Smartphone className="h-4 w-4" /> Install on iPhone / iPad
              </div>
              <ol className="space-y-1.5">
                <li className="flex items-center gap-2">
                  1. Tap the <Share className="inline h-4 w-4" /> Share button in Safari
                </li>
                <li className="flex items-center gap-2">
                  2. Choose <Plus className="inline h-4 w-4" /> &ldquo;Add to Home Screen&rdquo;
                </li>
                <li>3. Tap &ldquo;Add&rdquo; — Ctrl+P appears on your home screen</li>
              </ol>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstall}
              disabled={installState === "installing"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {installState === "installing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {installState === "installing" ? "Installing…" : "Install app"}
            </button>
          )}
          {installState === "unavailable" && !ios && (
            <p className="text-[12px] text-zinc-500">
              Your browser didn&apos;t offer an install prompt. Open the browser menu and choose
              &ldquo;Install app&rdquo; / &ldquo;Add to Home Screen&rdquo;.
            </p>
          )}

          {/* Notifications section */}
          <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="h-4 w-4 text-zinc-500" /> Push notifications
              </div>
              {notifState === "enabled" ? (
                <span className="flex items-center gap-1 text-[12.5px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Enabled
                </span>
              ) : notifState === "unsupported" ? (
                <span className="text-[12px] text-zinc-400">Not supported</span>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  disabled={notifState === "working"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {notifState === "working" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Enable
                </button>
              )}
            </div>
            {notifMsg && (
              <p
                className={`mt-2 text-[12px] ${notifState === "enabled" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}
              >
                {notifMsg}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100 px-6 py-3 text-center text-[11.5px] text-zinc-400 dark:border-zinc-800">
          Works on Windows, macOS, Android &amp; iOS
        </div>
      </div>
    </div>
  );
}
