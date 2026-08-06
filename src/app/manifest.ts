import type { MetadataRoute } from "next";

/**
 * PWA manifest (PDR §9.1). Together with a service worker that handles fetch
 * and an HTTPS origin, this is the whole of what "Add to Home Screen"
 * installability requires — no build plugin involved.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Swapp — מסירת תורנויות",
    short_name: "Swapp",
    description: "מסירה ולקיחה של תורנויות בין מתמחים",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF3E7",
    theme_color: "#FAF3E7",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
