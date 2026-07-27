import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";

export interface EditorialSectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  overline?: string;
  description?: string;
  as?: HeadingLevel;
  align?: "left" | "center";
}

const HEADING_TYPE_CLASS: Record<HeadingLevel, string> = {
  h1: "ps-type-heading-1",
  h2: "ps-type-heading-2",
  h3: "ps-type-heading-3",
  h4: "ps-type-body-lg ps-font-display font-medium",
};

export function EditorialSectionHeading({
  title,
  overline,
  description,
  as: HeadingTag = "h2",
  align = "left",
  className,
  ...props
}: EditorialSectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[var(--space-4)]",
        align === "center" && "items-center text-center",
        className
      )}
      {...props}
    >
      {overline ? <p className="ps-type-overline">{overline}</p> : null}
      <HeadingTag className={cn(HEADING_TYPE_CLASS[HeadingTag], "text-[var(--color-text-primary)]")}>
        {title}
      </HeadingTag>
      {description ? (
        <p className={cn("ps-type-body text-[var(--color-text-muted)]", align === "center" && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
