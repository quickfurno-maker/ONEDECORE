"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createCampaignDraftAction } from "@/features/marketing/server/campaign-actions";
import {
  buildWhatsappCrmAudienceRule,
  WHATSAPP_CRM_ACTIVITY_AGE_OPTIONS,
  WHATSAPP_CRM_AUDIENCE_TEMPERATURES,
  WHATSAPP_CRM_BUDGET_OPTIONS,
  WHATSAPP_CRM_DORMANT_OPTIONS,
  WHATSAPP_CRM_MILESTONE_OPTIONS,
  WHATSAPP_CRM_PROJECT_TIMELINE_OPTIONS,
  WHATSAPP_CRM_SERVICE_OPTIONS,
  WHATSAPP_CRM_STAGE_OPTIONS,
  WHATSAPP_CRM_TEMPERATURE_LABELS,
  whatsappCrmMonthLabel,
  type WhatsappCrmAudienceCounts,
  type WhatsappCrmCampaignFilterOptions,
  type WhatsappCrmCampaignFilters,
  type WhatsappCrmAudiencePreset,
  type WhatsappCrmAudienceTemperature,
} from "../../contracts/crm-campaigns";

const CAMPAIGNS_PATH = "/admin/whatsapp/campaigns";

function selectedLabel(
  value: string | undefined,
  options: readonly (readonly [string, string])[]
): string | null {
  return options.find(([candidate]) => candidate === value)?.[1] ?? null;
}

