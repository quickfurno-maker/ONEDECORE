import Link from "next/link";

type WordmarkSize = "nav" | "drawer" | "footer";

interface OneDecoreWordmarkProps {
  readonly href?: string;
  readonly size?: WordmarkSize;
  readonly className?: string;
}

/**
 * Reusable ONEDECORE lockup — split-weight Raleway wordmark with gold rule.
 * Name, descriptor and identity remain ONEDECORE only.
 */
export function OneDecoreWordmark({
  href = "/",
  size = "nav",
  className,
}: OneDecoreWordmarkProps) {
  const classes = ["od-wordmark", className].filter(Boolean).join(" ");

  return (
    <Link
      href={href}
      className={classes}
      data-size={size}
      aria-label="ONEDECORE — Made for Pune. Home"
    >
      <span className="od-wordmark__row" aria-hidden="true">
        <span className="od-wordmark__one">ONE</span>
        <span className="od-wordmark__decore">DECORE</span>
      </span>
      <span className="od-wordmark__meta" aria-hidden="true">
        <span className="od-wordmark__rule" />
        <span className="od-wordmark__tag">MADE FOR PUNE</span>
      </span>
    </Link>
  );
}
