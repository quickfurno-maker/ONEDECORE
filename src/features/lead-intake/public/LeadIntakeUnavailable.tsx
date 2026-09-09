"use client";

import { getPublicWhatsAppHref } from "../../public-site/chrome/public-contact";

/**
 * What a visitor sees when the server cannot take a lead.
 *
 * NO EDITABLE FIELDS. NOT ONE.
 *
 * The failure this replaces was not a crash — it was a form that looked
 * perfectly normal, accepted four steps of a real person's answers, and had
 * nowhere to send them. Rendering a disabled or greyed-out version of the same
 * flow would repeat that: people fill in disabled forms, and hope is worse than
 * a clear no.
 *
 * WHAT IT DOES NOT SAY
 *
 * Why. "Service role key missing" or "activation gate incomplete" is an
 * operator's problem and an attacker's map. The visitor gets one honest
 * sentence and a way to reach the business anyway.
 *
 * THE CONTACT ROUTE IS CONFIGURED OR ABSENT
 *
 * The WhatsApp action appears only when a real, validated OneDecore number is
 * configured. There is no fallback number, no placeholder, no "call us on
 * ...". A fabricated contact detail on an error screen is worse than the error.
 */
export function LeadIntakeUnavailable({
  onClose,
}: {
  readonly onClose?: () => void;
}) {
  const whatsappHref = getPublicWhatsAppHref();

  return (
    <div
      className="pm-planner__form"
      role="alert"
      data-od-lead-unavailable=""
    >
      <header className="pm-planner__head">
        <div>
          <p className="pm-planner__title">
            Online enquiry is temporarily unavailable
          </p>
          <p className="pm-planner__hint">
            We could not open the consultation form just now. Nothing you type
            here would reach us, so we would rather not ask.
          </p>
        </div>
      </header>

      <p className="pm-planner__reassurance">
        Please contact ONEDECORE directly, or try again shortly.
      </p>

      <div className="pm-planner__actions">
        {onClose ? (
          <button
            type="button"
            className="dc-btn dc-btn--ghost"
            onClick={onClose}
          >
            Close
          </button>
        ) : (
          <span />
        )}

        {whatsappHref ? (
          <a
            className="dc-btn dc-btn--primary"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            data-conversion-action="whatsapp-unavailable-fallback"
          >
            Message us on WhatsApp
          </a>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
