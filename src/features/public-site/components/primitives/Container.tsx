import type { HTMLAttributes, ReactNode } from "react";
import type { ContainerWidth } from "../../tokens";
import { cn } from "../../utils/cn";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  width?: ContainerWidth;
}

const WIDTH_CLASSES: Record<ContainerWidth, string> = {
  content: "max-w-[var(--container-content)]",
  wide: "max-w-[var(--container-wide)]",
  full: "max-w-none",
};

export function Container({
  children,
  width = "content",
  className,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-[var(--gutter-sm)] md:px-[var(--gutter-md)] xl:px-[var(--gutter-lg)]",
        WIDTH_CLASSES[width],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
