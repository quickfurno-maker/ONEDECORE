import type { Metadata } from "next";
import { MetaPixel } from "@/features/marketing/meta/MetaPixel";
import "./globals.css";
import "@/features/public-site/theme/public-dark-theme.css";
import "@/features/public-site/chrome/public-site-chrome.css";
import "@/features/public-site/home-r4/styles/home-foundation.css";
import "@/features/public-site/home-r4/styles/home-r4.css";

export const metadata: Metadata = {
  title: "ONEDECORE — One Vision. Complete Interiors.",
  description:
    "ONEDECORE designs and delivers complete home interiors, modular kitchens and custom wardrobes for homes across Pune.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <noscript>
          <style>{`[data-dc-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {/*
          The ONLY measurement mount point on the site.

          This layout wraps the admin console and the manager workspace as well
          as the public site, so the component is gated rather than trusted:
          `isMetaTrackablePath` is deny-by-default and must say yes before any
          script is requested. Nothing is added to this file's server-rendered
          output — an internal page ships no third-party tag at all, rather than
          a tag that happens not to fire.

          It renders null without `NEXT_PUBLIC_META_PIXEL_ID`, which is the
          state of every environment until the owner sets it in a production
          BUILD. Merging this PR does not start tracking anyone.
        */}
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
