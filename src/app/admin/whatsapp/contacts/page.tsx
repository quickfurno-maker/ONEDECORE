import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingConsentEvidenceForm,
  MarketingOptOutForm,
  MarketingPreferenceForm,
} from "@/features/whatsapp/components/control-plane/ContactComplianceForms";
import { ControlPlaneDenied, ControlPlaneShell } from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import {
  buildWhatsappContactsHref,
  optedOutCategories,
  parseWhatsappContactsQuery,
  preferenceStateFor,
  presentWhatsappChannel,
  presentWhatsappContactStatus,
  presentWhatsappMarketingConsent,
  WHATSAPP_CONTACTS_SEARCH_MAX_LENGTH,
  WHATSAPP_MARKETING_PREFERENCE_LABELS,
} from "@/features/whatsapp/contracts/contacts-compliance";
import { WHATSAPP_ADMIN_CONTACTS_PATH } from "@/features/whatsapp/contracts/control-plane";
import {
  listWhatsappContactsForCurrentUser,
  listWhatsappPreferenceStatesForContacts,
} from "@/features/whatsapp/server/whatsapp-contacts-queries";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Contacts | ONEDECORE",
};

/**
 * WM-3 Contacts. Requires whatsapp.contacts.read (Super Admin, Sales Manager).
 *
 * Shows MARKETING consent as the latest recorded consent event, never derived
 * from service consent. P5 allows a manager with marketing_consents.manage to
 * record evidence of an explicit customer opt-in; opt-out remains separately
 * available and category preferences only narrow eligibility. Every control is
 * re-authorised by its action and again by the database.
 */

