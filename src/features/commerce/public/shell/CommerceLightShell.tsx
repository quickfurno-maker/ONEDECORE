import type { ReactNode } from "react";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { CommerceFooter } from "./CommerceFooter.tsx";
import { CommerceHeader } from "./CommerceHeader.tsx";
import { CommerceUtilityBar } from "./CommerceUtilityBar.tsx";
import type { CommerceNavNode } from "./commerce-nav.ts";
import "./commerce-light-theme.css";
import "./commerce-shell.css";
import "./commerce-retail.css";
import "./commerce-surfaces.css";

/**
 * Server-rendered premium light retail shell for /shop.
 *
 * Deliberately separate from PublicDarkShell: the dark shell continues to own
 * home, interiors and portfolio, and this shell owns commerce. The
 * `data-commerce-light` attribute is the only scope the light palette uses.
 */
export function CommerceLightShell({
  children,
  nodes,
}: {
  readonly children: ReactNode;
  readonly nodes: readonly CommerceNavNode[];
}) {
  return (
    <div className={`${publicSiteFontVariables} odc-shell`} data-commerce-light="">
      <a className="odc-skip" href="#commerce-content">
        Skip to content
      </a>
      <CommerceUtilityBar />
      <CommerceHeader nodes={nodes} />
      <div id="commerce-content" className="odc-shell__main" tabIndex={-1}>
        {children}
      </div>
      <CommerceFooter nodes={nodes} />
    </div>
  );
}
