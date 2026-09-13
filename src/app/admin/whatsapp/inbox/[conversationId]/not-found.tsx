import Link from "next/link";
import "@/features/whatsapp/components/whatsapp-workspace.css";

/**
 * Reached for a conversation that does not exist AND for one this reader is
 * not allowed to open — `page.tsx` calls `notFound()` in both cases, on
 * purpose. Telling someone "that exists but is not yours" confirms a customer
 * is in the system, which is precisely what the scope rule is there to stop.
 *
 * The wording therefore covers both without claiming to know which.
 */
export default function WhatsappConversationNotFound() {
  return (
    <section className="od-wa__state">
      <h1 className="od-wa__state-title">Conversation not available</h1>
      <p className="od-wa__state-note">
        This conversation either does not exist or is outside the part of the
        inbox you can see. If you expected access to it, ask a manager to
        assign the lead to you.
      </p>
      <div className="od-wa__state-actions">
        <Link className="od-wa__btn" href="/admin/whatsapp/inbox">
          Back to the inbox
        </Link>
      </div>
    </section>
  );
}
