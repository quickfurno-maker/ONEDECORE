"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  HOME_CLAIMS,
  HOME_CLAIM_COPY,
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

function useCountUp(
  target: number,
  active: boolean,
  options?: { readonly decimals?: number }
): number {
  const reduced = usePrefersReducedMotion();
  const decimals = options?.decimals ?? 0;
  // Seed with the approved claim so SSR / no-JS / pre-hydration never renders a
  // zeroed metric. The count-up starts from 0 on the first animation frame.
  const [value, setValue] = useState(target);
  const finished = useRef(false);

  useEffect(() => {
    if (!active || finished.current || reduced) return;

    const startAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / DURATION_MS);
      const eased = easeOutCubic(progress);
      const raw = target * eased;
      setValue(decimals ? Math.round(raw * 10) / 10 : Math.floor(raw));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setValue(target);
        finished.current = true;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, decimals, reduced, target]);

  if (reduced) return target;
  return value;
}

function formatProjects(value: number): string {
  return `${value}+`;
}

function formatRating(value: number): string {
  return `${value.toFixed(1)}/5`;
}

/**
 * Premium animated trust bar — hero metrics with one-shot counter motion.
 *
 * The two counters animate a projects total and a star rating. Neither figure
 * is publicly evidenced, so neither cell renders: a number that counts itself
 * up to 500 is a more emphatic version of the same unsourced claim, not a
 * softer one. The in-house manufacturing badge stays — it states how the
 * business operates rather than measuring an outcome — and the bar keeps its
 * place in the hero with a qualitative cell alongside it.
 */
export function DiscoveryHeroTrustBar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const showProjects = canQuotePublicClaim("projects-delivered");
  const showRating = canQuotePublicClaim("average-rating");
  // The hooks run unconditionally — React requires it — but their output is
  // only rendered when the claim behind it may be quoted.
  const projects = useCountUp(HOME_CLAIMS.projectsDelivered, active);
  const rating = useCountUp(HOME_CLAIMS.rating, active, { decimals: 1 });

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
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="od-disc-trust-bar"
      data-active={active ? "" : undefined}
      role="group"
      aria-label="ONEDECORE trust metrics"
    >
      {showProjects ? (
        <div className="od-disc-trust-bar__cell">
          <span className="od-disc-trust-bar__value" aria-hidden="true">
            {formatProjects(projects)}
          </span>
          <span className="od-sr-only">
            {HOME_CLAIMS.projectsDelivered}+ Projects Delivered
          </span>
          <span className="od-disc-trust-bar__label">Projects Delivered</span>
        </div>
      ) : (
        <div className="od-disc-trust-bar__cell od-disc-trust-bar__cell--badge">
          <span className="od-disc-trust-bar__kicker">End to end</span>
          <span
            className="od-disc-trust-bar__value od-disc-trust-bar__value--text"
            aria-hidden="true"
          >
            Design To Installation
          </span>
          <span className="od-sr-only">
            Design to installation handled end to end
          </span>
        </div>
      )}

      {showRating ? (
        <div className="od-disc-trust-bar__cell">
          <span className="od-disc-trust-bar__value" aria-hidden="true">
            {formatRating(rating)}
          </span>
          <span className="od-sr-only">
            {HOME_CLAIMS.rating}/5 Average Rating
          </span>
          <span className="od-disc-trust-bar__label">Average Rating</span>
        </div>
      ) : null}

      <div className="od-disc-trust-bar__cell od-disc-trust-bar__cell--badge">
        <span className="od-disc-trust-bar__kicker">In-house</span>
        <span className="od-disc-trust-bar__value od-disc-trust-bar__value--text" aria-hidden="true">
          {HOME_CLAIM_COPY.manufacturing}
        </span>
        <span className="od-sr-only">{HOME_CLAIM_COPY.manufacturing}</span>
      </div>
    </div>
  );
}
