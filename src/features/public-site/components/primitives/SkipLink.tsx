import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn";

export interface SkipLinkProps extends ComponentPropsWithoutRef<"a"> {
  targetId?: string;
}

export function SkipLink({ targetId = "main-content", className, children, ...props }: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} className={cn("ps-skip-link", className)} {...props}>
      {children ?? "Skip to main content"}
    </a>
  );
}
