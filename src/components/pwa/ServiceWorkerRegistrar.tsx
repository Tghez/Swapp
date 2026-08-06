"use client";

import { useEffect } from "react";

/**
 * Registers the service worker. Its only job is making the app installable —
 * see public/sw.js for why it deliberately caches almost nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration costs installability, nothing more — the app
        // itself works fine, so there is nothing to show the user.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
