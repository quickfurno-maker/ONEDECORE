import type { Metadata } from "next";
import Link from "next/link";
import {
  AutomationEditorForm,
  AutomationReconcileForm,
  AutomationStatusControls,
} from "@/features/whatsapp/components/automations/AutomationForms";
import { ControlPlaneDenied, ControlPlaneShell } from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import {
  buildWebsiteLeadAcknowledgementReadiness,
  buildWhatsappAutomationPresetHref,
  buildWhatsappOperationalAlerts,
  getWhatsappAutomationPreset,
  ONEDECORE_WHATSAPP_AUTOMATION_PRESETS,
  ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES,
  presetTriggerLabel,
} from "@/features/whatsapp/contracts/automation-presets";
import { WHATSAPP_AUTOMATION_TRIGGER_LABELS, type WhatsappAutomationTrigger } from "@/features/whatsapp/contracts/automations";
import { describeWhatsappCampaignOperatorDenial, describeWhatsappCampaignReason } from "@/features/whatsapp/contracts/campaign-execution";
import { isUuid, WHATSAPP_ADMIN_AUTOMATIONS_PATH } from "@/features/whatsapp/contracts/control-plane";
import {
  getWhatsappAutomationForCurrentUser,
  listWhatsappAutomationsForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-automation-queries";
import { listWhatsappCampaignVersionsForCurrentUser } from "@/features/whatsapp/server/whatsapp-campaign-queries";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";
import { listWhatsappFlowsForCurrentUser } from "@/features/whatsapp/server/whatsapp-flow-queries";
import { getWhatsappMarketingReadiness } from "@/features/whatsapp/server/whatsapp-readiness";
import { getWhatsappSendPolicyForCurrentUser } from "@/features/whatsapp/server/whatsapp-settings-queries";
import { listWhatsappTemplateRegistryForCurrentUser } from "@/features/whatsapp/server/whatsapp-template-queries";
import { listWhatsappCrmOperationalAttentionForCurrentUser } from "@/features/whatsapp/server/whatsapp-operational-attention";
import "@/features/whatsapp/components/growth-workspace.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Automations | ONEDECORE",
};

