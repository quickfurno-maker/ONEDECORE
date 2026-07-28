"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Slim document scroll progress. Progressive enhancement only — no continuous idle rAF.
 */
export function HomeScrollProgress() {
  const [value, setValue] = useState(0);
  const frameRef = useRef(0);
  const pendingRef = useRef(false);

  useEffect(() => {
    const update = () => {
      pendingRef.current = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const next = max <= 0 ? 0 : Math.round((window.scrollY / max) * 100);
      setValue(Math.min(100, Math.max(0, next)));
    };

    const onScroll = () => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      frameRef.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div
      className="pm-scroll-progress"
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span
        className="pm-scroll-progress__fill"
        style={{ transform: `scaleX(${value / 100})` }}
        aria-hidden="true"
      />
    </div>
  );
}
