"use client";

import Link from "next/link";
import "@/features/whatsapp/components/whatsapp-workspace.css";

/**
 * The inbox failed to load.
 *
 * WHAT IT PRINTS, AND WHY THAT IS SAFE.
 *
 * `error.message` for anything thrown in a Server Component is replaced by
 * Next with a generic sentence and a digest before it reaches the browser, so
 * a Postgres string or a connection URL cannot arrive here in production. In
 * development the real message comes through, which is the point of running in
 * development. The digest is shown because it is the only handle that ties
 * what someone saw on screen to a line in the server log.
 */

interface WhatsappInboxErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function WhatsappInboxError({
  error,
  reset,
}: WhatsappInboxErrorProps) {
  return (
    <section className="od-wa__state" role="alert">
      <h1 className="od-wa__state-title">Could not load the inbox</h1>
      <p className="od-wa__state-note">
        Nothing has been lost and no message was sent. Try again, and if it
        keeps failing, report the reference below.
      </p>

      {error.message ? (
        <p className="od-wa__state-detail">
          {error.message}
          {error.digest ? (
            <>
              <br />
              Reference: {error.digest}
            </>
          ) : null}
        </p>
      ) : null}

      <div className="od-wa__state-actions">
        <button type="button" className="od-wa__btn" onClick={reset}>
          Try again
        </button>
        <Link className="od-wa__btn" href="/admin">
          Back to admin
        </Link>
      </div>
    </section>
  );
}