interface WhatsappContactsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappContactsPage({ searchParams }: WhatsappContactsPageProps) {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.contacts.read"]) {
    return (
      <ControlPlaneDenied
        title="You do not have Contacts access"
        detail="The WhatsApp contacts and compliance workspace is limited to Super Admins and Sales Managers. You can still record a customer's marketing opt-out from a conversation assigned to you."
      />
    );
  }

  const { permissions } = access;
  const query = parseWhatsappContactsQuery(await searchParams);
  const result = await listWhatsappContactsForCurrentUser(query);
  const page = result ?? { totalCount: 0, items: [] };
  const preferences = await listWhatsappPreferenceStatesForContacts(page.items.map((item) => item.contactId));
  const totalPages = Math.max(1, Math.ceil(page.totalCount / query.pageSize));
  const canOptOut = permissions["whatsapp.opt_out.record"];
  const canPreferences = permissions["marketing_consents.manage"];

  return (
    <ControlPlaneShell
      active="contacts"
      title="Contacts"
      lede="Every CRM contact with their WhatsApp channel and marketing status. Marketing needs the contact's own MARKETING consent — service conversations never count as permission to market."
      permissions={permissions}
    >
      <section className="od-cp__panel" aria-labelledby="whatsapp-contacts-heading">
        <div className="od-cp__toolbar">
          <h2 id="whatsapp-contacts-heading" className="od-cp__panel-title" style={{ margin: 0 }}>
            {page.totalCount.toLocaleString("en-IN")} contact{page.totalCount === 1 ? "" : "s"}
          </h2>
          <form className="od-cp__filters" method="get" action={WHATSAPP_ADMIN_CONTACTS_PATH} role="search">
            <label className="od-cp__field">
              <span className="sr-only">Search by name or WhatsApp number</span>
              <input
                name="q"
                type="search"
                defaultValue={query.q ?? ""}
                maxLength={WHATSAPP_CONTACTS_SEARCH_MAX_LENGTH}
                placeholder="Name or number"
              />
            </label>
            <button type="submit" className="od-cp__btn">
              Search
            </button>
            {query.q ? (
              <Link className="od-cp__btn od-cp__btn--quiet" href={WHATSAPP_ADMIN_CONTACTS_PATH}>
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        {result === null ? (
          <p className="od-cp__notice" data-tone="negative" role="alert">
            Contacts could not be loaded. Try again shortly.
          </p>
        ) : page.items.length === 0 ? (
          <p className="od-cp__empty">{query.q ? "No contacts match this search." : "No contacts recorded yet."}</p>
        ) : (
          <div className="od-cp__table-wrap">
            <table className="od-cp__table">
              <thead>
                <tr>
                  <th scope="col">Contact</th>
                  <th scope="col">Status</th>
                  <th scope="col">WhatsApp</th>
                  <th scope="col">Marketing</th>
                  <th scope="col">Preferences</th>
                  <th scope="col">Lead</th>
                  {canOptOut || canPreferences ? (
                    <th scope="col">
                      <span className="sr-only">Compliance actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {page.items.map((contact) => {
                  const status = presentWhatsappContactStatus(contact.contactStatus);
                  const channel = presentWhatsappChannel(contact.whatsappE164, contact.whatsappChannelStatus);
                  const consent = presentWhatsappMarketingConsent(contact.marketingConsent);
                  const stopped = optedOutCategories(preferenceStateFor(preferences, contact.contactId));
                  const showOptOut = canOptOut && contact.marketingConsent !== "withdrawn";
                  const showConsentGrant = canPreferences && contact.marketingConsent !== "granted";
                  return (
                    <tr key={contact.contactId}>
                      <td>
                        <span className="od-cp__name">{contact.displayName}</span>
                        {contact.whatsappE164 ? <span className="od-cp__sub">{contact.whatsappE164}</span> : null}
                      </td>
                      <td>
                        <span className="od-cp__badge" data-tone={status.tone}>
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <span className="od-cp__badge" data-tone={channel.tone}>
                          {channel.label}
                        </span>
                      </td>
                      <td>
                        <span className="od-cp__badge" data-tone={consent.tone}>
                          {consent.label}
                        </span>
                        {contact.marketingConsent === "unknown" && contact.rawMarketingConsent ? (
                          <span className="od-cp__sub">Recorded: {contact.rawMarketingConsent}</span>
                        ) : null}
                      </td>
                      <td>
                        {stopped.length === 0 ? (
                          <span className="od-cp__sub" style={{ marginBlockStart: 0 }}>
                            No categories stopped
                          </span>
                        ) : (
                          <span className="od-cp__chips">
                            {stopped.map((category) => (
                              <span key={category} className="od-cp__badge" data-tone="warning">
                                {WHATSAPP_MARKETING_PREFERENCE_LABELS[category]} stopped
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td>
                        {contact.leadId ? (
                          <>
                            <Link className="od-cp__name" href={`/admin/crm/leads/${contact.leadId}`}>
                              {contact.leadStage ? contact.leadStage.replace(/_/g, " ") : "Open lead"}
                            </Link>
                            {contact.locality ? <span className="od-cp__sub">{contact.locality}</span> : null}
                          </>
                        ) : (
                          <span className="od-cp__sub" style={{ marginBlockStart: 0 }}>
                            No live lead
                          </span>
                        )}
                      </td>
                      {canOptOut || canPreferences ? (
                        <td>
                          {showOptOut || canPreferences ? (
                            <details className="od-cp__disclosure">
                              <summary className="od-cp__btn od-cp__btn--quiet">Compliance</summary>
                              <div className="od-cp__drawer">
                                {showConsentGrant ? <MarketingConsentEvidenceForm contactId={contact.contactId} /> : null}
                                {showConsentGrant && (showOptOut || canPreferences) ? <hr className="od-cp__divider" /> : null}
                                {showOptOut ? <MarketingOptOutForm contactId={contact.contactId} /> : null}
                                {showOptOut && canPreferences ? <hr className="od-cp__divider" /> : null}
                                {canPreferences ? <MarketingPreferenceForm contactId={contact.contactId} /> : null}
                              </div>
                            </details>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <nav className="od-cp__pager" aria-label="Contact pages">
          <span>
            Page {Math.min(query.page, totalPages)} of {totalPages}
          </span>
          <span className="od-cp__filters">
            {query.page > 1 ? (
              <Link
                className="od-cp__btn od-cp__btn--quiet"
                href={buildWhatsappContactsHref(WHATSAPP_ADMIN_CONTACTS_PATH, query, Math.min(query.page - 1, totalPages))}
              >
                Previous
              </Link>
            ) : null}
            {query.page < totalPages ? (
              <Link
                className="od-cp__btn od-cp__btn--quiet"
                href={buildWhatsappContactsHref(WHATSAPP_ADMIN_CONTACTS_PATH, query, query.page + 1)}
              >
                Next
              </Link>
            ) : null}
          </span>
        </nav>
      </section>
    </ControlPlaneShell>
  );
}
