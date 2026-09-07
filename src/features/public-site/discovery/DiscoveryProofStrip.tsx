"use client";

import Link from "next/link";
import { useCountUp } from "@/features/public-site/motion/useCountUp";
import { isClaimDisplayable } from "@/features/legal/claim-evidence";
import { DISCOVERY_PROOF_METRICS, DISCOVERY_PROOF_FOOTNOTE } from "./discovery-copy";

/**
 * The proof strip, immediately below the hero.
 *
 * WHAT IT IS ALLOWED TO SAY
 *
 * Every figure here is gated on `isClaimDisplayable`, which is satisfied either
 * by verified evidence or by a recorded owner attestation — never by a number
 * being convenient. All four are attested rather than evidenced today, and a
 * metric whose attestation were withdrawn would simply stop rendering. Nothing
 * is hardcoded past the gate.
 *
 * THE SUFFIX IS PART OF THE VALUE
 *
 * "500+" and "100%" are one string, not a number beside a decoration: React
 * splits adjacent text nodes with comment markers, which lets "500" and "+"
 * wrap onto separate lines and breaks a plain text search of the page.
 *
 * The screen-reader text is the FINAL figure and is never animated. A count-up
 * announced to a screen reader is a stream of meaningless numbers.
 */
function ProofMetric({
  prefix,
  value,
  suffix,
  label,
  termsHref,
  termsLabel,
}: {
  readonly prefix: string;
  readonly value: number;
  readonly suffix: string;
  readonly label: string;
  readonly termsHref?: string;
  readonly termsLabel?: string;
}) {
  const { value: shown, ref } = useCountUp(value);

  /*
   * The prefix and suffix are NOT animated — only the number is. "Up to 0 Years"
   * counting to "Up to 10 Years" reads as a number filling in; animating the
   * words around it would read as a glitch.
   *
   * The whole figure is one string rather than three spans: React separates
   * adjacent text nodes with comment markers, which lets "45" and " Days" wrap
   * onto different lines and breaks a plain text search of the page.
   */
  return (
    <li className="od-disc-proof__item" ref={ref}>
      <span className="od-disc-proof__value" aria-hidden="true">
        {`${prefix}${shown}${suffix}`}
      </span>
      <span className="od-disc-proof__label" aria-hidden="true">
        {label}
        {termsHref && termsLabel ? (
          <>
            {" "}
            <Link className="od-disc-proof__terms" href={termsHref}>
              {termsLabel}
            </Link>
          </>
        ) : null}
      </span>
      <span className="od-sr-only">{`${prefix}${value}${suffix} ${label}`}</span>
    </li>
  );
}

export function DiscoveryProofStrip() {
  const metrics = DISCOVERY_PROOF_METRICS.filter((metric) =>
    isClaimDisplayable(metric.claimId)
  );

  if (metrics.length === 0) {
    return null;
  }

  return (
    <section
      className="od-disc-proof"
      data-od-disc-section="proof"
      aria-label="ONEDECORE at a glance"
    >
      <div className="od-disc-shell">
        <ul className="od-disc-proof__grid" data-od-proof-strip="">
          {metrics.map((metric) => (
            <ProofMetric
              key={metric.claimId}
              prefix={metric.prefix}
              value={metric.value}
              suffix={metric.suffix}
              label={metric.label}
              termsHref={"termsHref" in metric ? metric.termsHref : undefined}
              termsLabel={"termsLabel" in metric ? metric.termsLabel : undefined}
            />
          ))}
        </ul>
        <p className="od-disc-proof__footnote">{DISCOVERY_PROOF_FOOTNOTE}</p>
      </div>
    </section>
  );
}
