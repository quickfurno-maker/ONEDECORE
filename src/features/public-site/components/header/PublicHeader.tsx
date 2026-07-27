"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { HeaderCtaConfig, HeaderVisualMode, NavigationItem } from "../../types/shell";
import { useScrollHeader } from "../../hooks/useScrollHeader";
import { cn } from "../../utils/cn";
import { Container } from "../primitives/Container";
import { PrimaryButton } from "../primitives/PrimaryButton";
import { DesktopNavigation } from "./DesktopNavigation";
import { HeaderBrand } from "./HeaderBrand";
import { MobileNavigation } from "./MobileNavigation";

export interface PublicHeaderProps {
  navigation: readonly NavigationItem[];
  headerMode?: HeaderVisualMode;
  cta?: HeaderCtaConfig | null;
}

export function PublicHeader({
  navigation,
  headerMode = "solid",
  cta = null,
}: PublicHeaderProps) {
  const pathname = usePathname();
  const scrolled = useScrollHeader();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOverlay = headerMode === "overlay";
  const showSolid = !isOverlay || scrolled;
  const onDarkSurface = isOverlay && !scrolled;

  return (
    <header
      className={cn(
        "ps-header",
        isOverlay && "ps-header--overlay",
        showSolid && "ps-header--solid",
        scrolled && isOverlay && "ps-header--scrolled",
        onDarkSurface && "ps-header--on-dark"
      )}
      data-scrolled={scrolled ? "true" : "false"}
    >
      <Container width="wide" className="ps-header__inner">
        <HeaderBrand onDarkSurface={onDarkSurface} />

        <DesktopNavigation
          items={navigation}
          currentPath={pathname}
          className="ps-header__desktop-nav"
        />

        <div className="ps-header__actions">
          {cta ? (
            <PrimaryButton
              href={cta.href}
              variant={onDarkSurface ? "on-dark" : "default"}
              className="ps-header__cta ps-header__cta--desktop"
            >
              {cta.label}
            </PrimaryButton>
          ) : null}

          <MobileNavigation
            items={navigation}
            open={mobileOpen}
            onOpen={() => setMobileOpen(true)}
            onClose={() => setMobileOpen(false)}
            cta={cta}
            onDarkSurface={onDarkSurface}
          />
        </div>
      </Container>
    </header>
  );
}
