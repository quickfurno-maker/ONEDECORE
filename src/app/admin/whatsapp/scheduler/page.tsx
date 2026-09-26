import type { Metadata } from "next";
import Link from "next/link";
import { CampaignCreateRunForm } from "@/features/whatsapp/components/campaigns/CampaignExecutionForms";
import { CampaignSchedulerCalendar } from "@/features/whatsapp/components/campaigns/CampaignSchedulerCalendar";
import { CrmCampaignLauncher } from "@/features/whatsapp/components/campaigns/CrmCampaignLauncher";
import {
  ControlPlaneDenied,
  ControlPlaneShell,
} from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import {
  currentIstDate,
  currentIstMonth,
  isWhatsappCrmLeadMonth,
  sanitizeWhatsappCrmCampaignFilters,
  WHATSAPP_CRM_AUDIENCE_PRESETS,
  WHATSAPP_CRM_AUDIENCE_TEMPERATURES,
  type WhatsappCrmAudiencePreset,
  type WhatsappCrmAudienceTemperature,
} from "@/features/whatsapp/contracts/crm-campaigns";
import {
  currentIstDateKey,
  parseWhatsappSchedulerMonth,
  parseWhatsappSchedulerView,
  schedulerDateKey,
  schedulerMonthLabel,
  shiftWhatsappSchedulerMonth,
  type WhatsappSchedulerView,
} from "@/features/whatsapp/contracts/campaign-scheduler";
import {
  isUuid,
  WHATSAPP_ADMIN_CAMPAIGNS_PATH,
  WHATSAPP_ADMIN_SCHEDULER_PATH,
  WHATSAPP_ADMIN_TEMPLATES_PATH,
} from "@/features/whatsapp/contracts/control-plane";
import {
  listWhatsappCampaignTemplateOptionsForCurrentUser,
  listWhatsappCampaignVersionsForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-campaign-queries";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";
import {
  getWhatsappCrmAudienceCountsForCurrentUser,
  getWhatsappCrmCampaignFilterOptionsForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-crm-campaign-queries";
import { listWhatsappSchedulerEventsForCurrentUser } from "@/features/whatsapp/server/whatsapp-campaign-scheduler-queries";
import "@/features/whatsapp/components/growth-workspace.css";
import "@/features/whatsapp/components/campaigns/campaign-scheduler.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Campaign Scheduler | ONEDECORE",
  description: "Calendar scheduling for governed CRM-driven WhatsApp campaigns.",
};

interface WhatsappSchedulerPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function addDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function schedulerHref(
  view: WhatsappSchedulerView,
  month: string,
  date: string
): string {
  const params = new URLSearchParams({ view, month, date });
  return `${WHATSAPP_ADMIN_SCHEDULER_PATH}?${params.toString()}`;
}

function templateChoiceHref(
  snapshotId: string,
  month: string,
  temperature: WhatsappCrmAudienceTemperature,
  preset: WhatsappCrmAudiencePreset
): string {
  const params = new URLSearchParams({
    templateSnapshotId: snapshotId,
    audienceMonth: month,
    audienceTemperature: temperature,
  });
  if (preset !== "standard") params.set("audiencePreset", preset);
  return `${WHATSAPP_ADMIN_SCHEDULER_PATH}?${params.toString()}#crm-campaign-launcher`;
}
export default async function WhatsappSchedulerPage({
  searchParams,
}: WhatsappSchedulerPageProps) {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.campaigns.execute"]) {
    return (
      <ControlPlaneDenied
        title="You do not have Scheduler access"
        detail="WhatsApp campaign scheduling is limited to Super Admins and Sales Managers."
      />
    );
  }

  const params = await searchParams;
  const today = currentIstDateKey();
  const view = parseWhatsappSchedulerView(first(params.view));
  const month = parseWhatsappSchedulerMonth(first(params.month), today);
  const requestedDate = first(params.date);
  const anchorDate = validDateKey(requestedDate)
    ? requestedDate
    : month === today.slice(0, 7)
      ? today
      : `${month}-01`;

  const requestedAudienceMonth = first(params.audienceMonth);
  const audienceMonth = isWhatsappCrmLeadMonth(requestedAudienceMonth)
    ? requestedAudienceMonth
    : currentIstMonth();
  const requestedPreset = first(params.audiencePreset);
  const audiencePreset: WhatsappCrmAudiencePreset =
    requestedPreset &&
    WHATSAPP_CRM_AUDIENCE_PRESETS.includes(requestedPreset as WhatsappCrmAudiencePreset)
      ? (requestedPreset as WhatsappCrmAudiencePreset)
      : "standard";
  const requestedTemperature = first(params.audienceTemperature);
  const audienceTemperature: WhatsappCrmAudienceTemperature =
    requestedTemperature &&
    WHATSAPP_CRM_AUDIENCE_TEMPERATURES.includes(
      requestedTemperature as WhatsappCrmAudienceTemperature
    )
      ? (requestedTemperature as WhatsappCrmAudienceTemperature)
      : audiencePreset === "long-term-nurture"
        ? "all"
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
    projectTimeline:
      audiencePreset === "long-term-nurture"
        ? "after-2-months"
        : first(params.projectTimeline),
  });

  const canDraft =
    access.permissions["campaigns.draft"] &&
    access.permissions["whatsapp.templates.read"];

  const [versions, templates, crmCounts, crmOptions, schedulerEvents] = await Promise.all([
    listWhatsappCampaignVersionsForCurrentUser(),
    canDraft
      ? listWhatsappCampaignTemplateOptionsForCurrentUser()
      : Promise.resolve([]),
    getWhatsappCrmAudienceCountsForCurrentUser(audienceMonth, audiencePreset),
    getWhatsappCrmCampaignFilterOptionsForCurrentUser(),
    listWhatsappSchedulerEventsForCurrentUser(month),
  ]);
  const requestedSnapshot = first(params.templateSnapshotId);
  const requestedTemplateId = first(params.templateId);
  const selectedTemplate =
    (isUuid(requestedSnapshot)
      ? templates.find((template) => template.snapshotId === requestedSnapshot)
      : null) ??
    (isUuid(requestedTemplateId)
      ? templates.find((template) => template.templateId === requestedTemplateId)
      : null) ??
    null;

  const events = schedulerEvents;
  const readyVersions = versions.filter((version) => {
    if (
      version.status !== "approved" ||
      version.specState !== "frozen" ||
      !version.templateName
    ) {
      return false;
    }
    const run = version.latestRun;
    if (!run) return true;
    return (
      (run.status === "cancelled" || run.status === "failed") &&
      run.sentCount === 0 &&
      run.reconcileCount === 0
    );
  });

  const monthEvents = events.filter(
    (event) => schedulerDateKey(event.scheduledFor).slice(0, 7) === month
  );
  const activeThisMonth = monthEvents.filter((event) =>
    ["scheduled", "materializing", "ready", "dispatching", "paused"].includes(
      event.status
    )
  ).length;
  const completedThisMonth = monthEvents.filter(
    (event) => event.status === "completed"
  ).length;
  const attentionThisMonth = monthEvents.filter((event) =>
    ["failed", "reconciling"].includes(event.status)
  ).length;
  const previousMonth = shiftWhatsappSchedulerMonth(month, -1);
  const nextMonth = shiftWhatsappSchedulerMonth(month, 1);
  const previousDate =
    view === "week" ? addDays(anchorDate, -7) : `${previousMonth}-01`;
  const nextDate = view === "week" ? addDays(anchorDate, 7) : `${nextMonth}-01`;
  const previousHref =
    view === "week"
      ? schedulerHref(view, previousDate.slice(0, 7), previousDate)
      : schedulerHref(view, previousMonth, previousDate);
  const nextHref =
    view === "week"
      ? schedulerHref(view, nextDate.slice(0, 7), nextDate)
      : schedulerHref(view, nextMonth, nextDate);

  const todayHref = schedulerHref(view, today.slice(0, 7), today);
  const monthHref = schedulerHref("month", month, anchorDate);
  const weekHref = schedulerHref("week", month, anchorDate);
  const agendaHref = schedulerHref("agenda", month, anchorDate);

  return (
    <ControlPlaneShell
      active="scheduler"
      title="Scheduler"
      lede="Plan WhatsApp campaigns on a premium delivery calendar. The schedule stores CRM rules, not a frozen phone list: audience membership is recalculated at delivery time."
      permissions={access.permissions}
    >
      <div className="od-growth od-scheduler">
        <header className="od-scheduler__hero">
          <div>
            <p className="od-growth__eyebrow">WhatsApp Campaign Scheduler</p>
            <h1>{schedulerMonthLabel(month)}</h1>
            <p>
              Schedule approved campaigns by CRM truth. A September Hot campaign means
              leads received in September who are still Hot when delivery begins.
            </p>
          </div>
          <div className="od-growth__actions">
            <a className="od-cp__btn od-cp__btn--primary" href="#new-schedule">
              + New schedule
            </a>
            <Link className="od-cp__btn od-cp__btn--quiet" href={WHATSAPP_ADMIN_TEMPLATES_PATH}>
              Approved templates
            </Link>
            <Link className="od-cp__btn od-cp__btn--quiet" href={WHATSAPP_ADMIN_CAMPAIGNS_PATH}>
              Campaign manager
            </Link>
          </div>
        </header>

        <section className="od-scheduler__truth" data-testid="scheduler-live-audience-contract">
          <div>
            <span className="od-scheduler__truth-icon" aria-hidden="true">◎</span>
            <div>
              <strong>Live audience at delivery</strong>
              <p>
                The CRM rule is fixed; the people matching it are not. Temperature,
                stage, consent, DNC, channel availability and template status are checked
                against current values when the run becomes due.
              </p>
            </div>
          </div>
          <span className="od-scheduler__truth-badge">Rule fixed · members live</span>
        </section>

        <section className="od-growth__kpis" aria-label="Scheduler overview">
          <div className="od-growth__kpi">
            <strong>{activeThisMonth.toLocaleString("en-IN")}</strong>
            <span>Scheduled / active this month</span>
          </div>
          <div className="od-growth__kpi">
            <strong>{readyVersions.length.toLocaleString("en-IN")}</strong>
            <span>Approved & ready to schedule</span>
          </div>
          <div className="od-growth__kpi">
            <strong>{completedThisMonth.toLocaleString("en-IN")}</strong>
            <span>Completed this month</span>
          </div>
          <div className="od-growth__kpi">
            <strong>{attentionThisMonth.toLocaleString("en-IN")}</strong>
            <span>Needs attention</span>
          </div>
        </section>
        <CampaignSchedulerCalendar
          events={events}
          view={view}
          month={month}
          anchorDate={anchorDate}
          previousHref={previousHref}
          nextHref={nextHref}
          todayHref={todayHref}
          monthHref={monthHref}
          weekHref={weekHref}
          agendaHref={agendaHref}
          todayDateKey={today}
        />

        <section className="od-scheduler__ready" aria-labelledby="scheduler-ready">
          <div className="od-scheduler__section-head">
            <div>
              <p className="od-growth__eyebrow">Approved campaign versions</p>
              <h2 id="scheduler-ready">Ready to place on the calendar</h2>
              <p>
                These campaigns already have a frozen CRM rule and approved WhatsApp
                spec. Choose the delivery date and time in IST.
              </p>
            </div>
            <span className="od-scheduler__count">{readyVersions.length}</span>
          </div>

          {readyVersions.length === 0 ? (
            <p className="od-cp__empty">
              No approved campaign is waiting for a delivery slot. Prepare one below or
              finish setup and approval in Campaigns.
            </p>
          ) : (
            <div className="od-scheduler__ready-grid">
              {readyVersions.map((version) => (
                <article className="od-scheduler__ready-card" key={version.versionId}>
                  <div className="od-scheduler__ready-top">
                    <div>
                      <span className="od-scheduler__status" data-tone="positive">
                        Approved
                      </span>
                      <h3>{version.campaignName}</h3>
                    </div>
                    <span>v{version.versionNumber}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Template</dt>
                      <dd>{version.templateName}</dd>
                    </div>
                    <div>
                      <dt>Audience</dt>
                      <dd>Recalculated at delivery</dd>
                    </div>
                  </dl>
                  <CampaignCreateRunForm
                    campaignVersionId={version.versionId}
                    schedulerMode
                  />
                  <Link
                    className="od-scheduler__text-link"
                    href={`${WHATSAPP_ADMIN_CAMPAIGNS_PATH}?version=${version.versionId}&preview=1`}
                  >
                    Review live eligibility before scheduling →
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="new-schedule" className="od-scheduler__builder">
          <div className="od-scheduler__section-head">
            <div>
              <p className="od-growth__eyebrow">New scheduled campaign</p>
              <h2>Connect CRM audience + approved template</h2>
              <p>
                Choose the CRM cohort here. The campaign is then prepared and governed
                in Campaigns; after approval it appears above for the exact delivery slot.
              </p>
            </div>
          </div>

          {selectedTemplate ? (
            <div className="od-scheduler__template-selected">
              <div>
                <span className="od-scheduler__status" data-tone="positive">Meta approved</span>
                <strong>{selectedTemplate.name}</strong>
                <span>
                  {selectedTemplate.language}
                  {selectedTemplate.qualityRating
                    ? ` · quality ${selectedTemplate.qualityRating}`
                    : ""}
                </span>
              </div>
              <Link
                className="od-cp__btn od-cp__btn--quiet"
                href={WHATSAPP_ADMIN_TEMPLATES_PATH + "?category=MARKETING&status=APPROVED"}
              >
                Change template
              </Link>
            </div>
          ) : canDraft ? (
            <div className="od-scheduler__template-picker">
              <div>
                <strong>Choose an approved MARKETING template</strong>
                <p>
                  Selecting one here carries it into campaign setup; Meta status is
                  checked again before actual delivery.
                </p>
              </div>
              <div className="od-scheduler__template-chips">
                {templates.slice(0, 8).map((template) => (
                  <Link
                    key={template.snapshotId}
                    href={templateChoiceHref(
                      template.snapshotId,
                      audienceMonth,
                      audienceTemperature,
                      audiencePreset
                    )}
                  >
                    {template.name} · {template.language}
                  </Link>
                ))}
                {templates.length === 0 ? (
                  <span>No approved MARKETING template is available yet.</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <CrmCampaignLauncher
            month={audienceMonth}
            temperature={audienceTemperature}
            filters={audienceFilters}
            options={crmOptions}
            counts={crmCounts}
            startDate={currentIstDate()}
            canCreate={access.permissions["campaigns.draft"]}
            preset={audiencePreset}
            surfacePath={WHATSAPP_ADMIN_SCHEDULER_PATH}
            templateSnapshotId={selectedTemplate?.snapshotId ?? null}
            schedulerHandoff
          />
        </section>
      </div>
    </ControlPlaneShell>
  );
}
