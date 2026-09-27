import type { CrmWhatsappMarketingState } from "../../server/crm-whatsapp-evidence-queries.ts";
import {
  MarketingConsentEvidenceForm,
  MarketingOptOutForm,
} from "@/features/whatsapp/components/control-plane/ContactComplianceForms";
import type { CrmWhatsappEngagementSignal } from "../../server/crm-lead-score-batch.ts";
import type { WhatsappLeadConversationSummary } from "@/features/whatsapp/server/whatsapp-crm-integration";

const DATE = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function stamp(value: string | null): string {
  if (!value) return "No customer reply yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE.format(date);
}

function consentLabel(state: CrmWhatsappMarketingState | null): string {
  if (!state) return "Not available";
  if (state.currentGranted) return "Granted";
  if (
    state.latestEventType === "withdrawn" ||
    state.latestEventType === "suppressed" ||
    state.latestEventType === "expired"
  ) {
    return "Not granted";
  }
  return "Not recorded";
}

export function LeadWhatsappIntelligencePanel({
  leadId,
  contactId,
  signal,
  conversation,
  consent,
  canManageConsent,
  canRecordOptOut,
}: {
  readonly leadId: string;
  readonly contactId: string;
  readonly signal: CrmWhatsappEngagementSignal;
  readonly conversation: WhatsappLeadConversationSummary | null;
  readonly consent: CrmWhatsappMarketingState | null;
  readonly canManageConsent: boolean;
  readonly canRecordOptOut: boolean;
}) {
  const conversationId =
    signal.productionConversationId ?? conversation?.conversationId ?? null;

  return (
    <section
      className="crm-surface p-4 sm:p-5"
      data-testid="crm-whatsapp-intelligence-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--crm-muted)]">
            CRM ↔ WhatsApp
          </p>
          <h2 className="mt-1 text-sm font-semibold text-[var(--crm-text)] sm:text-[15px]">
            WhatsApp intelligence & consent
          </h2>
        </div>
        <span
          className={`crm-badge ${
            signal.productionConversationId
              ? "crm-badge-success"
              : "crm-badge-neutral"
          }`}
        >
          {signal.productionConversationId
            ? "Production thread ready"
            : signal.linked
              ? "Linked history"
              : "Not linked"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] gap-x-3 gap-y-2 text-[12px]">
        <dt className="text-[var(--crm-muted)]">Customer WhatsApp reply</dt>
        <dd className="m-0 font-medium text-[var(--crm-text)]">
          {signal.hasCustomerReply ? "Yes" : "No"}
        </dd>
        <dt className="text-[var(--crm-muted)]">Last customer message</dt>
        <dd className="m-0 text-[var(--crm-text-secondary)]">
          {stamp(signal.lastInboundAt)}
        </dd>
        <dt className="text-[var(--crm-muted)]">Marketing consent</dt>
        <dd className="m-0 font-medium text-[var(--crm-text)]">
          {consentLabel(consent)}
        </dd>
        <dt className="text-[var(--crm-muted)]">WhatsApp suppression</dt>
        <dd className="m-0 text-[var(--crm-text-secondary)]">
          {consent?.whatsappSuppressed ? "Suppressed" : "No"}
        </dd>
        <dt className="text-[var(--crm-muted)]">Do not contact</dt>
        <dd className="m-0 text-[var(--crm-text-secondary)]">
          {consent?.dnc ? "Active" : "No"}
        </dd>
      </dl>

      {consent?.outreachBlocked ? (
        <p className="mt-3 rounded-md border border-[var(--crm-warning)]/25 bg-[var(--crm-warning-soft)] px-3 py-2 text-[12px] text-[var(--crm-warning)]">
          Optional outreach is currently blocked. Consent never overrides DNC or
          channel suppression.
        </p>
      ) : null}

      <p className="mt-3 text-[12px] leading-5 text-[var(--crm-muted)]">
        WhatsApp engagement affects sales priority only through content-free
        evidence: linked state and inbound reply timing. Message text, phone
        number and customer profile data never enter the score.
      </p>

      {canManageConsent ? (
        <div className="mt-4 border-t border-[var(--crm-border)] pt-4">
          <MarketingConsentEvidenceForm contactId={contactId} leadId={leadId} />
        </div>
      ) : null}

      {canRecordOptOut && conversationId ? (
        <div className="mt-4 border-t border-[var(--crm-border)] pt-4">
          <MarketingOptOutForm
            contactId={contactId}
            conversationId={conversationId}
            leadId={leadId}
            compact
          />
        </div>
      ) : null}
    </section>
  );
}
