import type { Metadata } from "next";
import Link from "next/link";
import { WhatsappAccessDenied } from "@/features/whatsapp/components/states/WhatsappAccessDenied";
import {
  TemplateCreateForm,
  TemplateSyncForm,
} from "@/features/whatsapp/components/templates/TemplateStudioForms";
import "@/features/whatsapp/components/templates/template-studio.css";
import { WHATSAPP_ADMIN_INBOX_BASE_PATH, WHATSAPP_ADMIN_TEMPLATES_PATH } from "@/features/whatsapp/contracts/inbox-surface";
import {
  parseWhatsappTemplateRegistryQuery,
  WHATSAPP_TEMPLATE_REGISTRY_CATEGORY_FILTERS,
  WHATSAPP_TEMPLATE_REGISTRY_STATUS_FILTERS,
  type WhatsappTemplateRegistryItem,
  type WhatsappTemplateRegistryQuery,
} from "@/features/whatsapp/contracts/template-studio";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth";
import {
  getWhatsappTemplateManagementStatus,
  listRecentWhatsappTemplateSubmissions,
  listWhatsappTemplateRegistryForCurrentUser,
  probeWhatsappTemplatePermissions,
} from "@/features/whatsapp/server/whatsapp-template-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Templates | ONEDECORE",
};

/**
 * WM-2 Template Studio.
 *
 * The WhatsApp layout has already required inbox read access. This page
 * additionally requires whatsapp.templates.read (Super Admin, Sales Manager);
 * sync and submit controls render only for whatsapp.templates.manage and are
 * re-authorised by their server actions and again by the database.
 *
 * WHAT IT SHOWS IS WHAT ONEDECORE RECORDED. Status, category and quality are
 * the provider's words as last synced; an unrecognised value is shown as
 * "unknown" with the raw provider string beside it, never mapped to a guess.
 */

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

function formatWhen(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE.format(date);
}

function statusTone(status: string): "positive" | "warning" | "negative" | undefined {
  if (status === "APPROVED") return "positive";
  if (["PENDING", "IN_APPEAL", "PAUSED", "LIMIT_EXCEEDED", "unknown"].includes(status)) return "warning";
  if (["REJECTED", "DISABLED", "DELETED", "PENDING_DELETION", "ARCHIVED"].includes(status)) return "negative";
  return undefined;
}

function qualityTone(quality: string | null): "positive" | "warning" | "negative" | undefined {
  if (quality === "GREEN") return "positive";
  if (quality === "YELLOW" || quality === "unknown") return "warning";
  if (quality === "RED") return "negative";
  return undefined;
}

function sendabilityLabel(item: WhatsappTemplateRegistryItem): string {
  if (item.oneToOneSendable) return "Inbox · one-to-one";
  if (item.category === "MARKETING") return "Campaigns only";
  if (item.category === "AUTHENTICATION") return "Not staff-sendable";
  if (item.status !== "APPROVED") return "Not approved";
  if (item.sendProblem) return `Unsupported: ${item.sendProblem.replace(/_/g, " ")}`;
  return "Awaiting approved snapshot";
}

function pageHref(query: WhatsappTemplateRegistryQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${WHATSAPP_ADMIN_TEMPLATES_PATH}?${qs}` : WHATSAPP_ADMIN_TEMPLATES_PATH;
}

interface WhatsappTemplatesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappTemplatesPage({ searchParams }: WhatsappTemplatesPageProps) {
  const context = await getWhatsappInboxAccessContext();
  if (!context) {
    return <WhatsappAccessDenied />;
  }

  const permissions = await probeWhatsappTemplatePermissions();
  if (!permissions["whatsapp.templates.read"]) {
    return (
      <section className="od-tpl" aria-labelledby="whatsapp-templates-denied">
        <div className="od-tpl__panel">
          <h1 id="whatsapp-templates-denied" className="od-tpl__title">
            You do not have Template Studio access
          </h1>
          <p className="od-tpl__lede">
            Template Studio is limited to Super Admins and Sales Managers. Approved utility templates you are allowed
            to send appear inside each conversation you can reply to.
          </p>
          <p>
            <Link className="od-tpl__btn" href={WHATSAPP_ADMIN_INBOX_BASE_PATH}>
              Back to inbox
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const query = parseWhatsappTemplateRegistryQuery(await searchParams);
  const canManage = permissions["whatsapp.templates.manage"];
  const status = getWhatsappTemplateManagementStatus();
  const [registry, submissions] = await Promise.all([
    listWhatsappTemplateRegistryForCurrentUser(query),
    listRecentWhatsappTemplateSubmissions(10),
  ]);
  const totalPages = registry.totalCount === 0 ? 1 : Math.ceil(registry.totalCount / query.pageSize);

  return (
    <div className="od-tpl" data-testid="whatsapp-template-studio">
      <header className="od-tpl__head">
        <div>
          <p className="od-tpl__eyebrow">WhatsApp</p>
          <h1 className="od-tpl__title">Template Studio</h1>
          <p className="od-tpl__lede">
            Message templates registered on the WhatsApp Business Account. Only APPROVED utility templates can be sent
            one-to-one from the inbox, and only in conversations the sender can currently reply to. Marketing templates
            belong to campaigns.
          </p>
        </div>
        <nav className="od-tpl__nav" aria-label="WhatsApp sections">
          <Link className="od-tpl__btn" href={WHATSAPP_ADMIN_INBOX_BASE_PATH}>
            Inbox
          </Link>
          <Link className="od-tpl__btn od-tpl__btn--primary" href={WHATSAPP_ADMIN_TEMPLATES_PATH} aria-current="page">
            Templates
          </Link>
        </nav>
      </header>

      <section className="od-tpl__panel od-tpl__mode" aria-label="Provider connection">
        <div>
          <span className="od-tpl__mode-label">
            <span className="od-tpl__dot" data-tone={status.tone} aria-hidden="true" />
            {status.label}
          </span>
          <p className="od-tpl__hint">{status.detail}</p>
        </div>
        {canManage ? <TemplateSyncForm available={status.actionsAvailable} /> : null}
      </section>

      <div className="od-tpl__columns">
        <section className="od-tpl__panel" aria-labelledby="whatsapp-template-registry">
          <h2 id="whatsapp-template-registry" className="od-tpl__panel-title">
            Registry · {registry.totalCount}
          </h2>

          <form className="od-tpl__filters" method="get" action={WHATSAPP_ADMIN_TEMPLATES_PATH}>
            <label className="od-tpl__field">
              <span>Search name</span>
              <input name="q" defaultValue={query.q ?? ""} maxLength={128} />
            </label>
            <label className="od-tpl__field">
              <span>Status</span>
              <select name="status" defaultValue={query.status ?? ""}>
                <option value="">All</option>
                {WHATSAPP_TEMPLATE_REGISTRY_STATUS_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="od-tpl__field">
              <span>Category</span>
              <select name="category" defaultValue={query.category ?? ""}>
                <option value="">All</option>
                {WHATSAPP_TEMPLATE_REGISTRY_CATEGORY_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="od-tpl__btn">
              Apply
            </button>
          </form>

          {registry.items.length === 0 ? (
            <p className="od-tpl__empty">
              {query.q || query.status || query.category
                ? "No templates match these filters."
                : "No templates recorded yet. A manager can sync them from WhatsApp when template management is enabled."}
            </p>
          ) : (
            <div className="od-tpl__table-wrap">
              <table className="od-tpl__table">
                <thead>
                  <tr>
                    <th scope="col">Template</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Quality</th>
                    <th scope="col">Use</th>
                    <th scope="col">Synced</th>
                    {canManage ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {registry.items.map((item) => (
                    <tr key={item.id} data-status={item.status}>
                      <td>
                        <span className="od-tpl__name">{item.name}</span>
                        <span className="od-tpl__raw">
                          {item.language}
                          {item.variableCount > 0 ? ` · ${item.variableCount} variable${item.variableCount === 1 ? "" : "s"}` : ""}
                          {item.origin === "studio_submission" ? " · created in Studio" : ""}
                        </span>
                        {item.bodyPreview ? <p className="od-tpl__body">{item.bodyPreview}</p> : null}
                      </td>
                      <td>
                        <span className="od-tpl__badge">{item.category}</span>
                        {item.category === "unknown" && item.rawCategory ? (
                          <span className="od-tpl__raw">Provider: {item.rawCategory}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="od-tpl__badge" data-tone={statusTone(item.status)}>
                          {item.status}
                        </span>
                        {item.status === "unknown" && item.rawStatus ? (
                          <span className="od-tpl__raw">Provider: {item.rawStatus}</span>
                        ) : null}
                        {item.rejectedReason ? <span className="od-tpl__raw">Reason: {item.rejectedReason}</span> : null}
                      </td>
                      <td>
                        {item.qualityRating ? (
                          <>
                            <span className="od-tpl__badge" data-tone={qualityTone(item.qualityRating)}>
                              {item.qualityRating}
                            </span>
                            {item.qualityRating === "unknown" && item.rawQualityRating ? (
                              <span className="od-tpl__raw">Provider: {item.rawQualityRating}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="od-tpl__raw">Not rated</span>
                        )}
                      </td>
                      <td>
                        <span className="od-tpl__badge" data-tone={item.oneToOneSendable ? "positive" : undefined}>
                          {sendabilityLabel(item)}
                        </span>
                      </td>
                      <td>
                        <span className="od-tpl__raw">{formatWhen(item.syncedAt)}</span>
                      </td>
                      {canManage ? (
                        <td>
                          {item.providerTemplateId ? (
                            <TemplateSyncForm
                              available={status.actionsAvailable}
                              templateId={item.id}
                              label="Refresh status"
                            />
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <nav className="od-tpl__pager" aria-label="Registry pages">
            <span>
              Page {Math.min(query.page, totalPages)} of {totalPages}
            </span>
            <span className="od-tpl__inline-form">
              {query.page > 1 ? (
                <Link className="od-tpl__btn od-tpl__btn--quiet" href={pageHref(query, query.page - 1)}>
                  Previous
                </Link>
              ) : null}
              {query.page < totalPages ? (
                <Link className="od-tpl__btn od-tpl__btn--quiet" href={pageHref(query, query.page + 1)}>
                  Next
                </Link>
              ) : null}
            </span>
          </nav>
        </section>

        <div className="od-tpl">
          {canManage ? (
            <section className="od-tpl__panel" aria-labelledby="whatsapp-template-create">
              <h2 id="whatsapp-template-create" className="od-tpl__panel-title">
                Create and submit
              </h2>
              {status.actionsAvailable ? null : <p className="od-tpl__hint">{status.detail}</p>}
              <TemplateCreateForm available={status.actionsAvailable} />
            </section>
          ) : null}

          <section className="od-tpl__panel" aria-labelledby="whatsapp-template-submissions">
            <h2 id="whatsapp-template-submissions" className="od-tpl__panel-title">
              Recent submissions
            </h2>
            {submissions.length === 0 ? (
              <p className="od-tpl__empty">No templates have been submitted from the Studio.</p>
            ) : (
              <table className="od-tpl__table">
                <thead>
                  <tr>
                    <th scope="col">Template</th>
                    <th scope="col">Outcome</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td>
                        <span className="od-tpl__name">{submission.name}</span>
                        <span className="od-tpl__raw">
                          {submission.language} · {submission.category}
                        </span>
                      </td>
                      <td>
                        <span
                          className="od-tpl__badge"
                          data-tone={
                            submission.outcome === "accepted"
                              ? "positive"
                              : submission.outcome === "failed"
                                ? "negative"
                                : "warning"
                          }
                        >
                          {submission.outcome === "unresolved" ? "no outcome recorded" : submission.outcome}
                        </span>
                        {submission.errorCode ? <span className="od-tpl__raw">{submission.errorCode}</span> : null}
                      </td>
                      <td>
                        <span className="od-tpl__raw">{formatWhen(submission.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
