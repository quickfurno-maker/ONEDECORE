"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { cn } from "../../utils/cn";

export const HERO_MEDIA_MOTION_MARKER = "public-site-hero-media-motion" as const;

export interface HeroMediaMotionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Client island for hero media scale reveal only.
 * Copy remains server-rendered; reduced motion and mobile skip scale.
 */
export function HeroMediaMotion({ children, className }: HeroMediaMotionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      data-hero-media={HERO_MEDIA_MOTION_MARKER}
      data-hero-motion={reducedMotion ? "static" : "enabled"}
      className={cn(
        "ps-hero__media",
        !reducedMotion && "ps-hero__media--motion",
        className
      )}
    >
      {children}
    </div>
  );
}
