import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  readonly children: ReactNode;
  readonly className?: string;
  /** Stagger position within a group; multiplied by the concept step delay. */
  readonly order?: number;
  readonly as?: "div" | "li" | "article" | "section" | "header" | "figure";
  readonly style?: CSSProperties;
  readonly id?: string;
}

/**
 * Marks a subtree for entry motion. The runtime toggles `data-dc-shown`; CSS
 * owns the transition. Without JavaScript the `<noscript>` rule in the layout
 * keeps everything visible, and reduced-motion users skip the transition
 * entirely.
 */
export function Reveal({
  children,
  className,
  order = 0,
  as: Tag = "div",
  style,
  id,
}: RevealProps) {
  return (
    <Tag
      id={id}
      className={className}
      data-dc-reveal=""
      style={{ ...style, "--dc-reveal-order": order } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
