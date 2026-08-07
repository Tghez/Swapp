import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";

/**
 * The PDR asks for Nunito, but Nunito ships no Hebrew glyphs — every string in
 * this app would silently fall back to a system font. Fredoka is a rounder
 * Hebrew-capable match. Its 700 weight is not loaded on purpose — Fredoka's
 * bold gets blobby at that weight, so `font-bold` (700) is left to fall back
 * to the closest lighter loaded face (600) per the CSS font-matching spec,
 * rather than rendering the true bold.
 */
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Swapp — מסירת תורנויות",
  description: "מסירה ולקיחה של תורנויות בין סטאז'רים",
  manifest: "/manifest.webmanifest",
  applicationName: "Swapp",
  appleWebApp: {
    capable: true,
    title: "Swapp",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF3E7",
  width: "device-width",
  initialScale: 1,
  // Installed to a home screen this behaves as an app, so the browser's
  // pinch-zoom is unwanted — but capping maxScale at 1 would block users who
  // genuinely need to zoom, so only the automatic zoom-on-focus is suppressed.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-bg text-text">
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
