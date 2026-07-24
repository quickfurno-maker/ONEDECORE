import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONEDECORE — One Vision. Complete Interiors.",
  description: "ONEDECORE architectural interior services baseline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-stone-50 text-stone-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
