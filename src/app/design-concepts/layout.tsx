import type { Metadata } from "next";
import { designConceptFontVariables } from "@/features/design-concepts/fonts";
import "@/features/design-concepts/styles/foundation.css";
import "@/features/design-concepts/styles/index-page.css";
import "@/features/design-concepts/styles/cinematic.css";
import "@/features/design-concepts/styles/architectural.css";
import "@/features/design-concepts/styles/design-tech.css";
import "@/features/design-concepts/conversion-master/styles/conversion-master.css";
import "@/features/design-concepts/premium-motion/styles/premium-motion.css";

/**
 * Phase 2F owner-review area (R2 concepts + R3 Conversion Master).
 *
 * These routes exist only on the redesign branch for live owner review. They
 * are excluded from the sitemap and marked noindex/nofollow, and their CSS is
 * scoped to [data-design-concept] so it cannot reach the production site.
 */
export const metadata: Metadata = {
  title: "ONEDECORE — Homepage Concepts (internal review)",
  description: "Internal Phase 2F design review. Not a public ONEDECORE page.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function DesignConceptsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`dc-app ${designConceptFontVariables}`}>
      <noscript>
        {/* Entry motion is JS-driven; without it every reveal stays visible. */}
        <style>{`[data-dc-reveal]{opacity:1 !important;transform:none !important}`}</style>
      </noscript>
      {children}
    </div>
  );
}
