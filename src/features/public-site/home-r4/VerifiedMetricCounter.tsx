"use client";

import { useEffect, useRef, useState } from "react";

interface VerifiedMetricCounterProps {
  readonly value: number;
  readonly label: string;
  readonly suffix?: string;
  readonly durationMs?: number;
  readonly delayMs?: number;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Count-up metric — SSR final accessible value; aria-hidden visual
 * counts from 0 once in view (2000ms ease-out cubic, ~200ms delay, IO 0.4).
 */
export function VerifiedMetricCounter({
  value,
  label,
  suffix = "",
  durationMs = 2000,
  delayMs = 200,
}: VerifiedMetricCounterProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const ranRef = useRef(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || ranRef.current) return;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      ranRef.current = true;
      return;
    }

    let frame = 0;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || ranRef.current) return;
        ranRef.current = true;
        observer.disconnect();

        delayTimer = setTimeout(() => {
          if (cancelled) return;
          setDisplay(0);
          const start = performance.now();

          const tick = (now: number) => {
            if (cancelled) return;
            const t = Math.min(1, (now - start) / durationMs);
            setDisplay(Math.round(easeOutCubic(t) * value));
            if (t < 1) {
              frame = requestAnimationFrame(tick);
            } else {
              setDisplay(value);
            }
          };

          frame = requestAnimationFrame(tick);
        }, delayMs);
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (delayTimer) clearTimeout(delayTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [delayMs, durationMs, value]);

  const finalText = `${value}${suffix}`;

  return (
    <div ref={rootRef} className="pm-metric">
      <p className="pm-metric__sr">
        {finalText} {label}
      </p>
      <p className="pm-metric__value" aria-hidden="true">
        {display}
        {suffix}
      </p>
      <p className="pm-metric__label" aria-hidden="true">
        {label}
      </p>
    </div>
  );
}
