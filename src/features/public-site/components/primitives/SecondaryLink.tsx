import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface SecondaryLinkProps extends ComponentPropsWithoutRef<typeof Link> {
  children: ReactNode;
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SecondaryLink({ children, className, ...props }: SecondaryLinkProps) {
  return (
    <Link
      className={cn(
        "group inline-flex min-h-11 items-center gap-2",
        "ps-font-body text-sm font-medium text-[var(--color-text-primary)]",
        "underline-offset-4 hover:underline",
        "transition-colors duration-[var(--duration-fast)]",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ArrowIcon />
    </Link>
  );
}
