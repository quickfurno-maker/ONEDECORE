import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const MIGRATION =
  "supabase/migrations/20260925161804_crm_whatsapp_workspace_integration.sql";
const PAGE = "src/app/admin/whatsapp/inbox/[conversationId]/page.tsx";
const PANEL =
  "src/features/whatsapp/components/inbox/ConversationDetailsPanel.tsx";
const RESOLUTION =
  "src/features/whatsapp/components/inbox/ConversationCrmResolution.tsx";
const ACTIONS =
  "src/features/whatsapp/server/whatsapp-crm-actions.ts";
const SERVICE =
  "src/features/whatsapp/server/whatsapp-crm-integration.ts";
const SUMMARY =
  "src/features/whatsapp/server/conversation-lead-summary.ts";
const CRM_LEAD_PAGE = "src/app/admin/crm/leads/[leadId]/page.tsx";
const CRM_WHATSAPP_PANEL =
  "src/features/crm/components/leads/LeadWhatsappPanel.tsx";
const CRM_INLINE_ACTIONS =
  "src/features/whatsapp/components/inbox/ConversationCrmActions.tsx";

describe("P2 CRM ↔ WhatsApp workspace integration", () => {
  test("manual linking is manager-governed, CRM-broad-read scoped and audited", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /whatsapp_inbox_has_manage_scope/);
    assert.match(sql, /crm_has_broad_lead_read/);
    assert.match(sql, /whatsapp_crm_link_events/);
    assert.match(sql, /link_method in \('manual_existing', 'created_lead'\)/);
    assert.match(sql, /forbid_append_only_mutation/);
  });

  test("an existing conversation link is never silently overwritten", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /if v_conv\.lead_id is not null then/);
    assert.match(sql, /CRM_WHATSAPP_ALREADY_LINKED/);
    assert.match(sql, /where id = v_conv\.id\s+and lead_id is null/);
  });

  test("linking a different phone requires an explicit reason", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /if not v_phone_match and \(v_reason is null or length\(v_reason\) < 5\)/);
    assert.match(sql, /CRM_WHATSAPP_LINK_REASON_REQUIRED/);
    assert.match(read(RESOLUTION), /Reason for linking a different number/);
  });

  test("create and link is one database transaction using canonical CRM creation", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /create_crm_lead_from_whatsapp_conversation_impl/);
    assert.match(sql, /private\.create_manual_lead_impl\(/);
    assert.match(sql, /private\.link_whatsapp_conversation_to_crm_lead_impl\(/);
    assert.match(sql, /ls\.code = 'whatsapp'/);
    assert.doesNotMatch(read(ACTIONS), /LEAD_CREATED_LINK_PENDING/);
    assert.match(read(SERVICE), /create_crm_lead_from_whatsapp_conversation/);
  });

  test("P2 does not grant or infer marketing consent", () => {
    const sql = read(MIGRATION);
    assert.doesNotMatch(sql, /insert into public\.consent_events/i);
    assert.doesNotMatch(sql, /MARKETING.*granted/i);
    const component = read(RESOLUTION);
    assert.match(component, /No marketing consent is assumed/);
    const summary = read(SUMMARY);
    assert.match(summary, /"WHATSAPP_SERVICE"/);
    assert.match(summary, /"MARKETING"/);
  });

  test("manager resolution is mounted only for unlinked conversations", () => {
    const page = read(PAGE);
    assert.match(page, /context\.canManage && !detail\.leadId/);
    assert.match(page, /<ConversationCrmResolution/);
    assert.match(page, /searchWhatsappCrmLeadCandidatesForCurrentUser/);
    assert.match(page, /getWhatsappCrmCreateOptionsForCurrentUser/);
  });

  test("candidate search stays under caller CRM scope and exact phone leads rank first", () => {
    const service = read(SERVICE);
    assert.match(service, /if \(!context\.canReadBroad\) \{\s*return \[\]/);
    assert.match(service, /\.eq\("address_normalized", conversationE164\)/);
    assert.match(service, /left\.phoneMatch \? -1 : 1/);
    assert.match(service, /resolveEffectiveSalesBucket/);
  });

  test("linked conversations show useful CRM context in the inbox", () => {
    const panel = read(PANEL);
    for (const label of [
      "Owner",
      "Sales classification",
      "Next action",
      "First contact",
      "Quotation",
      "WhatsApp service consent",
      "WhatsApp marketing consent",
    ]) {
      assert.match(panel, new RegExp(label));
    }
    assert.match(panel, /Open lead in CRM/);
  });

  test("P2 introduces no provider or Meta execution path", () => {
    for (const source of [MIGRATION, ACTIONS, SERVICE]) {
      const body = read(source);
      assert.doesNotMatch(body, /dispatch.*message/i);
      assert.doesNotMatch(body, /graph\.facebook|graph\.facebookapis/i);
      assert.doesNotMatch(body, /marketing_execution_enabled\s*=\s*true/i);
    }
  });
});


