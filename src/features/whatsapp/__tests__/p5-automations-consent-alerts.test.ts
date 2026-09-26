import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildWebsiteLeadAcknowledgementReadiness,
  buildWhatsappOperationalAlerts,
  ONEDECORE_WHATSAPP_AUTOMATION_PRESETS,
  ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES,
} from "../contracts/automation-presets.ts";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AUTOMATIONS_PAGE = "src/app/admin/whatsapp/automations/page.tsx";
const AUTOMATION_FORMS = "src/features/whatsapp/components/automations/AutomationForms.tsx";
const CONTACTS_ACTIONS = "src/features/whatsapp/server/whatsapp-contacts-actions.ts";
const CONTACT_FORMS = "src/features/whatsapp/components/control-plane/ContactComplianceForms.tsx";
const CONTACTS_PAGE = "src/app/admin/whatsapp/contacts/page.tsx";
const ACK_MIGRATION = "supabase/migrations/20260926090626_whatsapp_service_lead_acknowledgement.sql";
const TEMPLATE_LIBRARY = "src/features/whatsapp/contracts/template-library.ts";
const MANAGER_NAV = "src/features/manager-workspace/contracts/manager-nav.ts";
const OPERATIONAL_ATTENTION = "src/features/whatsapp/server/whatsapp-operational-attention.ts";

describe("P5 automations, consent and operational attention", () => {
  test("ONEDECORE recipes are draft-only marketing preparations", () => {
    assert.equal(ONEDECORE_WHATSAPP_AUTOMATION_PRESETS.length, 6);
    for (const preset of ONEDECORE_WHATSAPP_AUTOMATION_PRESETS) {
      assert.ok(preset.id.length > 0);
      assert.ok(preset.delayMinutes >= 0);
      assert.equal(preset.stopOnReply, true);
      assert.ok(preset.stopOnLeadStatuses.includes("closed_won"));
      assert.ok(preset.stopOnLeadStatuses.includes("closed_lost"));
      assert.equal("campaignVersionId" in preset, false);
      assert.equal("active" in preset, false);
    }
    const forms = code(read(AUTOMATION_FORMS));
    assert.match(forms, /preset\?\.delayMinutes/);
    assert.match(forms, /preset\?\.stopOnReply/);
    assert.match(forms, /Choose an approved campaign/);
  });

  test("the full agreed Utility journey recipe catalogue is prepared but non-executable", () => {
    assert.equal(ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES.length, 13);
    const ids = new Set<string>(ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES.map((recipe) => recipe.id));
    for (const id of [
      "new-enquiry-ack", "designer-assignment", "consultation-confirmation",
      "consultation-reminder", "site-visit-confirmation", "site-visit-reminder",
      "quotation-ready", "quotation-follow-up", "project-update", "payment-reminder",
      "installation", "handover", "feedback",
    ]) {
      assert.equal(ids.has(id), true, id);
    }
    const page = read(AUTOMATIONS_PAGE);
    assert.match(page, /Prepared Utility journeys/);
    assert.match(page, /current WhatsApp Automation engine remains MARKETING-only/);
    assert.match(page, /no Utility recipe can/);
  });

  test("CRM Cadence and WhatsApp Automation are visibly separate", () => {
    const page = read(AUTOMATIONS_PAGE);
    assert.match(page, />CRM Cadence</);
    assert.match(page, /A CRM Cadence never sends a WhatsApp marketing message/);
    assert.match(page, /href="\/admin\/crm\/cadences"/);
    assert.match(page, />WhatsApp Automation</);
    assert.match(page, /Separate from CRM Cadence/);
  });

  test("attention centre surfaces reconcile, failures and safe-off state", () => {
    const automations = [
      {
        id: "a",
        name: "A",
        description: null,
        triggerType: "lead_created",
        triggerConfig: {},
        campaignVersionId: "11111111-1111-4111-8111-111111111111",
        campaignName: null,
        versionNumber: null,
        templateName: null,
        delayMinutes: 0,
        stopOnLeadStatuses: [],
        stopOnReply: true,
        status: "active",
        lockVersion: 1,
        activatedAt: null,
        updatedAt: null,
        enrollmentStates: { needs_reconcile: 2, failed: 1 },
      },
    ];
    const alerts = buildWhatsappOperationalAlerts({
      automations,
      approvedCampaignCount: 0,
      sendPolicy: { kind: "not_configured" },
      approvedAcknowledgementTemplateCount: 0,
      outboundMode: "disabled",
    });
    assert.ok(alerts.some((alert) => alert.id === "needs-reconcile" && alert.tone === "critical"));
    assert.ok(alerts.some((alert) => alert.id === "failed-enrollments"));
    assert.ok(alerts.some((alert) => alert.id === "execution-safe-off"));
    assert.ok(alerts.some((alert) => alert.id === "lead-ack-waiting-template"));
  });

  test("attention centre composes canonical CRM and inbox signals without new alert truth", () => {
    const source = code(read(OPERATIONAL_ATTENTION));
    for (const marker of [
      "fetchCrmMyDaySnapshot",
      "fetchCrmDashboardSummary",
      "queryInboxConversationListPage",
      "newUncontacted",
      "slaBreaches",
      "summary.overdue",
      "needs_reply",
      "appointments.totalToday",
      "quotation_follow_up",
    ]) {
      assert.equal(source.includes(marker), true, marker);
    }
    assert.doesNotMatch(source, /service[_-]?role|createAdminClient|insert\(|update\(|delete\(/i);
  });

  test("explicit MARKETING consent requires evidence and the existing append-only RPC", () => {
    const action = code(read(CONTACTS_ACTIONS));
    const form = code(read(CONTACT_FORMS));
    const page = code(read(CONTACTS_PAGE));
    assert.match(action, /recordWhatsappMarketingConsentGrantAction/);
    assert.match(action, /permissions\["marketing_consents\.manage"\]/);
    assert.match(action, /confirmExplicit/);
    assert.match(action, /record_marketing_consent_event/);
    assert.match(action, /p_event_type:\s*"granted"/);
    assert.match(action, /p_idempotency_key:\s*randomUUID\(\)/);
    assert.match(form, /Record explicit marketing consent/);
    assert.match(form, /not inferring consent from service activity/i);
    assert.match(page, /MarketingConsentEvidenceForm/);
    assert.doesNotMatch(action, /create_whatsapp_service_send_intent/);
    assert.doesNotMatch(form, /WHATSAPP_SERVICE/);
  });

  test("website lead acknowledgement is prepared but remains dormant", () => {
    const library = read(TEMPLATE_LIBRARY);
    const migration = read(ACK_MIGRATION);
    assert.match(library, /name: "onedecore_new_enquiry_ack"/);
    assert.match(library, /category: "UTILITY"/);
    assert.match(migration, /Intentionally no-op/);
    assert.match(migration, /real Meta template id and APPROVED status/);
    assert.doesNotMatch(migration, /insert into|create trigger|http|graph\.facebook/i);

    const blocked = buildWebsiteLeadAcknowledgementReadiness({
      approvedTemplateCount: 0,
      outboundMode: "disabled",
    });
    assert.equal(blocked.status, "dormant");

    const prepared = buildWebsiteLeadAcknowledgementReadiness({
      approvedTemplateCount: 1,
      outboundMode: "enabled",
    });
    assert.equal(prepared.status, "ready-for-later-activation");
  });

  test("Sales Manager communication navigation includes governed automations", () => {
    const nav = read(MANAGER_NAV);
    assert.match(nav, /href: "\/admin\/whatsapp\/automations"/);
    assert.match(nav, /CRM Cadences remain separate/);
  });
});
