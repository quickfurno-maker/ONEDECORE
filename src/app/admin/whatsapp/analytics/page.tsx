import type { Metadata } from "next";
import Link from "next/link";
import { WhatsappFunnel } from "@/features/whatsapp/components/analytics/WhatsappFunnel";
import { ControlPlaneDenied, ControlPlaneShell } from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import {
  formatWhatsappRate,
  resolveWhatsappAnalyticsRange,
  WHATSAPP_ANALYTICS_RANGES,
  whatsappFunnelRate,
} from "@/features/whatsapp/contracts/analytics";
import { WHATSAPP_AUTOMATION_TRIGGER_LABELS, type WhatsappAutomationTrigger } from "@/features/whatsapp/contracts/automations";
import { describeWhatsappCampaignReason } from "@/features/whatsapp/contracts/campaign-execution";
import { isUuid, WHATSAPP_ADMIN_ANALYTICS_PATH } from "@/features/whatsapp/contracts/control-plane";
import {
  getWhatsappAnalyticsOverviewForCurrentUser,
  getWhatsappAutomationAnalyticsForCurrentUser,
  getWhatsappReferralAnalyticsForCurrentUser,
  getWhatsappRunAnalyticsForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-analytics-queries";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Analytics | ONEDECORE",
};

/**
 * WM-5 Analytics. whatsapp.analytics.read (Super Admin, Sales Manager):
 * aggregates only. The per-recipient export link is rendered only with
 * whatsapp.reports.export (Super Admin), and its route re-checks it.
 */

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function n(value: number | undefined): string {
  return (value ?? 0).toLocaleString("en-IN");
}

