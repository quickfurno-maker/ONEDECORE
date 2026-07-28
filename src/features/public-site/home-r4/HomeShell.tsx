import type { ReactNode } from "react";
import { HomeFooter } from "./HomeFooter";
import { HomeNavigation } from "./HomeNavigation";
import { HomePlannerSheet } from "./HomePlanner";
import { HomeScrollProgress } from "./HomeScrollProgress";
import { HomeStickyActions } from "./HomeStickyActions";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";

const MAIN_ID = "pm-main";

/** Production homepage chrome: skip link, nav, main, sticky, footer, planner sheet. */
export function HomeShell({ children }: { readonly children: ReactNode }) {
  return (
    <div data-public-home-r4="">
      <HomeScrollProgress />
      <a className="dc-skip" href={`#${MAIN_ID}`}>
        Skip to content
      </a>

      <HomeNavigation />

      <main id={MAIN_ID} tabIndex={-1}>
        {children}
      </main>

      <HomeStickyActions />
      <HomeFooter />
      <HomePlannerSheet />
      <RevealRuntime />
    </div>
  );
}
