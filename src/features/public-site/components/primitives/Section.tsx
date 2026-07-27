import type { HTMLAttributes, ReactNode } from "react";
import type { SectionSpacing, SectionSurface } from "../../tokens";
import { cn } from "../../utils/cn";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: "section" | "div" | "article";
  surface?: SectionSurface;
  spacing?: SectionSpacing;
}

const SURFACE_CLASSES: Record<SectionSurface, string> = {
  default: "",
  stone: "ps-surface-stone",
  dark: "ps-surface-dark",
};

const SPACING_CLASSES: Record<SectionSpacing, string> = {
  default: "py-[var(--space-16)] md:py-[var(--space-24)] xl:py-[var(--space-32)]",
  compact: "py-[var(--space-12)] md:py-[var(--space-16)]",
  none: "",
};

export function Section({
  children,
  as: Component = "section",
  surface = "default",
  spacing = "default",
  className,
  ...props
}: SectionProps) {
  return (
    <Component
      className={cn(SURFACE_CLASSES[surface], SPACING_CLASSES[spacing], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
