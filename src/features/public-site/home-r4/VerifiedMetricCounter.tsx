"use client";

import { useEffect, useRef, useState } from "react";

interface VerifiedMetricCounterProps {
  readonly value: number;
  readonly label: string;
  readonly durationMs?: number;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Server-renders the final value; animates the visual digit once in view.
 * Screen readers use the final value + label; the animated span is aria-hidden.
 */
export function VerifiedMetricCounter({
  value,
  label,
  durationMs = 1500,
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
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || ranRef.current) return;
        ranRef.current = true;
        observer.disconnect();

        const start = performance.now();
        let started = false;

        const tick = (now: number) => {
          if (cancelled) return;
          if (!started) {
            started = true;
            setDisplay(0);
          }
          const t = Math.min(1, (now - start) / durationMs);
          setDisplay(Math.round(easeOutCubic(t) * value));
          if (t < 1) {
            frame = requestAnimationFrame(tick);
          }
        };

        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.45 }
    );

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [durationMs, value]);

  return (
    <div ref={rootRef} className="pm-metric">
      <p className="pm-metric__sr">
        {value} {label}
      </p>
      <p className="pm-metric__value" aria-hidden="true">
        {display}
      </p>
      <p className="pm-metric__label" aria-hidden="true">
        {label}
      </p>
    </div>
  );
}
