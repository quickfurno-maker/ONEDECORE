import "server-only";

import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import { fetchCrmDashboardSummary } from "@/features/crm/server/crm-dashboard-summary-queries";
import { fetchCrmMyDaySnapshot } from "@/features/crm/server/crm-my-day-queries";
import type { WhatsappOperationalAlert } from "../contracts/automation-presets";
import { getWhatsappInboxAccessContext } from "./whatsapp-auth";
import { queryInboxConversationListPage } from "./whatsapp-inbox-queries";

const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatIst(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "the recorded deadline" : IST_TIME.format(parsed);
}

/**
 * P5 attention centre: composition only.
 *
 * Every signal comes from an existing canonical read model. No new notification
 * table, mutable alert truth, service-role read or provider call is introduced.
 * Counts inherit the caller's CRM / WhatsApp RLS scope.
 */
export async function listWhatsappCrmOperationalAttentionForCurrentUser(): Promise<
  readonly WhatsappOperationalAlert[]
> {
  const [crmContext, inboxContext] = await Promise.all([
    getCrmAccessContext(),
    getWhatsappInboxAccessContext(),
  ]);

  const [myDay, dashboard, needsReply] = await Promise.all([
    crmContext
      ? fetchCrmMyDaySnapshot(crmContext, { upcomingLimit: 50, attentionLimit: 50 }).catch(() => null)
      : Promise.resolve(null),
    crmContext ? fetchCrmDashboardSummary(crmContext).catch(() => null) : Promise.resolve(null),
    inboxContext
      ? queryInboxConversationListPage(inboxContext, {
          q: null,
          linkFilter: "all",
          attention: "needs_reply",
          page: 1,
          pageSize: 1,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const alerts: WhatsappOperationalAlert[] = [];

  if (myDay?.summary.newUncontacted) {
    alerts.push({
      id: "crm-new-assigned-uncontacted",
      tone: "warning",
      title: `${myDay.summary.newUncontacted} newly assigned lead${myDay.summary.newUncontacted === 1 ? "" : "s"} need first contact`,
      detail: "These are canonical assigned-but-uncontacted leads from CRM My Day.",
      href: "/admin/crm/my-day",
    });
  }

  if (myDay?.summary.slaBreaches) {
    alerts.push({
      id: "crm-sla-breach",
      tone: "critical",
      title: `${myDay.summary.slaBreaches} first-contact SLA breach${myDay.summary.slaBreaches === 1 ? "" : "es"}`,
      detail: "The active CRM SLA clock has passed without a first-contact attempt.",
      href: "/admin/crm/my-day",
    });
  } else if (myDay) {
    const nextSla = myDay.attention.newUncontacted
      .filter((row) => row.slaDueAt && Date.parse(row.slaDueAt) >= Date.parse(myDay.capturedAt))
      .sort((a, b) => Date.parse(a.slaDueAt!) - Date.parse(b.slaDueAt!))[0]?.slaDueAt;
    if (nextSla) {
      alerts.push({
        id: "crm-sla-approaching",
        tone: "warning",
        title: "First-contact SLA deadline approaching",
        detail: `The next visible uncontacted lead reaches its SLA deadline at ${formatIst(nextSla)}.`,
        href: "/admin/crm/my-day",
      });
    }
  }

  if (myDay?.summary.overdue) {
    alerts.push({
      id: "crm-primary-action-overdue",
      tone: "critical",
      title: `${myDay.summary.overdue} primary next action${myDay.summary.overdue === 1 ? " is" : "s are"} overdue`,
      detail: "My Day reports these commitments as overdue on live leads.",
      href: "/admin/crm/my-day",
    });
  }

  if (needsReply?.totalCount) {
    alerts.push({
      id: "whatsapp-needs-reply",
      tone: "critical",
      title: `${needsReply.totalCount} WhatsApp conversation${needsReply.totalCount === 1 ? "" : "s"} need a reply`,
      detail: "The customer spoke last; this count comes from the canonical inbox attention read model.",
      href: "/admin/whatsapp/inbox?attention=needs_reply",
    });
  }

  if (dashboard?.appointments.totalToday) {
    alerts.push({
      id: "crm-appointments-today",
      tone: dashboard.appointments.pending > 0 ? "warning" : "info",
      title: `${dashboard.appointments.totalToday} consultation/site visit appointment${dashboard.appointments.totalToday === 1 ? "" : "s"} today`,
      detail:
        dashboard.appointments.pending > 0
          ? `${dashboard.appointments.pending} scheduled appointment${dashboard.appointments.pending === 1 ? " is" : "s are"} already past due without completion.`
          : "Today's client appointments are scheduled in CRM.",
      href: "/admin/crm/calendar",
    });
  }

  if (myDay) {
    const quotationDue = myDay.tasks.dueToday.filter(
      (task) => task.activityType === "quotation_follow_up"
    ).length;
    if (quotationDue > 0) {
      alerts.push({
        id: "crm-quotation-followup",
        tone: "warning",
        title: `${quotationDue} quotation follow-up${quotationDue === 1 ? "" : "s"} due today`,
        detail: "These are visible quotation follow-up tasks in CRM My Day.",
        href: "/admin/crm/my-day",
      });
    }
  }

  return alerts;
}
