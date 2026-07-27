"use client";

import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { PUBLIC_SITE_MOTION } from "../../tokens";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export const REVEAL_CLIENT_MARKER = "public-site-reveal-client" as const;

export interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delayMs?: number;
}

function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

/**
 * Progressive-enhancement reveal:
 * - SSR / no-JS: content remains fully visible (no prep class).
 * - Reduced motion: no observer; content stays visible.
 * - Motion enabled: below-fold elements animate in via IO; above-fold revealed immediately.
 */
export function Reveal({
  children,
  delayMs = 0,
  className,
  style,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;

    const reveal = () => {
      element.classList.remove("ps-reveal-prep");
      element.classList.add("ps-reveal-visible");
      element.dataset.revealState = "visible";
    };

    if (isInViewport(element)) {
      reveal();
      return;
    }

    element.classList.add("ps-reveal-prep");
    element.dataset.revealState = "prep";

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: PUBLIC_SITE_MOTION.ioThreshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      data-reveal={REVEAL_CLIENT_MARKER}
      data-reveal-state={reducedMotion ? "static" : "idle"}
      className={className}
      style={{
        ...style,
        transitionDelay: delayMs > 0 ? `${delayMs}ms` : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
