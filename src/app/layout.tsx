import type { Metadata } from "next";
import "./globals.css";
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
        {children}
      </body>
    </html>
  );
}
