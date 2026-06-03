import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "./_components/sw-register";
import { AppNav } from "@/components/app-nav";
import { HelpBubble } from "@/components/help-bubble";
import { SiteFooter } from "@/components/site-footer";

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
        <AppNav />
        {children}
        <SiteFooter />
        <HelpBubble />
      </body>
    </html>
  );
}
