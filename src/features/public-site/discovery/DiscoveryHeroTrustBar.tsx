"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HOME_CLAIMS, HOME_CLAIM_COPY } from "@/features/public-site/home-r4/claims";

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
  const [value, setValue] = useState(0);
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

/** Premium animated trust bar — hero metrics with one-shot counter motion. */
export function DiscoveryHeroTrustBar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
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
      <div className="od-disc-trust-bar__cell">
        <span className="od-disc-trust-bar__value" aria-hidden="true">
          {formatProjects(projects)}
        </span>
        <span className="od-sr-only">
          {HOME_CLAIMS.projectsDelivered}+ Projects Delivered
        </span>
        <span className="od-disc-trust-bar__label">Projects Delivered</span>
      </div>

      <div className="od-disc-trust-bar__cell">
        <span className="od-disc-trust-bar__value" aria-hidden="true">
          {formatRating(rating)}
        </span>
        <span className="od-sr-only">{HOME_CLAIMS.rating}/5 Average Rating</span>
        <span className="od-disc-trust-bar__label">Average Rating</span>
      </div>

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
