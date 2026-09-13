import Link from "next/link";
import "../whatsapp-workspace.css";

/**
 * A staff account that can reach /admin but not the inbox.
 *
 * It says who to ask. A permission wall that only states the refusal leaves
 * the reader with no next move, and the next move here is always the same
 * one: a manager grants inbox access, or assigns them the lead.
 */
export function WhatsappAccessDenied() {
  return (
    <section
      className="od-wa__state"
      aria-labelledby="whatsapp-access-denied-heading"
    >
      <h1 id="whatsapp-access-denied-heading" className="od-wa__state-title">
        You do not have WhatsApp inbox access
      </h1>
      <p className="od-wa__state-note">
        Your account can sign in to the admin portal, but WhatsApp conversations
        are limited to staff with inbox permission. A manager can grant it.
      </p>
      <div className="od-wa__state-actions">
        <Link className="od-wa__btn" href="/admin">
          Back to admin
        </Link>
      </div>
    </section>
  );
}
