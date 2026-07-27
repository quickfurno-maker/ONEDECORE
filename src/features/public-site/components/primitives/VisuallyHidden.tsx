import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function VisuallyHidden({ children, className, ...props }: VisuallyHiddenProps) {
  return (
    <span className={cn("ps-visually-hidden", className)} {...props}>
      {children}
    </span>
  );
}
