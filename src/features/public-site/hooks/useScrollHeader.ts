"use client";

import { useEffect, useState } from "react";
import { HEADER_SCROLL_THRESHOLD_PX } from "../config/public-navigation";

/**
 * Passive scroll listener for header solid state.
 * Returns true when scrollY exceeds the frozen threshold.
 */
export function useScrollHeader(threshold = HEADER_SCROLL_THRESHOLD_PX): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const readScroll = () => {
      const next = window.scrollY > threshold;
      setScrolled((prev) => (prev === next ? prev : next));
    };

    readScroll();
    window.addEventListener("scroll", readScroll, { passive: true });
    return () => window.removeEventListener("scroll", readScroll);
  }, [threshold]);

  return scrolled;
}
