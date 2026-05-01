import type { MetadataRoute } from "next";

// PWA manifest, served at /manifest.webmanifest by Next.js's metadata
// route convention. Browsers use this to enable "Add to Home Screen"
// and to render the standalone app shell.
//
// Single icon entry pointing at the existing platypus logo for now —
// proper sized icons (192, 512, maskable) get added later if needed.
// "any maskable" purpose lets browsers crop to their preferred shape;
// most adaptive-icon browsers handle it cleanly even from a single PNG.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fly WitUS",
    short_name: "FlyWitUS",
    description:
      "FAA Part 107 pre-flight checklist and mission log for commercial drone pilots. Works offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0284c7",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/flywitus-platypus-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/flywitus-platypus-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
