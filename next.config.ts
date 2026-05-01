import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Wrap the Next config with serwist's plugin so `next build` generates
// the service worker (public/sw.js) from src/app/sw.ts. Disabled in dev
// to keep HMR fast and to avoid stale-cache confusion mid-edit.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSerwist(nextConfig);