/**
 * WM-6 Automations. whatsapp.automations.read to open; .manage to draft,
 * activate, pause, resume and archive (Super Admin, Sales Manager). Resolving
 * an ambiguous send is Super Admin only. Nothing on this page sends a message.
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

function delayLabel(minutes: number): string {
  if (minutes === 0) return "immediately";
  if (minutes % 1440 === 0) return `${minutes / 1440} day(s) later`;
  if (minutes % 60 === 0) return `${minutes / 60} hour(s) later`;
  return `${minutes} minutes later`;
}

interface WhatsappAutomationsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappAutomationsPage({ searchParams }: WhatsappAutomationsPageProps) {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.automations.read"]) {
    return (
      <ControlPlaneDenied
        title="You do not have Automations access"
        detail="Governed WhatsApp automations are limited to Super Admins and Sales Managers."
      />
    );
  }
  const { permissions } = access;
  const canManage = permissions["whatsapp.automations.manage"];
  const params = await searchParams;
  const selectedRaw = first(params.automation);
  const selectedId = isUuid(selectedRaw) ? selectedRaw : null;
  const creating = first(params.new) === "1";
  const preset = getWhatsappAutomationPreset(first(params.preset));
  const readiness = getWhatsappMarketingReadiness();
  const outboundRow = readiness.find((row) => row.key === "outbound");
  const outboundMode =
    outboundRow?.mode === "enabled" || outboundRow?.mode === "local-test"
      ? outboundRow.mode
      : "disabled";

  const [automations, selected, versions, flows, sendPolicy, acknowledgementRegistry, crmOperationalAttention] = await Promise.all([
    listWhatsappAutomationsForCurrentUser(),
    selectedId ? getWhatsappAutomationForCurrentUser(selectedId) : Promise.resolve(null),
    canManage && permissions["whatsapp.campaigns.execute"] ? listWhatsappCampaignVersionsForCurrentUser() : Promise.resolve([]),
    canManage && permissions["whatsapp.flows.read"] ? listWhatsappFlowsForCurrentUser() : Promise.resolve([]),
    permissions["whatsapp.settings.read"]
      ? getWhatsappSendPolicyForCurrentUser()
      : Promise.resolve({ kind: "unreadable" } as const),
    permissions["whatsapp.templates.read"]
      ? listWhatsappTemplateRegistryForCurrentUser({
          status: "APPROVED",
          category: "UTILITY",
          language: null,
          q: "onedecore_new_enquiry_ack",
          page: 1,
          pageSize: 25,
        })
      : Promise.resolve({ items: [], totalCount: 0, page: 1, pageSize: 25 }),
    listWhatsappCrmOperationalAttentionForCurrentUser(),
  ]);

  const campaignOptions = versions
    .filter((version) => version.status === "approved" && version.specState === "frozen")
    .map((version) => ({ id: version.versionId, label: `${version.campaignName} · v${version.versionNumber} · ${version.templateName ?? "template"}` }));
  const flowOptions = flows.map((flow) => ({ id: flow.id, label: `${flow.name} · ${flow.providerStatus}` }));
  const approvedAcknowledgementTemplateCount = acknowledgementRegistry.items.filter(
    (template) => template.name === "onedecore_new_enquiry_ack" && template.status === "APPROVED" && template.category === "UTILITY"
  ).length;
  const operationalAlerts = buildWhatsappOperationalAlerts({
    automations,
    approvedCampaignCount: campaignOptions.length,
    sendPolicy,
    approvedAcknowledgementTemplateCount,
    outboundMode,
  });
  const acknowledgementReadiness = buildWebsiteLeadAcknowledgementReadiness({
    approvedTemplateCount: approvedAcknowledgementTemplateCount,
    outboundMode,
  });
  const allOperationalAlerts = [...crmOperationalAttention, ...operationalAlerts];
  const denial = describeWhatsappCampaignOperatorDenial(selected?.operatorDenial ?? null);

  return (
    <ControlPlaneShell
      active="automations"
      title="Automations"
      lede="One governed follow-up per trigger: an approved MARKETING template from an approved campaign, re-checked for consent, opt-outs, suppression, caps and quiet hours just before it sends."
      permissions={permissions}
    >
      <section className="od-cp__panel" aria-labelledby="whatsapp-automation-attention">
        <div className="od-cp__toolbar">
          <div>
            <p className="od-growth__eyebrow">P5 operational attention</p>
            <h2 id="whatsapp-automation-attention" className="od-cp__panel-title" style={{ margin: 0 }}>
              Attention centre
            </h2>
          </div>
          <span className="od-cp__badge">{allOperationalAlerts.length} signal{allOperationalAlerts.length === 1 ? "" : "s"}</span>
        </div>
        <div className="od-cp__stack" style={{ marginBlockStart: 12 }}>
          {allOperationalAlerts.map((alert) => (
            <div
              key={alert.id}
              className="od-cp__notice"
              data-tone={alert.tone === "critical" ? "negative" : alert.tone === "warning" ? "warning" : undefined}
            >
              <strong>{alert.title}</strong>
              <span className="od-cp__sub">{alert.detail}</span>
              {alert.href ? (
                <Link className="od-cp__btn od-cp__btn--quiet" href={alert.href} style={{ marginBlockStart: 8 }}>
                  Open
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="od-cp__columns">
        <section className="od-cp__panel" aria-labelledby="crm-cadence-boundary">
          <p className="od-growth__eyebrow">CRM execution</p>
          <h2 id="crm-cadence-boundary" className="od-cp__panel-title">CRM Cadence</h2>
          <p className="od-cp__hint">
            Human sales work: calls, follow-up tasks, consultations and next actions. A CRM Cadence never sends a WhatsApp marketing message.
          </p>
          <Link className="od-cp__btn od-cp__btn--quiet" href="/admin/crm/cadences">
            Open CRM Cadences
          </Link>
        </section>
        <section className="od-cp__panel" aria-labelledby="whatsapp-automation-boundary">
          <p className="od-growth__eyebrow">WhatsApp execution</p>
          <h2 id="whatsapp-automation-boundary" className="od-cp__panel-title">WhatsApp Automation</h2>
          <p className="od-cp__hint">
            One governed MARKETING template after a trigger. It requires explicit MARKETING consent, an approved campaign/template, policy gates and JIT eligibility.
          </p>
          <span className="od-cp__badge">Separate from CRM Cadence</span>
        </section>
      </div>

      <section className="od-cp__panel" aria-labelledby="whatsapp-automation-recipes">
        <div className="od-cp__toolbar">
          <div>
            <p className="od-growth__eyebrow">ONEDECORE recipes</p>
            <h2 id="whatsapp-automation-recipes" className="od-cp__panel-title" style={{ margin: 0 }}>
              Start from a safe recipe
            </h2>
          </div>
        </div>
        <p className="od-cp__hint">
          Recipes only prefill a draft. They never select an executable template for you, never grant consent and never activate themselves.
        </p>
        <div className="od-growth__template-grid" style={{ marginBlockStart: 12 }}>
          {ONEDECORE_WHATSAPP_AUTOMATION_PRESETS.map((recipe) => (
            <article key={recipe.id} className="od-growth__template-card">
              <div>
                <strong className="od-cp__name">{recipe.title}</strong>
                <span className="od-cp__sub">{recipe.summary}</span>
                <div className="od-growth__template-meta">
                  <span className="od-cp__badge">{presetTriggerLabel(recipe)}</span>
                  <span className="od-cp__badge">{delayLabel(recipe.delayMinutes)}</span>
                </div>
              </div>
              {canManage ? (
                <Link className="od-cp__btn od-cp__btn--quiet" href={buildWhatsappAutomationPresetHref(recipe.id)}>
                  Use recipe
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="od-cp__panel" aria-labelledby="whatsapp-utility-recipes">
        <div className="od-cp__toolbar">
          <div>
            <p className="od-growth__eyebrow">Service communication recipes</p>
            <h2 id="whatsapp-utility-recipes" className="od-cp__panel-title" style={{ margin: 0 }}>
              Prepared Utility journeys
            </h2>
          </div>
          <span className="od-cp__badge">{ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES.length} recipes</span>
        </div>
        <p className="od-cp__hint">
          These map ONEDECORE lifecycle events to local UTILITY templates for new enquiry, assignment,
          appointments, quotation, project, payment, installation, handover and feedback. They are preparation
          records only: the current WhatsApp Automation engine remains MARKETING-only, so no Utility recipe can
          execute until its later governed service-automation lane and Meta approval are deliberately activated.
        </p>
        <div className="od-growth__template-grid" style={{ marginBlockStart: 12 }}>
          {ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES.map((recipe) => (
            <article key={recipe.id} className="od-growth__template-card">
              <div>
                <strong className="od-cp__name">{recipe.title}</strong>
                <span className="od-cp__sub">{recipe.detail}</span>
                <div className="od-growth__template-meta">
                  <span className="od-cp__badge">UTILITY · prepared</span>
                  <span className="od-cp__badge">{recipe.event}</span>
                </div>
                <span className="od-cp__sub">Template preset: {recipe.templatePresetId}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="od-cp__panel" aria-labelledby="website-lead-ack-readiness">
        <div className="od-cp__toolbar">
          <div>
            <p className="od-growth__eyebrow">Utility acknowledgement</p>
            <h2 id="website-lead-ack-readiness" className="od-cp__panel-title" style={{ margin: 0 }}>
              Website lead acknowledgement
            </h2>
          </div>
          <span className="od-cp__badge" data-tone={acknowledgementReadiness.status === "ready-for-later-activation" ? "positive" : "warning"}>
            {acknowledgementReadiness.status === "ready-for-later-activation" ? "Prepared" : "Dormant"}
          </span>
        </div>
        <p className="od-cp__hint">
          This is a WHATSAPP_SERVICE Utility path, not a marketing automation. It remains dormant until the exact provider template is approved and outbound is deliberately activated later.
        </p>
        <div className="od-growth__readiness" style={{ marginBlockStart: 12 }}>
          {acknowledgementReadiness.gates.map((gate) => (
            <div key={gate.label} className="od-growth__readiness-row">
              <span><span className="od-growth__dot" data-state={gate.ready ? "ready" : "blocked"} />{gate.label}</span>
              <strong>{gate.ready ? "Ready" : "Waiting"}</strong>
            </div>
          ))}
        </div>
        <p className="od-cp__hint" style={{ marginBlockStart: 10 }}>
          No website submission currently triggers a provider call from this P5 preparation.
        </p>
      </section>

      <div className="od-cp__columns">
        <section className="od-cp__panel" aria-labelledby="whatsapp-automations-list">
          <div className="od-cp__toolbar">
            <h2 id="whatsapp-automations-list" className="od-cp__panel-title" style={{ margin: 0 }}>
              Automations · {automations.length}
            </h2>
            {canManage ? (
              <Link className="od-cp__btn od-cp__btn--quiet" href={`${WHATSAPP_ADMIN_AUTOMATIONS_PATH}?new=1`}>
                New automation
              </Link>
            ) : null}
          </div>
          {automations.length === 0 ? (
            <p className="od-cp__empty">No automation yet.</p>
          ) : (
            <ul className="od-cp__list">
              {automations.map((automation) => (
                <li key={automation.id}>
                  <Link
                    className="od-cp__list-item"
                    href={`${WHATSAPP_ADMIN_AUTOMATIONS_PATH}?automation=${automation.id}`}
                    aria-current={automation.id === selected?.id ? "true" : undefined}
                  >
                    <span className="od-cp__list-row">
                      <span className="od-cp__name">{automation.name}</span>
                      <span
                        className="od-cp__badge"
                        data-tone={automation.status === "active" ? "positive" : automation.status === "paused" ? "warning" : undefined}
                      >
                        {automation.status}
                      </span>
                    </span>
                    <span className="od-cp__sub">
                      {WHATSAPP_AUTOMATION_TRIGGER_LABELS[automation.triggerType as WhatsappAutomationTrigger] ?? automation.triggerType} ·{" "}
                      {automation.enrollmentStates.sent ?? 0} sent
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="od-cp">
          {creating && canManage ? (
            <section className="od-cp__panel" aria-labelledby="whatsapp-automation-new">
              <h2 id="whatsapp-automation-new" className="od-cp__panel-title">
                {preset ? `New draft · ${preset.title}` : "New automation draft"}
              </h2>
              {preset ? (
                <p className="od-cp__hint">
                  Recipe loaded. Review every field and choose the approved campaign/template before saving.
                </p>
              ) : null}
              <AutomationEditorForm automation={null} preset={preset} campaignVersions={campaignOptions} flows={flowOptions} />
            </section>
          ) : selectedId && !selected ? (
            <p className="od-cp__notice" data-tone="negative">
              That automation does not exist.
            </p>
          ) : selected ? (
            <>
              <section className="od-cp__panel" aria-labelledby="whatsapp-automation-detail">
                <h2 id="whatsapp-automation-detail" className="od-cp__panel-title">
                  {selected.name}
                </h2>
                <dl className="od-cp__dl">
                  <dt>When</dt>
                  <dd>
                    {WHATSAPP_AUTOMATION_TRIGGER_LABELS[selected.triggerType as WhatsappAutomationTrigger] ?? selected.triggerType}
                    {selected.triggerConfig.to_stage ? ` · ${selected.triggerConfig.to_stage.replace(/_/g, " ")}` : ""}
                    {selected.triggerConfig.source_id ? ` · ad ${selected.triggerConfig.source_id}` : ""}
                  </dd>
                  <dt>Send</dt>
                  <dd>
                    {selected.campaignName ?? "Campaign"} · v{selected.versionNumber ?? "?"} · {selected.templateName ?? "template"} ·{" "}
                    {delayLabel(selected.delayMinutes)}
                  </dd>
                  <dt>Stops</dt>
                  <dd>
                    {[...selected.stopOnLeadStatuses.map((status) => `lead ${status.replace(/_/g, " ")}`), selected.stopOnReply ? "customer replied" : null]
                      .filter(Boolean)
                      .join(" · ") || "Compliance checks only"}
                  </dd>
                  <dt>Status</dt>
                  <dd>
                    {selected.status}
                    {selected.activatedAt ? ` · first activated ${formatWhen(selected.activatedAt)}` : ""}
                  </dd>
                </dl>
                {selected.sendProblem ? (
                  <p className="od-cp__notice" data-tone="warning">
                    Cannot send now: {describeWhatsappCampaignReason(selected.sendProblem)}.
                  </p>
                ) : null}
                {denial && canManage ? (
                  <p className="od-cp__notice" data-tone="warning">
                    {denial}
                  </p>
                ) : null}
                <AutomationStatusControls automationId={selected.id} status={selected.status} lockVersion={selected.lockVersion} canManage={canManage} />
              </section>

              <section className="od-cp__panel" aria-labelledby="whatsapp-automation-enrollments">
                <h2 id="whatsapp-automation-enrollments" className="od-cp__panel-title">
                  Enrollments
                </h2>
                <div className="od-cp__stats">
                  {["pending", "sent", "skipped", "failed", "needs_reconcile", "cancelled"].map((state) => (
                    <div key={state} className="od-cp__stat">
                      <span className="od-cp__stat-value">{(selected.enrollmentStates[state] ?? 0).toLocaleString("en-IN")}</span>
                      <span className="od-cp__stat-label">{state.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
                {selected.reasons.length > 0 ? (
                  <div className="od-cp__chips" style={{ marginBlockStart: 12 }}>
                    {selected.reasons.map((reason) => (
                      <span key={reason.code} className="od-cp__badge">
                        {describeWhatsappCampaignReason(reason.code)} · {reason.count}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selected.nextNotBefore ? <p className="od-cp__hint">Next send due {formatWhen(selected.nextNotBefore)}.</p> : null}
                {selected.reconcileEnrollmentIds.length > 0 ? (
                  <div className="od-cp__stack" style={{ marginBlockStart: 12 }}>
                    <p className="od-cp__notice" data-tone="warning">
                      {selected.reconcileEnrollmentIds.length} send(s) have an unknown provider outcome. They are never retried automatically.
                    </p>
                    {selected.reconcileEnrollmentIds.slice(0, 10).map((id) => (
                      <AutomationReconcileForm key={id} enrollmentId={id} />
                    ))}
                  </div>
                ) : null}
              </section>

              {canManage && selected.status === "draft" ? (
                <section className="od-cp__panel" aria-labelledby="whatsapp-automation-edit">
                  <h2 id="whatsapp-automation-edit" className="od-cp__panel-title">
                    Edit draft
                  </h2>
                  <AutomationEditorForm key={selected.lockVersion} automation={selected} campaignVersions={campaignOptions} flows={flowOptions} />
                </section>
              ) : null}

              <section className="od-cp__panel" aria-labelledby="whatsapp-automation-events">
                <h2 id="whatsapp-automation-events" className="od-cp__panel-title">
                  Recent evidence
                </h2>
                {selected.events.length === 0 ? (
                  <p className="od-cp__empty">No events yet.</p>
                ) : (
                  <table className="od-cp__table">
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Event</th>
                        <th scope="col">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.events.map((event, index) => (
                        <tr key={`${event.occurredAt}-${index}`}>
                          <td>{formatWhen(event.occurredAt)}</td>
                          <td>
                            {event.eventType.replace(/_/g, " ")}
                            {event.reason ? ` · ${describeWhatsappCampaignReason(event.reason)}` : ""}
                          </td>
                          <td>{event.actorType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          ) : (
            <section className="od-cp__panel">
              <p className="od-cp__empty">Choose an automation{canManage ? " or create one" : ""}.</p>
            </section>
          )}
        </div>
      </div>
    </ControlPlaneShell>
  );
}
