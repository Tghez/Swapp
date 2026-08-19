import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Lets the dev server serve JS chunks to a phone connected through an
  // ngrok tunnel — Next blocks cross-origin dev requests by default.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"],
};

export default nextConfig;
