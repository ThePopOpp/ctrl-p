"use client";

import { useEffect } from "react";

import { initInstall } from "@/lib/pwa/pwa-client";

/** Registers the service worker and wires up install-prompt capture. Renders nothing. */
export function PwaRegister() {
  useEffect(() => {
    initInstall();
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration failures shouldn't break the app */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
