import type { Metadata } from "next";
import Link from "next/link";
import { WhatsappAccessDenied } from "@/features/whatsapp/components/states/WhatsappAccessDenied";
import {
  TemplateCreateForm,
  TemplateSyncForm,
} from "@/features/whatsapp/components/templates/TemplateStudioForms";
import { TemplateLibrary } from "@/features/whatsapp/components/templates/TemplateLibrary";
import { TemplateArchiveForm } from "@/features/whatsapp/components/templates/TemplateDraftActions";
import "@/features/whatsapp/components/templates/template-studio.css";
import "@/features/whatsapp/components/growth-workspace.css";
import { WHATSAPP_ADMIN_INBOX_BASE_PATH, WHATSAPP_ADMIN_TEMPLATES_PATH } from "@/features/whatsapp/contracts/inbox-surface";
import {
  parseWhatsappTemplateRegistryQuery,
  WHATSAPP_TEMPLATE_REGISTRY_CATEGORY_FILTERS,
  WHATSAPP_TEMPLATE_REGISTRY_STATUS_FILTERS,
  type WhatsappTemplateRegistryItem,
  type WhatsappTemplateRegistryQuery,
} from "@/features/whatsapp/contracts/template-studio";
import { getWhatsappTemplateLibraryPreset } from "@/features/whatsapp/contracts/template-library";
import {
  editorSeedFromWhatsappTemplateComponents,
  WHATSAPP_TEMPLATE_STUDIO_LANGUAGES,
} from "@/features/whatsapp/contracts/template-components";
import {
  parseWhatsappTemplateDraftQuery,
  WHATSAPP_TEMPLATE_DRAFT_STATUSES,
  type WhatsappTemplateDraftQuery,
} from "@/features/whatsapp/contracts/template-drafts";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth";
import {
  getWhatsappTemplateManagementStatus,
  getWhatsappTemplateDraftForCurrentUser,
  listRecentWhatsappTemplateSubmissions,
  listWhatsappTemplateDraftsForCurrentUser,
  listWhatsappTemplateRegistryForCurrentUser,
  listWhatsappTemplateStatusTimelineForCurrentUser,
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

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
  if (query.language) params.set("language", query.language);
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${WHATSAPP_ADMIN_TEMPLATES_PATH}?${qs}` : WHATSAPP_ADMIN_TEMPLATES_PATH;
}

function draftPageHref(query: WhatsappTemplateDraftQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.status) params.set("draftStatus", query.status);
  if (query.category) params.set("draftCategory", query.category);
  if (query.language) params.set("language", query.language);
  if (query.q) params.set("draftQ", query.q);
  if (page > 1) params.set("draftPage", String(page));
  const qs = params.toString();
  return qs ? `${WHATSAPP_ADMIN_TEMPLATES_PATH}?${qs}#onedecore-drafts` : `${WHATSAPP_ADMIN_TEMPLATES_PATH}#onedecore-drafts`;
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

  const params = await searchParams;
  const query = parseWhatsappTemplateRegistryQuery(params);
  const draftQuery = parseWhatsappTemplateDraftQuery(params);
  const preset = getWhatsappTemplateLibraryPreset(first(params.preset));
  const draftId = first(params.draft);
  const duplicateDraftId = first(params.duplicateDraft);
  const canManage = permissions["whatsapp.templates.manage"];
  const status = getWhatsappTemplateManagementStatus();

  const requestedDraftId =
    draftId && /^[0-9a-f-]{36}$/i.test(draftId)
      ? draftId
      : duplicateDraftId && /^[0-9a-f-]{36}$/i.test(duplicateDraftId)
        ? duplicateDraftId
        : null;

  const [registry, submissions, drafts, timeline, selectedDraft] = await Promise.all([
    listWhatsappTemplateRegistryForCurrentUser(query),
    listRecentWhatsappTemplateSubmissions(10),
    listWhatsappTemplateDraftsForCurrentUser(draftQuery),
    listWhatsappTemplateStatusTimelineForCurrentUser(25),
    requestedDraftId ? getWhatsappTemplateDraftForCurrentUser(requestedDraftId) : Promise.resolve(null),
  ]);

  const editorSeed = selectedDraft
    ? editorSeedFromWhatsappTemplateComponents({
        name: selectedDraft.name,
        language: selectedDraft.language,
        category: selectedDraft.category,
        components: selectedDraft.components,
      })
    : null;
  const totalPages = registry.totalCount === 0 ? 1 : Math.ceil(registry.totalCount / query.pageSize);
  const approvedOnPage = registry.items.filter((item) => item.status === "APPROVED").length;
  const sendableOnPage = registry.items.filter((item) => item.oneToOneSendable).length;
  const marketingOnPage = registry.items.filter((item) => item.category === "MARKETING").length;

  return (
    <div className="od-tpl od-growth" data-testid="whatsapp-template-studio">
      <header className="od-growth__hero">
        <div>
          <p className="od-growth__eyebrow">WhatsApp growth workspace</p>
          <h1>Message Templates</h1>
          <p>
            Create, sync and govern Meta-approved templates from one place. Utility templates power service conversations;
            Marketing templates feed consented campaigns.
          </p>
        </div>
        <div className="od-growth__actions">
          <Link className="od-tpl__btn" href={WHATSAPP_ADMIN_INBOX_BASE_PATH}>
            Open inbox
          </Link>
          {canManage ? (
            <a className="od-tpl__btn od-tpl__btn--primary" href="#whatsapp-template-create">
              Create template
            </a>
          ) : null}
        </div>
      </header>

      <section className="od-growth__kpis" aria-label="Template overview">
        <div className="od-growth__kpi">
          <strong>{registry.totalCount.toLocaleString("en-IN")}</strong>
          <span>Total templates</span>
        </div>
        <div className="od-growth__kpi">
          <strong>{approvedOnPage.toLocaleString("en-IN")}</strong>
          <span>Approved on this page</span>
        </div>
        <div className="od-growth__kpi">
          <strong>{sendableOnPage.toLocaleString("en-IN")}</strong>
          <span>Inbox-sendable on this page</span>
        </div>
        <div className="od-growth__kpi">
          <strong>{marketingOnPage.toLocaleString("en-IN")}</strong>
          <span>Marketing on this page</span>
        </div>
      </section>

      <nav className="od-growth__tabs" aria-label="Template category shortcuts">
        <Link className="od-growth__tab" data-active={!query.category} href={WHATSAPP_ADMIN_TEMPLATES_PATH}>
          All templates
        </Link>
        <Link className="od-growth__tab" data-active={query.category === "UTILITY"} href={WHATSAPP_ADMIN_TEMPLATES_PATH + "?category=UTILITY"}>
          Utility
        </Link>
        <Link className="od-growth__tab" data-active={query.category === "MARKETING"} href={WHATSAPP_ADMIN_TEMPLATES_PATH + "?category=MARKETING"}>
          Marketing
        </Link>
        <Link className="od-growth__tab" data-active={query.status === "APPROVED"} href={WHATSAPP_ADMIN_TEMPLATES_PATH + "?status=APPROVED"}>
          Approved
        </Link>
        <Link className="od-growth__tab" data-active={query.status === "PENDING"} href={WHATSAPP_ADMIN_TEMPLATES_PATH + "?status=PENDING"}>
          Pending review
        </Link>
      </nav>

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

      <TemplateLibrary />

      <section
        id="onedecore-drafts"
        className="od-tpl__panel od-tpl__draft-workspace"
        aria-labelledby="onedecore-template-drafts"
      >
        <div className="od-tpl__section-head">
          <div>
            <p className="od-growth__eyebrow">Prepare before Meta</p>
            <h2 id="onedecore-template-drafts" className="od-tpl__panel-title">
              ONEDECORE Drafts · {drafts.totalCount}
            </h2>
            <p className="od-tpl__hint">
              Local drafts are internal preparation only. They are never treated as
              Meta-approved or sendable until the provider registry says so.
            </p>
          </div>
          {canManage ? (
            <a className="od-tpl__btn od-tpl__btn--primary" href="#whatsapp-template-create">
              New local draft
            </a>
          ) : null}
        </div>

        <form className="od-tpl__filters" method="get" action={WHATSAPP_ADMIN_TEMPLATES_PATH}>
          <label className="od-tpl__field">
            <span>Search draft</span>
            <input name="draftQ" defaultValue={draftQuery.q ?? ""} maxLength={128} />
          </label>
          <label className="od-tpl__field">
            <span>Workflow</span>
            <select name="draftStatus" defaultValue={draftQuery.status ?? ""}>
              <option value="">Live drafts</option>
              {WHATSAPP_TEMPLATE_DRAFT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="od-tpl__field">
            <span>Category</span>
            <select name="draftCategory" defaultValue={draftQuery.category ?? ""}>
              <option value="">All</option>
              <option value="UTILITY">UTILITY</option>
              <option value="MARKETING">MARKETING</option>
            </select>
          </label>
          <label className="od-tpl__field">
            <span>Language</span>
            <select name="language" defaultValue={draftQuery.language ?? ""}>
              <option value="">All</option>
              {WHATSAPP_TEMPLATE_STUDIO_LANGUAGES.map((value) => (
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

        {drafts.items.length === 0 ? (
          <p className="od-tpl__empty">
            No ONEDECORE drafts match these filters. Start from the library or create
            one below.
          </p>
        ) : (
          <div className="od-tpl__draft-grid">
            {drafts.items.map((draft) => (
              <article className="od-tpl__draft-card" key={draft.id}>
                <div className="od-tpl__draft-card-head">
                  <div>
                    <strong>{draft.name}</strong>
                    <span className="od-tpl__raw">
                      {draft.language} · {draft.category}
                    </span>
                  </div>
                  <span
                    className="od-tpl__badge"
                    data-tone={
                      draft.workflowStatus === "locally_reviewed"
                        ? "positive"
                        : draft.workflowStatus === "archived"
                          ? "negative"
                          : undefined
                    }
                  >
                    {draft.workflowStatus.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="od-tpl__raw">
                  Updated {formatWhen(draft.updatedAt)} · version {draft.lockVersion}
                </p>
                <div className="od-tpl__draft-actions">
                  <Link
                    className="od-tpl__btn od-tpl__btn--quiet"
                    href={`${WHATSAPP_ADMIN_TEMPLATES_PATH}?draft=${draft.id}#whatsapp-template-create`}
                  >
                    {draft.workflowStatus === "archived" ? "Reopen & edit" : "Edit"}
                  </Link>
                  <Link
                    className="od-tpl__btn od-tpl__btn--quiet"
                    href={`${WHATSAPP_ADMIN_TEMPLATES_PATH}?duplicateDraft=${draft.id}#whatsapp-template-create`}
                  >
                    Duplicate
                  </Link>
                  {draft.category === "MARKETING" ? (
                    <Link
                      className="od-tpl__btn od-tpl__btn--quiet"
                      href={`/admin/whatsapp/campaigns?templateDraft=${draft.id}&templateDraftName=${encodeURIComponent(draft.name)}#crm-campaign-launcher`}
                    >
                      Use in Campaign
                    </Link>
                  ) : null}
                  {canManage && draft.workflowStatus !== "archived" ? (
                    <TemplateArchiveForm
                      draftId={draft.id}
                      lockVersion={draft.lockVersion}
                    />
                  ) : null}
                </div>
                {draft.category === "MARKETING" ? (
                  <p className="od-tpl__hint">
                    Campaign handoff is preparation-only until an approved Meta template
                    is selected for execution.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {drafts.totalCount > draftQuery.pageSize ? (
          <nav className="od-tpl__pager" aria-label="Draft pages">
            <span>Page {draftQuery.page}</span>
            <span className="od-tpl__inline-form">
              {draftQuery.page > 1 ? (
                <Link
                  className="od-tpl__btn od-tpl__btn--quiet"
                  href={draftPageHref(draftQuery, draftQuery.page - 1)}
                >
                  Previous
                </Link>
              ) : null}
              {draftQuery.page * draftQuery.pageSize < drafts.totalCount ? (
                <Link
                  className="od-tpl__btn od-tpl__btn--quiet"
                  href={draftPageHref(draftQuery, draftQuery.page + 1)}
                >
                  Next
                </Link>
              ) : null}
            </span>
          </nav>
        ) : null}
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
            <label className="od-tpl__field">
              <span>Language</span>
              <select name="language" defaultValue={query.language ?? ""}>
                <option value="">All</option>
                {WHATSAPP_TEMPLATE_STUDIO_LANGUAGES.map((value) => (
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
              <div className="od-tpl__section-head">
                <div>
                  <h2 id="whatsapp-template-create" className="od-tpl__panel-title">
                    {selectedDraft
                      ? duplicateDraftId
                        ? "Duplicate ONEDECORE draft"
                        : "Edit ONEDECORE draft"
                      : "Prepare template"}
                  </h2>
                  <p className="od-tpl__hint">
                    Saving and local review work with the provider off. Meta submission
                    remains a separate governed action.
                  </p>
                </div>
                {selectedDraft ? (
                  <Link
                    className="od-tpl__btn od-tpl__btn--quiet"
                    href={WHATSAPP_ADMIN_TEMPLATES_PATH + "#whatsapp-template-create"}
                  >
                    Clear editor
                  </Link>
                ) : null}
              </div>
              {status.actionsAvailable ? null : <p className="od-tpl__hint">{status.detail}</p>}
              <TemplateCreateForm
                key={
                  selectedDraft
                    ? `${selectedDraft.id}:${duplicateDraftId ? "duplicate" : "edit"}`
                    : preset?.id ?? "blank"
                }
                available={status.actionsAvailable}
                preset={selectedDraft ? null : preset}
                seed={editorSeed}
                draftMeta={
                  selectedDraft && !duplicateDraftId
                    ? {
                        id: selectedDraft.id,
                        lockVersion: selectedDraft.lockVersion,
                        workflowStatus: selectedDraft.workflowStatus,
                        sourcePresetId: selectedDraft.sourcePresetId,
                      }
                    : null
                }
                duplicateMode={Boolean(selectedDraft && duplicateDraftId)}
              />
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

          <section className="od-tpl__panel" aria-labelledby="whatsapp-template-timeline">
            <h2 id="whatsapp-template-timeline" className="od-tpl__panel-title">
              Provider status timeline
            </h2>
            <p className="od-tpl__hint">
              Provider and submission evidence only. Local review never appears here as
              approval.
            </p>
            {timeline.length === 0 ? (
              <p className="od-tpl__empty">
                No provider template status or submission events have been recorded yet.
              </p>
            ) : (
              <ol className="od-tpl__timeline">
                {timeline.map((event) => (
                  <li key={event.id} className="od-tpl__timeline-item">
                    <div>
                      <strong>{event.templateName}</strong>
                      <span className="od-tpl__raw">
                        {event.source} · {event.eventKind.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="od-tpl__timeline-meta">
                      {event.status ? (
                        <span className="od-tpl__badge" data-tone={statusTone(event.status)}>
                          {event.status}
                        </span>
                      ) : null}
                      {event.category ? (
                        <span className="od-tpl__badge">{event.category}</span>
                      ) : null}
                      {event.qualityRating ? (
                        <span
                          className="od-tpl__badge"
                          data-tone={qualityTone(event.qualityRating)}
                        >
                          {event.qualityRating}
                        </span>
                      ) : null}
                      <span className="od-tpl__raw">{formatWhen(event.occurredAt)}</span>
                    </div>
                    {event.errorCode ? (
                      <span className="od-tpl__raw">Error: {event.errorCode}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
