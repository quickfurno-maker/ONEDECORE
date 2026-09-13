import Link from "next/link";
import type { InboxConversationDetail } from "../../contracts/conversation-dtos.ts";
import type { ServiceWindowView } from "../../contracts/message-presentation.ts";

/**
 * Customer and CRM context, beside the conversation.
 *
 * HOW THE LEAD FIELDS GET HERE.
 *
 * Not by querying the leads table from this feature. The page asks
 * `getLeadDetailForCurrentUser(leadId)`, which applies the CRM access context
 * and returns null when the signed-in member of staff may not read that lead.
 * So a WhatsApp conversation cannot become a side door into CRM data: someone
 * who can answer a message but not open the lead sees the conversation and no
 * lead fields, exactly as they would in the CRM itself.
 *
 * WHAT IS NOT SHOWN.
 *
 * Internal identifiers. The conversation id, the lead id, the contact id and
 * the provider's phone-number id are all plumbing; staff work from the name and
 * the number. The lead id travels inside the "Open lead" href and nowhere else
 * on screen.
 */

export interface ConversationLeadSummary {
  readonly leadId: string;
  readonly name: string;
  readonly status: string | null;
  readonly service: string | null;
  readonly scope: string | null;
  readonly budget: string | null;
  readonly timeline: string | null;
  readonly locality: string | null;
}

interface ConversationDetailsPanelProps {
  readonly detail: InboxConversationDetail;
  readonly serviceWindow: ServiceWindowView;
  /** Null when unlinked, or when this user may not read the linked lead. */
  readonly lead: ConversationLeadSummary | null;
  /** True when a lead is linked but CRM access was refused. */
  readonly leadHidden?: boolean;
}

const STAMP = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function stamp(value: string | null): string {
  if (!value) return "—";
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "—" : STAMP.format(at);
}

function Row({ label, value }: { readonly label: string; readonly value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="od-wa__dt">{label}</dt>
      <dd className="od-wa__dd">{value}</dd>
    </div>
  );
}

export function ConversationDetailsPanel({
  detail,
  serviceWindow,
  lead,
  leadHidden = false,
}: ConversationDetailsPanelProps) {
  return (
    <div className="od-wa__scroll" data-testid="whatsapp-details-panel">
      <section className="od-wa__section">
        <h2 className="od-wa__panel-label">Customer</h2>
        <dl className="od-wa__dl">
          <Row label="Name" value={detail.displayNameSnapshot ?? "Not provided"} />
          <div>
            <dt className="od-wa__dt">WhatsApp number</dt>
            <dd className="od-wa__dd">
              <a href={`tel:${detail.customerE164}`}>{detail.customerE164}</a>
            </dd>
          </div>
          <Row label="Last message" value={stamp(detail.lastMessageAt)} />
          <Row label="Last customer message" value={stamp(detail.lastInboundAt)} />
          <div>
            <dt className="od-wa__dt">Reply window</dt>
            <dd className="od-wa__dd">{serviceWindow.label}</dd>
          </div>
        </dl>
      </section>

      <section className="od-wa__section">
        <h2 className="od-wa__panel-label">CRM</h2>

        {lead ? (
          <>
            <dl className="od-wa__dl">
              <Row label="Lead" value={lead.name} />
              <Row label="Status" value={lead.status} />
              <Row label="Service" value={lead.service} />
              <Row label="Scope" value={lead.scope} />
              <Row label="Budget" value={lead.budget} />
              <Row label="Timeline" value={lead.timeline} />
              <Row label="Locality" value={lead.locality} />
            </dl>
            <Link
              href={`/admin/crm/leads/${lead.leadId}`}
              className="od-wa__btn"
              style={{ marginBlockStart: 12, width: "100%" }}
            >
              Open lead in CRM
            </Link>
          </>
        ) : leadHidden ? (
          /*
           * A lead IS linked, but this user cannot read it. Saying so is
           * better than an empty panel that reads like missing data — and it
           * still discloses nothing about the lead itself.
           */
          <p className="od-wa__empty-note" style={{ marginBlockStart: 10 }}>
            This conversation is linked to a CRM lead you do not have access to.
          </p>
        ) : (
          <p className="od-wa__empty-note" style={{ marginBlockStart: 10 }}>
            Not linked to a CRM lead. Unlinked conversations are handled by
            managers from the triage filter.
          </p>
        )}
      </section>
    </div>
  );
}
