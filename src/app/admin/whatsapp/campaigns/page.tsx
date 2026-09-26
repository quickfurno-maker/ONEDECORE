import type { Metadata } from "next";
import Link from "next/link";
import { previewCampaignAudience } from "@/features/marketing/server/campaign-queries";
import {
  CampaignButtonBindingsForm,
  CampaignCreateRunForm,
  CampaignReconcileForm,
  CampaignRunControls,
  CampaignSpecForm,
  CampaignTestSendForm,
} from "@/features/whatsapp/components/campaigns/CampaignExecutionForms";
import { CrmCampaignLauncher } from "@/features/whatsapp/components/campaigns/CrmCampaignLauncher";
import { ControlPlaneDenied, ControlPlaneShell } from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import {
  availableWhatsappCampaignRunOperations,
  describeWhatsappCampaignOperatorDenial,
  describeWhatsappCampaignReason,
  presentWhatsappCampaignApproval,
  whatsappCampaignRunTone,
  whatsappTemplateButtonSlots,
} from "@/features/whatsapp/contracts/campaign-execution";
import { isUuid, WHATSAPP_ADMIN_CAMPAIGNS_PATH } from "@/features/whatsapp/contracts/control-plane";
import {
  currentIstDate,
  currentIstMonth,
  isWhatsappCrmLeadMonth,
  sanitizeWhatsappCrmCampaignFilters,
  WHATSAPP_CRM_SALES_TEMPERATURES,
  type WhatsappCrmSalesTemperature,
} from "@/features/whatsapp/contracts/crm-campaigns";
import {
  getWhatsappCampaignRunBreakdownForCurrentUser,
  getWhatsappCampaignSpecButtonBindingsForCurrentUser,
  getWhatsappCampaignVersionForCurrentUser,
  listWhatsappCampaignTemplateOptionsForCurrentUser,
  listWhatsappCampaignTestDestinationsForCurrentUser,
  listWhatsappCampaignTestSendsForCurrentUser,
  listWhatsappCampaignVersionsForCurrentUser,
  listWhatsappClickDestinationsForCurrentUser,
  previewWhatsappCampaignAudienceForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-campaign-queries";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";
import {
  getWhatsappCrmAudienceCountsForCurrentUser,
  getWhatsappCrmCampaignFilterOptionsForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-crm-campaign-queries";
import { listWhatsappFlowsForCurrentUser } from "@/features/whatsapp/server/whatsapp-flow-queries";
import { listWhatsappSegmentsForCurrentUser } from "@/features/whatsapp/server/whatsapp-segments-queries";
import "@/features/whatsapp/components/growth-workspace.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Campaigns | ONEDECORE",
};

/**
 * WM-4 Campaigns. Requires whatsapp.campaigns.execute (Super Admin, Sales
 * Manager). The WhatsApp spec of a DRAFT version is authored with generic
 * campaigns.draft (Super Admin); test sends need whatsapp.campaigns.test_send;
 * cancelling a run and resolving ambiguous sends need whatsapp.campaigns.cancel
 * (Super Admin). Approval is the existing generic campaign approval, shown
 * read-only — this page never approves.
 */

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE.format(date);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function campaignStateHref(state: string, month: string, temperature: string): string {
  const params = new URLSearchParams();
  if (state !== "all") params.set("state", state);
  params.set("audienceMonth", month);
  params.set("audienceTemperature", temperature);
  return `${WHATSAPP_ADMIN_CAMPAIGNS_PATH}?${params.toString()}`;
}

interface WhatsappCampaignsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappCampaignsPage({ searchParams }: WhatsappCampaignsPageProps) {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.campaigns.execute"]) {
    return (
      <ControlPlaneDenied
        title="You do not have Campaigns access"
        detail="WhatsApp campaign execution is limited to Super Admins and Sales Managers."
      />
    );
  }

  const { permissions } = access;
  const campaignPermissions = {
    "whatsapp.campaigns.execute": permissions["whatsapp.campaigns.execute"],
    "whatsapp.campaigns.test_send": permissions["whatsapp.campaigns.test_send"],
    "whatsapp.campaigns.cancel": permissions["whatsapp.campaigns.cancel"],
  };
  const canDraft = permissions["campaigns.draft"] && permissions["whatsapp.templates.read"];
  const params = await searchParams;
  const selectedRaw = first(params.version);
  const selectedId = isUuid(selectedRaw) ? selectedRaw : null;
  const wantsPreview = first(params.preview) === "1";
  const templateDraftRaw = first(params.templateDraft);
  const templateDraftId = isUuid(templateDraftRaw) ? templateDraftRaw : null;
  const templateDraftName = first(params.templateDraftName)?.trim().slice(0, 128) ?? null;
  const requestedMonth = first(params.audienceMonth);
  const audienceMonth = isWhatsappCrmLeadMonth(requestedMonth) ? requestedMonth : currentIstMonth();
  const requestedTemperature = first(params.audienceTemperature);
  const audienceTemperature: WhatsappCrmSalesTemperature =
    requestedTemperature && WHATSAPP_CRM_SALES_TEMPERATURES.includes(requestedTemperature as WhatsappCrmSalesTemperature)
      ? (requestedTemperature as WhatsappCrmSalesTemperature)
      : "hot";
  const audienceFilters = sanitizeWhatsappCrmCampaignFilters({
    stage: first(params.stage),
    service: first(params.service),
    source: first(params.source),
    locality: first(params.locality),
    owner: first(params.owner),
    budget: first(params.budget),
    lastInteractionAge: first(params.lastInteractionAge),
    milestone: first(params.milestone),
    dormantDuration: first(params.dormantDuration),
  });
  const requestedState = first(params.state);
  const campaignState = ["all", "draft", "approved", "scheduled", "running", "completed"].includes(requestedState ?? "")
    ? requestedState!
    : "all";

  const [versions, selected, crmAudienceCounts, crmFilterOptions, crmEligibilityPreview] = await Promise.all([
    listWhatsappCampaignVersionsForCurrentUser(),
    selectedId ? getWhatsappCampaignVersionForCurrentUser(selectedId) : Promise.resolve(null),
    getWhatsappCrmAudienceCountsForCurrentUser(audienceMonth),
    getWhatsappCrmCampaignFilterOptionsForCurrentUser(),
    selectedId ? previewCampaignAudience(selectedId) : Promise.resolve(null),
  ]);

  const spec = selected?.spec ?? null;
  const draftEditable = Boolean(selected && canDraft && selected.status === "draft" && (!spec || spec.state === "draft"));
  const latestRun = selected?.runs[0] ?? null;

  const [templates, segments, testDestinations, testSends, buttonBindings, clickDestinations, flows, preview, breakdown] = await Promise.all([
    draftEditable ? listWhatsappCampaignTemplateOptionsForCurrentUser() : Promise.resolve([]),
    draftEditable && permissions["whatsapp.segments.read"] ? listWhatsappSegmentsForCurrentUser() : Promise.resolve([]),
    selected && permissions["whatsapp.campaigns.test_send"] && spec ? listWhatsappCampaignTestDestinationsForCurrentUser() : Promise.resolve([]),
    selected && permissions["whatsapp.campaigns.test_send"] ? listWhatsappCampaignTestSendsForCurrentUser(selected.versionId) : Promise.resolve([]),
    selected && spec ? getWhatsappCampaignSpecButtonBindingsForCurrentUser(selected.versionId) : Promise.resolve({}),
    draftEditable ? listWhatsappClickDestinationsForCurrentUser() : Promise.resolve([]),
    draftEditable && permissions["whatsapp.flows.read"] ? listWhatsappFlowsForCurrentUser() : Promise.resolve([]),
    selected && spec && wantsPreview ? previewWhatsappCampaignAudienceForCurrentUser(selected.versionId) : Promise.resolve(null),
    latestRun ? getWhatsappCampaignRunBreakdownForCurrentUser(latestRun.id) : Promise.resolve(null),
  ]);

  const approval = presentWhatsappCampaignApproval(selected?.approval?.decision ?? null);
  const denial = describeWhatsappCampaignOperatorDenial(selected?.operatorDenial ?? null);
  const templateButtonCount = spec ? whatsappTemplateButtonSlots(spec.components).length : 0;
  const ctaReady = Boolean(spec) && (templateButtonCount === 0 || Object.keys(buttonBindings).length >= templateButtonCount);
  const previewReady = Boolean(crmEligibilityPreview);
  const testReady = testSends.some((item) => item.outcome === "succeeded");
  const scheduledReady = Boolean(latestRun);
  const launched = Boolean(latestRun && ["dispatching", "paused", "completed"].includes(latestRun.status));
  const approvedCount = versions.filter((version) => version.status === "approved").length;
  const activeRunCount = versions.filter((version) =>
    ["scheduled", "dispatching", "paused"].includes(version.latestRun?.status ?? "")
  ).length;
  const visibleVersions = versions.filter((version) => {
    if (campaignState === "all") return true;
    if (campaignState === "draft") return version.status === "draft";
    if (campaignState === "approved") return version.status === "approved" && !version.latestRun;
    if (campaignState === "scheduled") return version.latestRun?.status === "scheduled";
    if (campaignState === "running") return ["dispatching", "paused"].includes(version.latestRun?.status ?? "");
    return ["completed", "cancelled", "failed"].includes(version.latestRun?.status ?? "");
  });
  const sentCount = versions.reduce((sum, version) => sum + (version.latestRun?.sentCount ?? 0), 0);
  const readiness = selected
    ? [
        { label: "Template & spec", ready: Boolean(spec) },
        { label: "Audience frozen", ready: selected.audienceFrozen },
        { label: "Independent approval", ready: approval.approved },
        { label: "Operator allowed", ready: !selected.operatorDenial },
      ]
    : [];

  return (
    <ControlPlaneShell
      active="campaigns"
      title="Campaigns"
      lede="Deliver approved campaigns on WhatsApp with an official MARKETING template. Every recipient is re-checked for consent, opt-outs, suppression, caps and quiet hours just before the send."
      permissions={permissions}
    >
      <div className="od-growth">
        <section className="od-growth__hero">
          <div>
            <p className="od-growth__eyebrow">WhatsApp campaign manager</p>
            <h1>Broadcasts, audiences & delivery</h1>
            <p>
              Build governed WhatsApp campaigns with approved templates, consented audiences, test sends,
              scheduling and delivery controls in one guided workspace.
            </p>
          </div>
          <div className="od-growth__actions">
            {permissions["campaigns.draft"] ? (
              <Link className="od-cp__btn od-cp__btn--primary" href="/admin/campaigns">
                Create campaign
              </Link>
            ) : null}
            <Link className="od-cp__btn od-cp__btn--quiet" href="/admin/whatsapp/templates">
              Manage templates
            </Link>
          </div>
        </section>

        <section className="od-growth__kpis" aria-label="Campaign overview">
          <div className="od-growth__kpi">
            <strong>{versions.length.toLocaleString("en-IN")}</strong>
            <span>WhatsApp versions</span>
          </div>
          <div className="od-growth__kpi">
            <strong>{approvedCount.toLocaleString("en-IN")}</strong>
            <span>Approved versions</span>
          </div>
          <div className="od-growth__kpi">
            <strong>{activeRunCount.toLocaleString("en-IN")}</strong>
            <span>Scheduled / active runs</span>
          </div>
          <div className="od-growth__kpi">
            <strong>{sentCount.toLocaleString("en-IN")}</strong>
            <span>Sent in latest runs</span>
          </div>
        </section>

        <nav className="od-growth__tabs" aria-label="Campaign type">
          <Link className="od-growth__tab" data-active="true" href={WHATSAPP_ADMIN_CAMPAIGNS_PATH}>
            One-time campaigns
          </Link>
          <Link className="od-growth__tab" href="/admin/whatsapp/automations">
            Automated campaigns
          </Link>
        </nav>

        {templateDraftId ? (
          <section
            className="od-cp__panel"
            aria-label="Local template draft handoff"
            data-testid="campaign-local-template-handoff"
          >
            <div className="od-cp__panel-head">
              <div>
                <p className="od-growth__eyebrow">Template preparation handoff</p>
                <h2>{templateDraftName || "ONEDECORE local draft"}</h2>
                <p>
                  This local draft is attached only as preparation context. It is not
                  Meta approved and cannot be selected for campaign execution until an
                  approved MARKETING template appears in the provider registry.
                </p>
              </div>
              <Link
                className="od-cp__btn od-cp__btn--quiet"
                href={`/admin/whatsapp/templates?draft=${templateDraftId}#whatsapp-template-create`}
              >
                Edit local draft
              </Link>
            </div>
          </section>
        ) : null}

        <CrmCampaignLauncher
          month={audienceMonth}
          temperature={audienceTemperature}
          filters={audienceFilters}
          options={crmFilterOptions}
          counts={crmAudienceCounts}
          startDate={currentIstDate()}
          canCreate={permissions["campaigns.draft"]}
        />

        <nav className="od-growth__tabs" aria-label="Campaign state">
          {["all", "draft", "approved", "scheduled", "running", "completed"].map((state) => (
            <Link
              key={state}
              className="od-growth__tab"
              data-active={campaignState === state}
              href={campaignStateHref(state, audienceMonth, audienceTemperature)}
            >
              {state === "all" ? "All" : state[0]!.toUpperCase() + state.slice(1)}
            </Link>
          ))}
        </nav>

        <div className="od-cp__columns">
        <section className="od-cp__panel" aria-labelledby="whatsapp-campaigns-list">
          <div className="od-cp__toolbar">
            <h2 id="whatsapp-campaigns-list" className="od-cp__panel-title" style={{ margin: 0 }}>
              WhatsApp campaign versions · {visibleVersions.length}
            </h2>
            {permissions["campaigns.draft"] ? (
              <Link className="od-cp__btn od-cp__btn--quiet" href="/admin/campaigns">
                New campaign draft
              </Link>
            ) : null}
          </div>
          {visibleVersions.length === 0 ? (
            <p className="od-cp__empty">
              {permissions["campaigns.read"]
                ? "No WhatsApp-only campaign version yet. Draft one in Campaigns with channel whatsapp and direct/custom targeting."
                : "No approved WhatsApp campaign is waiting for an operator."}
            </p>
          ) : (
            <ul className="od-growth__campaign-list">
              {visibleVersions.map((version) => (
                <li key={version.versionId}>
                  <Link
                    className="od-growth__campaign-card"
                    href={`${WHATSAPP_ADMIN_CAMPAIGNS_PATH}?version=${version.versionId}`}
                    aria-current={version.versionId === selected?.versionId ? "true" : undefined}
                  >
                    <span className="od-cp__list-row">
                      <span className="od-cp__name">{version.campaignName}</span>
                      <span className="od-cp__badge" data-tone={version.status === "approved" ? "positive" : undefined}>
                        {version.status.replace(/_/g, " ")}
                      </span>
                    </span>
                    <span className="od-cp__sub">
                      v{version.versionNumber} · {version.templateName ?? "No template"} · {version.segmentName ?? "No saved segment"}
                    </span>
                    <span className="od-cp__sub">
                      Updated {formatWhen(version.updatedAt)}
                      {version.latestRun ? ` · latest run ${version.latestRun.status}` : " · not sent yet"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="od-cp">
          {selectedId && !selected ? (
            <p className="od-cp__notice" data-tone="negative">
              That campaign version does not exist or is not visible to you.
            </p>
          ) : selected ? (
            <>
              <section className="od-cp__panel" aria-labelledby="whatsapp-campaign-journey">
                <div className="od-cp__toolbar">
                  <div>
                    <p className="od-growth__eyebrow">Campaign setup</p>
                    <h2 id="whatsapp-campaign-journey" className="od-cp__panel-title" style={{ margin: 0 }}>
                      {selected.campaignName} · v{selected.versionNumber}
                    </h2>
                    <p className="od-cp__hint" style={{ marginBlockStart: 6 }}>
                      Move from template setup to audience proof, approval and governed delivery.
                    </p>
                  </div>
                  <span className="od-cp__badge" data-tone={approval.tone}>
                    {approval.label}
                  </span>
                </div>

                <div className="od-growth__journey od-growth__journey--campaign" style={{ marginTop: 16 }}>
                  <div className="od-growth__step" data-state="done">Audience</div>
                  <div className="od-growth__step" data-state={previewReady ? "done" : "active"}>Eligibility</div>
                  <div className="od-growth__step" data-state={spec ? "done" : previewReady ? "active" : undefined}>Template</div>
                  <div className="od-growth__step" data-state={spec ? "done" : undefined}>Variables</div>
                  <div className="od-growth__step" data-state={ctaReady ? "done" : spec ? "active" : undefined}>CTA</div>
                  <div className="od-growth__step" data-state={previewReady ? "done" : spec ? "active" : undefined}>Preview</div>
                  <div className="od-growth__step" data-state={testReady ? "done" : previewReady ? "active" : undefined}>Test</div>
                  <div className="od-growth__step" data-state={approval.approved ? "done" : testReady ? "active" : undefined}>Approval</div>
                  <div className="od-growth__step" data-state={scheduledReady ? "done" : approval.approved ? "active" : undefined}>Schedule</div>
                  <div className="od-growth__step" data-state={launched ? "done" : scheduledReady ? "active" : undefined}>Launch</div>
                </div>

                <div className="od-growth__readiness" style={{ marginTop: 16 }}>
                  {readiness.map((item) => (
                    <div key={item.label} className="od-growth__readiness-row">
                      <span><span className="od-growth__dot" data-state={item.ready ? "ready" : "blocked"} />{item.label}</span>
                      <strong>{item.ready ? "Ready" : "Needs attention"}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="od-cp__panel" aria-labelledby="whatsapp-campaign-approval">
                <h2 id="whatsapp-campaign-approval" className="od-cp__panel-title">
                  {selected.campaignName} · v{selected.versionNumber}
                </h2>
                <div className="od-cp__chips" data-testid="whatsapp-campaign-approval-state">
                  <span className="od-cp__badge" data-tone={approval.tone}>
                    Approval: {approval.label}
                  </span>
                  <span className="od-cp__badge">Version: {selected.status.replace(/_/g, " ")}</span>
                  {selected.approval?.decidedAt ? <span className="od-cp__badge">Decided {formatWhen(selected.approval.decidedAt)}</span> : null}
                  {selected.approval?.decidedByMe ? <span className="od-cp__badge">You decided</span> : null}
                </div>
                <p className="od-cp__hint" style={{ marginBlockStart: 10 }}>
                  Approval comes from the generic campaign workflow
                  {permissions["campaigns.read"] ? (
                    <>
                      {" "}
                      (<Link href={`/admin/campaigns/${selected.campaignId}`}>open campaign</Link>)
                    </>
                  ) : null}
                  . Submitting the version for approval freezes this WhatsApp spec.
                </p>
                {denial ? (
                  <p className="od-cp__notice" data-tone="warning">
                    {denial}
                  </p>
                ) : null}
              </section>

              <section className="od-cp__panel" aria-labelledby="whatsapp-campaign-spec">
                <h2 id="whatsapp-campaign-spec" className="od-cp__panel-title">
                  1 · WhatsApp spec {spec ? `· ${spec.state}` : ""}
                </h2>
                {draftEditable ? (
                  <>
                    <CampaignSpecForm
                      key={`${selected.versionId}:${spec?.templateSnapshotId ?? "new"}`}
                      campaignVersionId={selected.versionId}
                      templates={templates}
                      segments={segments.filter((segment) => segment.isActive).map((segment) => ({ id: segment.id, name: segment.name }))}
                      templateSnapshotId={spec?.templateSnapshotId ?? selected.previousSpec?.templateSnapshotId ?? ""}
                      preferenceCategory={spec?.preferenceCategory ?? selected.previousSpec?.preferenceCategory ?? ""}
                      segmentId={spec?.segmentId ?? ""}
                      defaultParameters={spec?.defaultParameters ?? {}}
                      parameterBindings={spec?.parameterBindings ?? {}}
                    />
                    {spec ? (
                      <CampaignButtonBindingsForm
                        campaignVersionId={selected.versionId}
                        components={spec.components}
                        bindings={buttonBindings}
                        destinations={clickDestinations}
                        flows={flows.map((flow) => ({ id: flow.id, name: flow.name, providerFlowId: flow.providerFlowId }))}
                        locked={false}
                      />
                    ) : null}
                  </>
                ) : spec ? (
                  <dl className="od-cp__dl">
                    <dt>Template</dt>
                    <dd>
                      {spec.templateName} · {spec.templateLanguage}
                      {spec.templateProblem ? ` · ${describeWhatsappCampaignReason(spec.templateProblem)}` : ""}
                    </dd>
                    <dt>Category</dt>
                    <dd>{spec.preferenceCategory.replace(/_/g, " ")}</dd>
                    <dt>Segment</dt>
                    <dd>{spec.segmentName ?? "None"}</dd>
                    <dt>Frozen</dt>
                    <dd>{spec.frozenAt ? formatWhen(spec.frozenAt) : "Not yet"}</dd>
                  </dl>
                ) : (
                  <p className="od-cp__empty">No WhatsApp spec. A Super Admin adds it while the version is a draft.</p>
                )}
              </section>

              <section className="od-cp__panel" aria-labelledby="whatsapp-campaign-preview">
                <div className="od-cp__toolbar">
                  <h2 id="whatsapp-campaign-preview" className="od-cp__panel-title" style={{ margin: 0 }}>
                    2 · Audience preview
                  </h2>
                  {spec ? (
                    <Link className="od-cp__btn od-cp__btn--quiet" href={`${WHATSAPP_ADMIN_CAMPAIGNS_PATH}?version=${selected.versionId}&preview=1`}>
                      {preview ? "Refresh preview" : "Preview audience"}
                    </Link>
                  ) : null}
                </div>
                {!spec && crmEligibilityPreview ? (
                  <>
                    <div className="od-cp__stats" data-testid="crm-campaign-eligibility-counts">
                      <div className="od-cp__stat">
                        <span className="od-cp__stat-value">{crmEligibilityPreview.ruleMatchLeadCount.toLocaleString("en-IN")}</span>
                        <span className="od-cp__stat-label">CRM matched leads</span>
                      </div>
                      <div className="od-cp__stat">
                        <span className="od-cp__stat-value">{crmEligibilityPreview.distinctContactCount.toLocaleString("en-IN")}</span>
                        <span className="od-cp__stat-label">Distinct contacts</span>
                      </div>
                      <div className="od-cp__stat">
                        <span className="od-cp__stat-value">{crmEligibilityPreview.currentMarketingConsentCount.toLocaleString("en-IN")}</span>
                        <span className="od-cp__stat-label">Marketing consent</span>
                      </div>
                      <div className="od-cp__stat">
                        <span className="od-cp__stat-value">{crmEligibilityPreview.dncBlockedCount.toLocaleString("en-IN")}</span>
                        <span className="od-cp__stat-label">DNC blocked</span>
                      </div>
                      <div className="od-cp__stat">
                        <span className="od-cp__stat-value">{(crmEligibilityPreview.eligibleDirectOrCustomCount ?? 0).toLocaleString("en-IN")}</span>
                        <span className="od-cp__stat-label">Channel eligible</span>
                      </div>
                    </div>
                    <p className="od-cp__hint" style={{ marginBlockStart: 12 }}>
                      This is the pre-template CRM eligibility proof. Choose an approved MARKETING template next;
                      the detailed WhatsApp preview will then add template status, variables, opt-out/suppression,
                      frequency caps, quiet hours and CTA readiness.
                    </p>
                  </>
                ) : !spec ? (
                  <p className="od-cp__empty">The CRM audience eligibility preview is unavailable for this version.</p>
                ) : preview === null ? (
                  <p className="od-cp__hint">CRM eligibility is proven. Use Preview audience for the template-aware WhatsApp checks.</p>
                ) : preview.kind === "ready" ? (
                  <>
                    <div className="od-cp__stats" data-testid="whatsapp-campaign-preview-counts">
                      <div className="od-cp__stat">
                        <span className="od-cp__stat-value">{preview.preview.totalMatched.toLocaleString("en-IN")}</span>
                        <span className="od-cp__stat-label">Matched</span>
                      </div>
                      <div className="od-cp__stat">
                        <span className="od-cp__stat-value">{preview.preview.eligible.toLocaleString("en-IN")}</span>
                        <span className="od-cp__stat-label">Eligible now</span>
                      </div>
                      {preview.preview.reasons.map((reason) => (
                        <div key={reason.code} className="od-cp__stat">
                          <span className="od-cp__stat-value">{reason.count.toLocaleString("en-IN")}</span>
                          <span className="od-cp__stat-label">{describeWhatsappCampaignReason(reason.code)}</span>
                        </div>
                      ))}
                    </div>
                    <ul className="od-cp__hint" style={{ margin: "12px 0 0", paddingInlineStart: 18 }}>
                      {!preview.preview.executionEnabled ? <li>Marketing execution is off in Settings &amp; Compliance.</li> : null}
                      {preview.preview.templateProblem ? <li>Template: {describeWhatsappCampaignReason(preview.preview.templateProblem)}.</li> : null}
                      {preview.preview.buttonBindingsProblem ? (
                        <li>Buttons: {describeWhatsappCampaignReason(preview.preview.buttonBindingsProblem)}.</li>
                      ) : null}
                      {preview.preview.segmentChangedSinceSaved ? <li>The saved segment changed after this spec copied it.</li> : null}
                      {preview.preview.quietUntil ? <li>Quiet hours now; sends defer until {formatWhen(preview.preview.quietUntil)}.</li> : null}
                    </ul>
                  </>
                ) : (
                  <p className="od-cp__notice" data-tone="negative">
                    The preview could not be calculated. Check that the version has a frozen audience rule and a spec.
                  </p>
                )}
              </section>

              {permissions["whatsapp.campaigns.test_send"] && spec ? (
                <section className="od-cp__panel" aria-labelledby="whatsapp-campaign-test">
                  <h2 id="whatsapp-campaign-test" className="od-cp__panel-title">
                    3 · Test send
                  </h2>
                  <CampaignTestSendForm campaignVersionId={selected.versionId} destinations={testDestinations} />
                  {testSends.length > 0 ? (
                    <ul className="od-cp__chips" style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                      {testSends.map((testSend) => (
                        <li key={testSend.id} className="od-cp__badge" data-tone={testSend.outcome === "succeeded" ? "positive" : undefined}>
                          {testSend.destinationLabel} · {testSend.outcome.replace(/_/g, " ")}
                          {testSend.lastErrorCode ? ` · ${describeWhatsappCampaignReason(testSend.lastErrorCode)}` : ""} · {formatWhen(testSend.createdAt)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              <section className="od-cp__panel" aria-labelledby="whatsapp-campaign-runs">
                <h2 id="whatsapp-campaign-runs" className="od-cp__panel-title">
                  4 · Runs · {selected.runs.length}
                </h2>
                {spec?.state === "frozen" && approval.approved && !selected.operatorDenial && selected.runs.length === 0 ? (
                  <CampaignCreateRunForm campaignVersionId={selected.versionId} />
                ) : selected.runs.length === 0 ? (
                  <p className="od-cp__hint">
                    {!spec ? "Save a spec first." : !approval.approved ? "A run can be created once this version is approved." : denial ?? "One approval authorises one delivery."}
                  </p>
                ) : null}
                {selected.runs.length === 0 ? null : (
                  <div className="od-cp__table-wrap" style={{ marginBlockStart: 16 }}>
                    <table className="od-cp__table" data-testid="whatsapp-campaign-runs-table">
                      <thead>
                        <tr>
                          <th scope="col">Status</th>
                          <th scope="col">Scheduled</th>
                          <th scope="col">Eligible / total</th>
                          <th scope="col">Sent</th>
                          <th scope="col">Skipped</th>
                          <th scope="col">Failed</th>
                          <th scope="col">Reconcile</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.runs.map((run) => (
                          <tr key={run.id}>
                            <td>
                              <span className="od-cp__badge" data-tone={whatsappCampaignRunTone(run.status)}>
                                {run.status}
                              </span>
                              {run.failureCode ? <span className="od-cp__sub">{run.failureCode}</span> : null}
                            </td>
                            <td>{formatWhen(run.scheduledFor)}</td>
                            <td>
                              {run.eligibleCount.toLocaleString("en-IN")} / {run.totalCount.toLocaleString("en-IN")}
                            </td>
                            <td>{run.sentCount.toLocaleString("en-IN")}</td>
                            <td>{run.skippedCount.toLocaleString("en-IN")}</td>
                            <td>{run.failedCount.toLocaleString("en-IN")}</td>
                            <td>{run.reconcileCount.toLocaleString("en-IN")}</td>
                            <td>
                              <CampaignRunControls
                                runId={run.id}
                                operations={selected.operatorDenial ? [] : availableWhatsappCampaignRunOperations(run.status, campaignPermissions)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {breakdown ? (
                  <div style={{ marginBlockStart: 16 }}>
                    <h3 className="od-cp__panel-title">Latest run detail</h3>
                    <div className="od-cp__chips">
                      {breakdown.reasons.map((reason) => (
                        <span key={reason.code} className="od-cp__badge">
                          {describeWhatsappCampaignReason(reason.code)} · {reason.count}
                        </span>
                      ))}
                      {breakdown.deferredCount > 0 ? (
                        <span className="od-cp__badge" data-tone="warning">
                          Deferred {breakdown.deferredCount} until {formatWhen(breakdown.nextNotBefore)}
                        </span>
                      ) : null}
                      {breakdown.retryingCount > 0 ? <span className="od-cp__badge">Retrying {breakdown.retryingCount}</span> : null}
                    </div>
                    {breakdown.reconcileJobIds.length > 0 ? (
                      <div className="od-cp__stack" style={{ marginBlockStart: 12 }}>
                        <p className="od-cp__notice" data-tone="warning">
                          {breakdown.reconcileJobIds.length} send(s) have an unknown provider outcome. They are never retried automatically.
                        </p>
                        {breakdown.reconcileJobIds.slice(0, 10).map((jobId) => (
                          <CampaignReconcileForm key={jobId} jobId={jobId} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <section className="od-cp__panel">
              <p className="od-cp__empty">Choose a campaign version to set up its WhatsApp spec, preview, test and runs.</p>
            </section>
          )}
        </div>
      </div>
    </div>
    </ControlPlaneShell>
  );
}
