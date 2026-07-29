export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToHomeSection(id: string, focusSelector?: string): void {
  const target = document.getElementById(id);
  if (!target) return;

  const reduced = prefersReducedMotion();
  target.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "start",
  });

  const focusTarget = () => {
    if (focusSelector) {
      target.querySelector<HTMLElement>(focusSelector)?.focus();
      return;
    }
    if (target.tabIndex >= 0 || target.hasAttribute("tabindex")) {
      target.focus();
    }
  };

  if (reduced) {
    focusTarget();
  } else {
    requestAnimationFrame(focusTarget);
  }
}
