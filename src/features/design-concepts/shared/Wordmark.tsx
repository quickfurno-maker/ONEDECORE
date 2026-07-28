import Link from "next/link";

interface WordmarkProps {
  readonly href: string;
  /** Rendered inside the footer at a larger optical size. */
  readonly size?: "nav" | "footer";
}

/**
 * Split-weight ONEDECORE wordmark. Raleway is used here and nowhere else;
 * the weight break between ONE and DECORE is the brand signature.
 */
export function Wordmark({ href, size = "nav" }: WordmarkProps) {
  return (
    <Link href={href} className="dc-wordmark" data-size={size}>
      <span className="dc-wordmark__one">ONE</span>
      <span className="dc-wordmark__decore">DECORE</span>
    </Link>
  );
}

/** Non-interactive wordmark for contexts that already sit inside a link. */
export function WordmarkStatic({ size = "nav" }: { size?: "nav" | "footer" }) {
  return (
    <span className="dc-wordmark" data-size={size}>
      <span className="dc-wordmark__one">ONE</span>
      <span className="dc-wordmark__decore">DECORE</span>
    </span>
  );
}