export function CrmCampaignLauncher({
  month,
  temperature,
  filters,
  options,
  counts,
  startDate,
  canCreate,
  preset = "standard",
  surfacePath = CAMPAIGNS_PATH,
  templateSnapshotId = null,
  schedulerHandoff = false,
}: {
  readonly month: string;
  readonly temperature: WhatsappCrmAudienceTemperature;
  readonly filters: WhatsappCrmCampaignFilters;
  readonly options: WhatsappCrmCampaignFilterOptions;
  readonly counts: WhatsappCrmAudienceCounts;
  readonly startDate: string;
  readonly canCreate: boolean;
  readonly preset?: WhatsappCrmAudiencePreset;
  readonly surfacePath?: string;
  readonly templateSnapshotId?: string | null;
  readonly schedulerHandoff?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const monthLabel = whatsappCrmMonthLabel(month);
  const nurtureMode = preset === "long-term-nurture";
  const temperatureLabel = temperature === "all"
    ? nurtureMode ? "All long-term nurture leads" : "All leads"
    : WHATSAPP_CRM_TEMPERATURE_LABELS[temperature];
  const ruleGroup = useMemo(
    () => JSON.stringify(buildWhatsappCrmAudienceRule(temperature, month, filters, {
      allReceivedMonths: nurtureMode,
      excludeTerminalStages: nurtureMode,
    })),
    [temperature, month, filters, nurtureMode]
  );
  const serviceLabel = selectedLabel(filters.service, WHATSAPP_CRM_SERVICE_OPTIONS);
  const defaultName = nurtureMode
    ? `Long-term nurture promotion – ${temperatureLabel}${serviceLabel ? ` – ${serviceLabel}` : ""}`
    : `${monthLabel} ${temperatureLabel}${serviceLabel ? ` – ${serviceLabel}` : ""}`;
  const selectedCount = temperature === "all" ? counts.total : counts[temperature];

  const temperatureHref = (value: WhatsappCrmAudienceTemperature) => {
    const params = new URLSearchParams();
    params.set("audienceMonth", month);
    params.set("audienceTemperature", value);
    if (nurtureMode) params.set("audiencePreset", "long-term-nurture");
    if (templateSnapshotId) params.set("templateSnapshotId", templateSnapshotId);
    for (const [key, filterValue] of Object.entries(filters)) {
      if (filterValue) params.set(key, filterValue);
    }
    return `${surfacePath}?${params.toString()}#crm-campaign-launcher`;
  };
  return (
    <section id="crm-campaign-launcher" className="od-cp__panel od-growth__crm-launcher">
      <div className="od-cp__toolbar">
        <div>
          <p className="od-growth__eyebrow">{nurtureMode ? "CRM nurture promotions" : "CRM-native audience builder"}</p>
          <h2 className="od-cp__panel-title" style={{ margin: 0 }}>
            {nurtureMode ? "Promote to long-term leads safely" : "Campaign by CRM lead truth"}
          </h2>
          <p className="od-cp__hint" style={{ marginBlockStart: 6 }}>
            {nurtureMode
              ? "Targets leads whose project timeline is after 2 months, across all received months. Marketing consent and WhatsApp eligibility are still mandatory."
              : "Pick the audience in plain CRM terms. No JSON, contact export or Meta setup is required here."}
          </p>
        </div>
      </div>

      <div className="od-growth__kpis od-growth__temperature-grid" aria-label={`${monthLabel} lead temperatures`}>
        {WHATSAPP_CRM_AUDIENCE_TEMPERATURES
          .filter((value) => nurtureMode ? value !== "lost" : value !== "all")
          .map((value) => (
          <Link
            key={value}
            href={temperatureHref(value)}
            className="od-growth__kpi od-growth__temperature-card"
            data-active={temperature === value}
          >
            <strong>{(value === "all" ? counts.total : counts[value]).toLocaleString("en-IN")}</strong>
            <span>{value === "all" ? "All leads" : WHATSAPP_CRM_TEMPERATURE_LABELS[value]}</span>
          </Link>
        ))}
      </div>

      <form method="get" action={surfacePath} className="od-cp__stack od-growth__crm-filters">
        <input type="hidden" name="audienceTemperature" value={temperature} />
        {templateSnapshotId ? <input type="hidden" name="templateSnapshotId" value={templateSnapshotId} /> : null}
        {nurtureMode ? <input type="hidden" name="audiencePreset" value="long-term-nurture" /> : null}
        {nurtureMode ? <input type="hidden" name="projectTimeline" value="after-2-months" /> : null}
        <div className="od-cp__grid">
          {nurtureMode ? (
            <div className="od-cp__field">
              <span>Lead scope</span>
              <strong>After 2 months · all received months</strong>
            </div>
          ) : (
            <label className="od-cp__field">
              <span>Lead month</span>
              <input name="audienceMonth" type="month" defaultValue={month} />
            </label>
          )}
          <label className="od-cp__field">
            <span>Stage</span>
            <select name="stage" defaultValue={filters.stage ?? ""}>
              <option value="">Any stage</option>
              {WHATSAPP_CRM_STAGE_OPTIONS
                .filter(([value]) => !nurtureMode || !["closed_won", "closed_lost"].includes(value))
                .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="od-cp__field">
            <span>Service</span>
            <select name="service" defaultValue={filters.service ?? ""}>
              <option value="">Any service</option>
              {WHATSAPP_CRM_SERVICE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="od-cp__field">
            <span>Source</span>
            <select name="source" defaultValue={filters.source ?? ""}>
              <option value="">Any source</option>
              {options.sources.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="od-cp__field">
            <span>Locality</span>
            <select name="locality" defaultValue={filters.locality ?? ""}>
              <option value="">Any locality</option>
              {options.localities.map((locality) => <option key={locality} value={locality}>{locality}</option>)}
            </select>
          </label>
          <label className="od-cp__field">
            <span>Owner</span>
            <select name="owner" defaultValue={filters.owner ?? ""}>
              <option value="">Any owner</option>
              <option value="unassigned">Unassigned</option>
              {options.owners.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="od-cp__field">
            <span>Budget</span>
            <select name="budget" defaultValue={filters.budget ?? ""}>
              <option value="">Any budget</option>
              {WHATSAPP_CRM_BUDGET_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="od-cp__field">
            <span>Last interaction</span>
            <select name="lastInteractionAge" defaultValue={filters.lastInteractionAge ?? ""}>
              <option value="">Any activity age</option>
              {WHATSAPP_CRM_ACTIVITY_AGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="od-cp__field">
            <span>Consultation / site visit / quotation</span>
            <select name="milestone" defaultValue={filters.milestone ?? ""}>
              <option value="">Any milestone</option>
              {WHATSAPP_CRM_MILESTONE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {nurtureMode ? null : (
            <label className="od-cp__field">
              <span>Project timeline</span>
              <select name="projectTimeline" defaultValue={filters.projectTimeline ?? ""}>
                <option value="">Any project timeline</option>
                {WHATSAPP_CRM_PROJECT_TIMELINE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          )}
          <label className="od-cp__field">
            <span>Dormant duration</span>
            <select name="dormantDuration" defaultValue={filters.dormantDuration ?? ""}>
              <option value="">Any hold duration</option>
              {WHATSAPP_CRM_DORMANT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="od-tpl__inline-form">
          <button className="od-cp__btn od-cp__btn--primary" type="submit">Apply CRM audience</button>
          <Link className="od-cp__btn od-cp__btn--quiet" href={`${surfacePath}?audienceMonth=${month}&audienceTemperature=${temperature}${nurtureMode ? "&audiencePreset=long-term-nurture" : ""}${templateSnapshotId ? `&templateSnapshotId=${templateSnapshotId}` : ""}#crm-campaign-launcher`}>
            Clear advanced filters
          </Link>
        </div>
      </form>
      <div className="od-growth__readiness">
        <div className="od-growth__readiness-row">
          <span>CRM audience</span>
          <strong>{temperatureLabel} · {nurtureMode ? "After 2 months / all-time" : monthLabel}</strong>
        </div>
        <div className="od-growth__readiness-row">
          <span>Base leads in bucket</span>
          <strong>{selectedCount.toLocaleString("en-IN")}</strong>
        </div>
        <div className="od-growth__readiness-row">
          <span>Eligibility proof</span>
          <strong>Calculated after draft creation</strong>
        </div>
      </div>

      <p className="od-cp__hint">
        Exact campaign preview then separates CRM matched, current marketing consent, WhatsApp availability,
        DNC/opt-out, frequency caps, missing variables and final eligible recipients. Every recipient is
        revalidated again immediately before dispatch.
      </p>

      {canCreate ? (
        <form
          className="od-cp__stack od-growth__crm-create"
          action={async (formData) => {
            const result = await createCampaignDraftAction(formData);
            setMessage(result.message);
            if (result.success && result.data?.campaignVersionId) {
              const next = new URLSearchParams({
                version: result.data.campaignVersionId,
                preview: "1",
              });
              if (templateSnapshotId) next.set("templateSnapshotId", templateSnapshotId);
              if (schedulerHandoff) next.set("scheduleReturn", "1");
              router.push(`${CAMPAIGNS_PATH}?${next.toString()}`);
            }
          }}
        >
          <input type="hidden" name="targetingMode" value="direct_or_custom" />
          <input type="hidden" name="intendedChannels" value="whatsapp" />
          <input type="hidden" name="destinationReference" value="" />
          <input type="hidden" name="dailyBudgetPaise" value="0" />
          <input type="hidden" name="totalBudgetPaise" value="" />
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="endDate" value="" />
          <input type="hidden" name="headline" value={defaultName} />
          <input type="hidden" name="primaryText" value="CRM-native WhatsApp campaign. Content is supplied by the approved WhatsApp template." />
          <input type="hidden" name="callToAction" value="WhatsApp" />
          <input type="hidden" name="ruleGroup" value={ruleGroup} />

          <div className="od-cp__grid">
            <label className="od-cp__field">
              <span>Campaign name</span>
              <input name="name" required minLength={2} maxLength={160} defaultValue={defaultName} />
            </label>
            <label className="od-cp__field">
              <span>Version title</span>
              <input name="title" required minLength={2} maxLength={160} defaultValue={defaultName} />
            </label>
          </div>
          <div className="od-tpl__inline-form">
            <button type="submit" className="od-cp__btn od-cp__btn--primary">
              {schedulerHandoff
                ? "Prepare scheduled campaign"
                : nurtureMode
                  ? "Create nurture promotion"
                  : "Create CRM WhatsApp campaign"}
            </button>
            {message ? <p role="status" className="od-cp__hint">{message}</p> : null}
          </div>
          <p className="od-cp__hint">
            {schedulerHandoff
              ? "This creates the governed campaign draft first. Finish template variables, test and approval; it will then appear in Scheduler as ready for a delivery slot."
              : "Creating the draft does not send anything. Provider execution remains governed by approved MARKETING template, consent, approval, scheduling and the global WhatsApp execution switch."}
          </p>
        </form>
      ) : (
        <p className="od-cp__notice">
          You can operate approved WhatsApp campaigns, but creating the underlying campaign draft remains a Super Admin action.
        </p>
      )}
    </section>
  );
}
