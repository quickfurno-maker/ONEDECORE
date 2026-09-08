"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const DEFAULT_DURATION_MS = 1200;

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

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
}

/**
 * One count-up, shared by every metric on the page.
 *
 * WHY THE SEED IS THE TARGET, NOT ZERO
 *
 * The server render, every pre-hydration paint and every visitor without
 * JavaScript must see the REAL figure. Seeding at 0 would ship "0+ Projects
 * Delivered" to exactly the people least able to wait for a bundle. The
 * animation starts from 0 only once the element is actually in view, and it
 * runs ONCE — `finished` is never reset, so scrolling back up does not replay
 * it.
 *
 * Reduced motion skips the animation entirely rather than shortening it: the
 * final value is what the visitor asked to see, immediately.
 */
export function useCountUp(
  target: number,
  durationMs: number = DEFAULT_DURATION_MS
): { readonly value: number; readonly ref: (node: Element | null) => void } {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState<number>(target);
  const [node, setNode] = useState<Element | null>(null);
  const [active, setActive] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    if (!node || finished.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  useEffect(() => {
    if (!active || finished.current || reduced) return;
    const startAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / durationMs);
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
  }, [active, reduced, target, durationMs]);

  return { value: reduced ? target : value, ref: setNode };
}
