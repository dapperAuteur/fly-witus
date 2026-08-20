import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ServiceWorkerRegistration } from "./_components/sw-register";
import { AppNav } from "@/components/app-nav";
import { HelpBubble } from "@/components/help-bubble";
import { SiteFooter } from "@/components/site-footer";
import { PostHogProvider } from "@/lib/analytics/posthog-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fly WitUS by BAM",
  description:
    "UAS Pre-Flight Checklist and Post-Flight Log App. Export Your Flight Data to PDF or JSON.",
  // PWA polish: apple-touch-icon for iOS home-screen install + manifest
  // is auto-served by app/manifest.ts at /manifest.webmanifest.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fly WitUS",
  },
  icons: {
    icon: "/flywitus-platypus-logo.png",
    apple: "/flywitus-platypus-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        {/* Renders nothing. Initialises PostHog only when a key is configured, so a
            keyless deploy behaves exactly as before. Read the env HERE, in the Server
            Component, and pass it down; `?? null` is what puts the provider in its
            supported keyless state instead of initialising with `undefined`.
            "/ingest" is reverse-proxied to PostHog by next.config.ts so ad blockers
            can't drop events on the vendor hostname. */}
        <PostHogProvider
          apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null}
          apiHost="/ingest"
        />
        <AppNav />
        {children}
        <SiteFooter />
        <HelpBubble />
        {/* Vercel Web Analytics: cookieless pageview counts + Web Vitals, no consent
            surface. Complements PostHog (which owns the product-event taxonomy) rather
            than replacing it. It was previously mounted inside the home page component,
            so every route except "/" went uncounted; the root layout is the only place
            that covers all of them. */}
        <Analytics />
      </body>
    </html>
  );
}
