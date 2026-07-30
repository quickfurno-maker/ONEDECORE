"use client";

import {
  useCallback,
  useRef,
  type KeyboardEvent,
  type RefCallback,
} from "react";

/**
 * Automatic-activation roving tabindex for ARIA tablists.
 * Focus moves synchronously with selection; no package, no global selectors.
 */
export function useRovingTabs(
  count: number,
  activeIndex: number,
  setActiveIndex: (index: number) => void
) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const setTabRef = useCallback(
    (index: number): RefCallback<HTMLButtonElement> =>
      (node) => {
        refs.current[index] = node;
      },
    []
  );

  const activate = useCallback(
    (index: number) => {
      if (count <= 0) return;
      const next = ((index % count) + count) % count;
      setActiveIndex(next);
      refs.current[next]?.focus();
    },
    [count, setActiveIndex]
  );

  const onTabListKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (count <= 0) return;
      let next = activeIndex;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          next = (activeIndex + 1) % count;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          next = (activeIndex - 1 + count) % count;
          break;
        case "Home":
          event.preventDefault();
          next = 0;
          break;
        case "End":
          event.preventDefault();
          next = count - 1;
          break;
        default:
          return;
      }
      activate(next);
    },
    [activate, activeIndex, count]
  );

  return { setTabRef, onTabListKeyDown, activate };
}
