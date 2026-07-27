import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface PrimaryButtonProps extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  href: string;
  children: ReactNode;
  variant?: "default" | "on-dark";
  disabled?: boolean;
}

export function PrimaryButton({
  href,
  children,
  variant = "default",
  disabled = false,
  className,
  ...props
}: PrimaryButtonProps) {
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center px-6 py-3",
    "ps-font-body text-sm font-semibold tracking-wide",
    "rounded-[var(--radius-sm)] border border-transparent",
    "transition-colors duration-[var(--duration-fast)]",
    variant === "default" && [
      "bg-[var(--color-accent)] text-white",
      "hover:bg-[var(--color-accent-hover)]",
      "active:bg-[var(--color-accent-pressed)]",
    ],
    variant === "on-dark" && [
      "bg-[var(--color-dark-section-text)] text-[var(--color-dark-section)]",
      "hover:bg-[var(--color-surface)]",
    ],
    disabled && "pointer-events-none opacity-50",
    className
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled="true" {...props}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