describe("P2 WhatsApp inside the CRM lead workspace", () => {
  test("a CRM lead looks up only a conversation visible to the WhatsApp caller", () => {
    const service = read(SERVICE);
    assert.match(service, /getWhatsappInboxAccessContext/);
    assert.match(service, /if \(!whatsapp\?\.canRead\) \{\s*return null/);
    assert.match(service, /\.from\("whatsapp_conversations"\)/);
    assert.match(service, /\.eq\("lead_id", leadId\)/);
    assert.match(service, /fetchConversationListItemById/);
  });

  test("lead detail renders a linked WhatsApp status panel on desktop and mobile", () => {
    const page = read(CRM_LEAD_PAGE);
    assert.match(page, /getWhatsappConversationForLeadCurrentUser\(lead\.id\)/);
    assert.match(page, /<LeadWhatsappPanel conversation=\{whatsappConversation\} \/>/);
    assert.match(page, /xl:hidden/);
    const panel = read(CRM_WHATSAPP_PANEL);
    assert.match(panel, /Needs reply/);
    assert.match(panel, /Follow-up due/);
    assert.match(panel, /Waiting on customer/);
    assert.match(panel, /Open WhatsApp conversation/);
    assert.match(panel, /\/admin\/whatsapp\/inbox\//);
  });

  test("CRM does not fabricate a conversation when WhatsApp access is absent", () => {
    const page = read(CRM_LEAD_PAGE);
    assert.match(page, /\{whatsappConversation \? \(/);
    const service = read(SERVICE);
    assert.doesNotMatch(service, /service_role|createServiceRoleClient/);
  });
});


describe("P2 inline CRM actions inside WhatsApp", () => {
  test("the inbox reuses canonical CRM server actions instead of adding mutations", () => {
    const src = read(CRM_INLINE_ACTIONS);
    assert.match(src, /addLeadNoteAction/);
    assert.match(src, /createLeadActivityAction/);
    assert.match(src, /rescheduleLeadActivityAction/);
    assert.match(src, /transitionLeadStatusAction/);
    assert.match(src, /setLeadSalesTemperatureAction/);
    assert.match(src, /createQuotationDraftAction/);
    assert.doesNotMatch(src, /\.from\(/);
    assert.doesNotMatch(src, /\.rpc\(/);
  });

  test("inline classification exposes only Hot, Warm and Cold", () => {
    const src = read(CRM_INLINE_ACTIONS);
    assert.match(src, /CRM_MANUAL_SALES_TEMPERATURES/);
    assert.match(src, /CRM_MANUAL_SALES_TEMPERATURE_LABELS/);
    assert.doesNotMatch(src, /name="temperature"[^>]*value="LOST"/);
    const summary = read(SUMMARY);
    assert.match(summary, /canSetSalesTemperature/);
    assert.match(summary, /"closed_lost", "closed_won", "on_hold"/);
  });

  test("safe forward stages and resume are inline, reason-bearing outcomes stay in CRM", () => {
    const src = read(CRM_INLINE_ACTIONS);
    assert.match(src, /getForwardTransitionOptions\(lead\.statusCode\)/);
    assert.match(src, /lead\.resumeTargetStatus/);
    assert.match(src, /On Hold \/ Lost actions stay in CRM/);
    assert.doesNotMatch(src, /closureReasonCode/);
    assert.doesNotMatch(src, /onHoldReason/);
  });

  test("notes and next actions are available only through CRM capability flags", () => {
    const src = read(CRM_INLINE_ACTIONS);
    assert.match(src, /lead\.canManageLeadNotes && !terminal/);
    assert.match(src, /lead\.canManageLeadFollowUps && !terminal/);
    assert.match(src, /name="ownerId" value=\{lead\.ownerId \?\? ""\}/);
    assert.match(src, /createLeadActivityAction/);
    assert.match(src, /formData\.set\("isPrimary", "true"\)/);
    assert.match(src, /appendAbsoluteTimestampsFromLocalFields/);
    assert.match(src, /lead\.nextActionId \? \(/);
    assert.match(src, /name="activityId" value=\{lead\.nextActionId\}/);
    assert.match(src, /clearReminder", "false"/);
  });

  test("quotation shortcut mirrors CRM permission and terminal-state rules", () => {
    const src = read(CRM_INLINE_ACTIONS);
    assert.match(src, /lead\.canReadQuotation/);
    assert.match(src, /lead\.canCreateQuotation && !terminal/);
    assert.match(src, /\/admin\/quotations\/\$\{lead\.quotationId\}\/draft/);
  });

  test("the action panel is mounted only when CRM lead context is visible", () => {
    const page = read(PAGE);
    const panel = read(PANEL);
    assert.match(page, /<ConversationCrmActions lead=\{leadSummary\.lead\} \/>/);
    assert.match(panel, /\{crmActions\}/);
  });

  test("inline CRM actions never send a WhatsApp message", () => {
    const src = read(CRM_INLINE_ACTIONS);
    assert.doesNotMatch(src, /sendWhatsapp|dispatchMessage|dispatch.*message/i);
    assert.doesNotMatch(src, /template|campaign|marketing_execution/i);
  });
});
