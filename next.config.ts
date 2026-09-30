import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Requests to /api/v1/* are handled by the App Router universal reverse proxy
  // at app/api/v1/[...path]/route.ts, which injects tunnel warning bypass headers
  // (tunnl-skip-browser-warning, ngrok-skip-browser-warning) and handles error reporting.
};

export default nextConfig;