interface WhatsappAnalyticsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappAnalyticsPage({ searchParams }: WhatsappAnalyticsPageProps) {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.analytics.read"]) {
    return (
      <ControlPlaneDenied
        title="You do not have Analytics access"
        detail="WhatsApp analytics are limited to Super Admins and Sales Managers."
      />
    );
  }
  const { permissions } = access;
  const params = await searchParams;
  const range = resolveWhatsappAnalyticsRange(first(params.range));
  const runRaw = first(params.run);
  const runId = isUuid(runRaw) ? runRaw : null;

  const [overview, automations, referrals, runDetail] = await Promise.all([
    getWhatsappAnalyticsOverviewForCurrentUser(range),
    getWhatsappAutomationAnalyticsForCurrentUser(range),
    getWhatsappReferralAnalyticsForCurrentUser(range),
    runId ? getWhatsappRunAnalyticsForCurrentUser(runId) : Promise.resolve(null),
  ]);

  const channel = overview?.channel ?? {};
  const outbound = channel.outbound_messages ?? 0;

  return (
    <ControlPlaneShell
      active="analytics"
      title="Analytics"
      lede="Delivery, clicks, replies and CRM outcomes from canonical evidence: provider status events, opaque click tokens, reply context, and lead, quotation and booking records."
      permissions={permissions}
    >
      <nav className="od-cp__chips" aria-label="Date range">
        {WHATSAPP_ANALYTICS_RANGES.map((option) => (
          <Link
            key={option.key}
            className="od-cp__btn od-cp__btn--quiet"
            href={`${WHATSAPP_ADMIN_ANALYTICS_PATH}?range=${option.key}`}
            aria-current={option.key === range.key ? "page" : undefined}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {!overview ? (
        <p className="od-cp__notice" data-tone="negative">
          Analytics could not be read. Try again shortly.
        </p>
      ) : (
        <>
          <section className="od-cp__panel" aria-labelledby="whatsapp-analytics-channel">
            <h2 id="whatsapp-analytics-channel" className="od-cp__panel-title">
              Channel
            </h2>
            <div className="od-cp__stats">
              <div className="od-cp__stat">
                <span className="od-cp__stat-value">{n(channel.outbound_messages)}</span>
                <span className="od-cp__stat-label">Outbound messages</span>
              </div>
              <div className="od-cp__stat">
                <span className="od-cp__stat-value">{n(channel.inbound_messages)}</span>
                <span className="od-cp__stat-label">Inbound messages</span>
              </div>
              <div className="od-cp__stat">
                <span className="od-cp__stat-value">{n(channel.active_conversations)}</span>
                <span className="od-cp__stat-label">Active conversations</span>
              </div>
              <div className="od-cp__stat">
                <span className="od-cp__stat-value">{formatWhatsappRate(outbound ? (channel.outbound_with_delivered_evidence ?? 0) / outbound : null)}</span>
                <span className="od-cp__stat-label">Delivered (evidence)</span>
              </div>
              <div className="od-cp__stat">
                <span className="od-cp__stat-value">{formatWhatsappRate(outbound ? (channel.outbound_with_read_evidence ?? 0) / outbound : null)}</span>
                <span className="od-cp__stat-label">Read (evidence)</span>
              </div>
              <div className="od-cp__stat">
                <span className="od-cp__stat-value">{n(channel.outbound_with_failed_evidence)}</span>
                <span className="od-cp__stat-label">Failed (provider)</span>
              </div>
            </div>
            <p className="od-cp__hint" style={{ marginBlockStart: 10 }}>
              A message with no status event is counted as neither delivered nor failed. Nothing is inferred from silence.
            </p>
          </section>

          <section className="od-cp__panel" aria-labelledby="whatsapp-analytics-campaigns">
            <h2 id="whatsapp-analytics-campaigns" className="od-cp__panel-title">
              Campaign funnel
            </h2>
            <WhatsappFunnel
              summary={overview.campaignFunnel}
              caption={`Runs created in the range. ${n(overview.campaignFunnel.targeted)} targeted, ${n(overview.campaignFunnel.excluded)} excluded at preflight. CRM outcomes count within ${overview.attributionWindowDays} days of the send; replies split ${n(overview.campaignFunnel.replied_exact)} exact / ${n(overview.campaignFunnel.replied_inferred)} inferred.`}
            />
            {overview.runs.length > 0 ? (
              <div className="od-cp__table-wrap" style={{ marginBlockStart: 16 }}>
                <table className="od-cp__table" data-testid="whatsapp-analytics-runs">
                  <thead>
                    <tr>
                      <th scope="col">Campaign</th>
                      <th scope="col">Sent</th>
                      <th scope="col">Delivered</th>
                      <th scope="col">Read</th>
                      <th scope="col">Clicked</th>
                      <th scope="col">Replied</th>
                      <th scope="col">Bookings</th>
                      <th scope="col">Opted out</th>
                      <th scope="col">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.runs.map((run) => (
                      <tr key={run.runId}>
                        <td>
                          {run.campaignName} · v{run.versionNumber}
                          <span className="od-cp__sub">
                            {run.templateName ?? ""} · {run.status}
                          </span>
                        </td>
                        <td>{n(run.funnel.sent)}</td>
                        <td>
                          {n(run.funnel.delivered)} <span className="od-cp__sub">{formatWhatsappRate(whatsappFunnelRate(run.funnel, "delivered"))}</span>
                        </td>
                        <td>{n(run.funnel.read)}</td>
                        <td>{n(run.funnel.clicked)}</td>
                        <td>{n(run.funnel.replied)}</td>
                        <td>{n(run.funnel.booking)}</td>
                        <td>{n(run.funnel.opted_out)}</td>
                        <td>
                          <Link href={`${WHATSAPP_ADMIN_ANALYTICS_PATH}?range=${range.key}&run=${run.runId}`}>Open</Link>
                          {permissions["whatsapp.reports.export"] ? (
                            <>
                              {" · "}
                              <a href={`/api/admin/whatsapp/analytics/runs/${run.runId}/export`} data-testid="whatsapp-analytics-export">
                                Export CSV
                              </a>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="od-cp__empty">No campaign runs in this range.</p>
            )}
          </section>

          {runId ? (
            <section className="od-cp__panel" aria-labelledby="whatsapp-analytics-run">
              <h2 id="whatsapp-analytics-run" className="od-cp__panel-title">
                {runDetail ? `${runDetail.campaignName} · v${runDetail.versionNumber}` : "Run"}
              </h2>
              {!runDetail ? (
                <p className="od-cp__empty">That run does not exist.</p>
              ) : (
                <div className="od-cp__columns">
                  <WhatsappFunnel summary={runDetail.funnel} caption={`Run status: ${runDetail.status}.`} />
                  <dl className="od-cp__dl">
                    <dt>Clicks by destination</dt>
                    <dd>
                      {runDetail.clicksByDestination.length === 0
                        ? "None"
                        : runDetail.clicksByDestination.map((entry) => (
                            <span key={entry.label} style={{ display: "block" }}>
                              {entry.label}: {n(entry.clicks)} clicks, {n(entry.recipients)} recipients
                            </span>
                          ))}
                      <span className="od-cp__sub">Link previews and crawlers excluded ({n(runDetail.botClicks)}).</span>
                    </dd>
                    <dt>Reply time</dt>
                    <dd>
                      Under 1h {n(runDetail.replyLag.under_1h)} · 1–24h {n(runDetail.replyLag.from_1h_to_24h)} · over 24h {n(runDetail.replyLag.over_24h)}
                    </dd>
                    <dt>Not sent because</dt>
                    <dd>
                      {Object.keys(runDetail.reasons).length === 0
                        ? "—"
                        : Object.entries(runDetail.reasons).map(([code, count]) => (
                            <span key={code} style={{ display: "block" }}>
                              {describeWhatsappCampaignReason(code)}: {n(count)}
                            </span>
                          ))}
                    </dd>
                  </dl>
                </div>
              )}
            </section>
          ) : null}

          <section className="od-cp__panel" aria-labelledby="whatsapp-analytics-automations">
            <h2 id="whatsapp-analytics-automations" className="od-cp__panel-title">
              Automations
            </h2>
            {automations.length === 0 ? (
              <p className="od-cp__empty">No automation activity in this range.</p>
            ) : (
              <table className="od-cp__table">
                <thead>
                  <tr>
                    <th scope="col">Automation</th>
                    <th scope="col">Enrolled</th>
                    <th scope="col">Sent</th>
                    <th scope="col">Skipped</th>
                    <th scope="col">Delivered</th>
                    <th scope="col">Clicked</th>
                    <th scope="col">Replied</th>
                    <th scope="col">Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {automations.map((row) => (
                    <tr key={row.automationId}>
                      <td>
                        {row.name}
                        <span className="od-cp__sub">
                          {WHATSAPP_AUTOMATION_TRIGGER_LABELS[row.triggerType as WhatsappAutomationTrigger] ?? row.triggerType} · {row.status}
                        </span>
                      </td>
                      <td>{n(row.funnel.enrolled)}</td>
                      <td>{n(row.funnel.sent)}</td>
                      <td>{n(row.funnel.skipped)}</td>
                      <td>{n(row.funnel.delivered)}</td>
                      <td>{n(row.funnel.clicked)}</td>
                      <td>{n(row.funnel.replied)}</td>
                      <td>{n(row.funnel.booking)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="od-cp__panel" aria-labelledby="whatsapp-analytics-ctwa">
            <h2 id="whatsapp-analytics-ctwa" className="od-cp__panel-title">
              Click-to-WhatsApp ads · {n(referrals?.totalReferrals)}
            </h2>
            {!referrals || referrals.sources.length === 0 ? (
              <p className="od-cp__empty">No ad-referred conversations in this range.</p>
            ) : (
              <table className="od-cp__table">
                <thead>
                  <tr>
                    <th scope="col">Ad / source</th>
                    <th scope="col">Conversations</th>
                    <th scope="col">Contacts</th>
                    <th scope="col">Leads linked</th>
                    <th scope="col">Consultations</th>
                    <th scope="col">Quotations</th>
                    <th scope="col">Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.sources.map((source) => (
                    <tr key={source.sourceId ?? "unknown"}>
                      <td>
                        {source.headline ?? source.sourceId ?? "Unknown source"}
                        <span className="od-cp__sub">
                          {source.sourceType ?? "unknown"} {source.sourceId ? `· ${source.sourceId}` : ""} {source.sourceUrlHost ? `· ${source.sourceUrlHost}` : ""}
                        </span>
                      </td>
                      <td>{n(source.funnel.referrals)}</td>
                      <td>{n(source.funnel.contacts)}</td>
                      <td>{n(source.funnel.leads_linked)}</td>
                      <td>{n(source.funnel.consultation)}</td>
                      <td>{n(source.funnel.quotation)}</td>
                      <td>{n(source.funnel.booking)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="od-cp__hint" style={{ marginBlockStart: 10 }}>
              Ad metadata is attribution evidence only. It never creates a contact, consent or lead owner.
            </p>
          </section>
        </>
      )}
    </ControlPlaneShell>
  );
}
