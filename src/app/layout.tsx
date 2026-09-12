import type { Metadata } from "next";
import { AdConsentBanner } from "@/features/marketing/meta/AdConsentBanner";
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

          Three gates, all required: a public path, a configured pixel id, and
          an explicit advertising consent. Production already carries the pixel
          id and the Conversions API token, so the consent cookie is the gate
          that actually protects a visitor — not the environment.
        */}
        <MetaPixel />
        {/*
          The choice itself, on the same public surfaces and behind the same
          route gate. A page that may never be measured is never asked about
          measurement either.
        */}
        <AdConsentBanner />
        {children}
      </body>
    </html>
  );
}
