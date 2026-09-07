"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  HOME_CLAIMS,
  canQuotePublicClaim,
} from "@/features/public-site/home-r4/claims";

const DURATION_MS = 1200;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}

/**
 * The projects-delivered counter, restored below the hero.
 *
 * WHY THIS ONE FIGURE AND NO OTHER
 *
 * The owner attested to the project count specifically. It is displayable
 * because `PUBLIC_CLAIM_EVIDENCE["projects-delivered"].ownerAttestedDisplay` is
 * recorded — NOT because it became evidenced. The rating, the review count, the
 * satisfaction percentage and the warranty duration were not attested and stay
 * withheld; this component asks the same gate they do and would render nothing
 * if the attestation were withdrawn.
 *
 * THE SEED VALUE MATTERS
 *
 * `useState(target)` rather than `useState(0)`: the server render, every
 * pre-hydration paint and every no-JS visitor must see the real figure. A zero
 * seed would ship "0+ Projects Delivered" to exactly the visitors least able to
 * wait for JavaScript. The count-up starts from 0 on the first animation frame
 * once the strip enters the viewport, and reduced motion skips it entirely.
 */
export function DiscoveryProjectsCounter() {
  // Widened from the literal type so the count-up can hold intermediate values.
  const target: number = HOME_CLAIMS.projectsDelivered;
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLParagraphElement>(null);
  const [value, setValue] = useState<number>(target);
  const [active, setActive] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active || finished.current || reduced) return;
    const startAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / DURATION_MS);
      setValue(Math.floor(target * easeOutCubic(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setValue(target);
        finished.current = true;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reduced, target]);

  if (!canQuotePublicClaim("projects-delivered")) {
    return null;
  }

  return (
    <p
      ref={rootRef}
      className="od-disc-projects"
      data-od-projects-counter=""
      data-active={active ? "" : undefined}
    >
      {/*
        * One expression, not `{value}+`: React splits adjacent text nodes with
        * a comment marker, which would let "500" and "+" wrap onto separate
        * lines and defeats a plain text search of the rendered page.
        */}
      <span className="od-disc-projects__value" aria-hidden="true">
        {`${reduced ? target : value}+`}
      </span>
      <span className="od-disc-projects__label" aria-hidden="true">
        Projects Delivered
      </span>
      <span className="od-sr-only">{`${target}+ Projects Delivered`}</span>
    </p>
  );
}
