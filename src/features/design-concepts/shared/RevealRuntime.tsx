"use client";

import { useEffect } from "react";

/**
 * One IntersectionObserver per concept page drives every entry reveal.
 *
 * Reduced-motion visitors, and browsers without IntersectionObserver, get the
 * finished state applied synchronously instead of any transition.
 */
export function RevealRuntime() {
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-dc-reveal]")
    );
    if (nodes.length === 0) return;

    const showAll = () => {
      for (const node of nodes) node.setAttribute("data-dc-shown", "");
    };

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-dc-shown", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    for (const node of nodes) observer.observe(node);

    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        observer.disconnect();
        showAll();
      }
    };
    prefersReducedMotion.addEventListener("change", onPreferenceChange);

    return () => {
      observer.disconnect();
      prefersReducedMotion.removeEventListener("change", onPreferenceChange);
    };
  }, []);

  return null;
}
