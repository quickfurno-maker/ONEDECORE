import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildWhatsappTemplateStudioSubmission } from "../contracts/template-components.ts";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const MIGRATION =
  "supabase/migrations/20260926062255_whatsapp_template_local_drafts.sql";
const FORMS =
  "src/features/whatsapp/components/templates/TemplateStudioForms.tsx";
const PAGE = "src/app/admin/whatsapp/templates/page.tsx";
const ACTIONS = "src/features/whatsapp/server/whatsapp-template-actions.ts";
const QUERIES = "src/features/whatsapp/server/whatsapp-template-queries.ts";
const CAMPAIGNS = "src/app/admin/whatsapp/campaigns/page.tsx";

function mediaDraft(handle = "") {
  return {
    name: "site_visit_media",
    language: "en",
    category: "UTILITY",
    headerType: "IMAGE",
    headerText: "",
    headerMediaHandle: handle,
    bodyText: "Hi {{1}}, your site visit is confirmed.",
    footerText: "ONEDECORE",
    bodyExamples: ["Keshav"],
    headerExample: "",
    buttons: [
      {
        type: "QUICK_REPLY",
        text: "Confirmed",
        url: "",
        phoneNumber: "",
        flowId: "",
        navigateScreen: "",
      },
    ],
  } as const;
}

describe("P3 Meta-independent Template Studio", () => {
  test("local media-header drafts do not require a Meta upload handle", () => {
    const local = buildWhatsappTemplateStudioSubmission(mediaDraft(), {
      providerReady: false,
    });
    assert.equal(local.ok, true);
  });

  test("provider submission of that media header requires the Meta handle", () => {
    const provider = buildWhatsappTemplateStudioSubmission(mediaDraft(), {
      providerReady: true,
    });
    assert.equal(provider.ok, false);
    if (!provider.ok) {
      assert.equal(provider.field, "headerMediaHandle");
    }

    const ready = buildWhatsappTemplateStudioSubmission(
      mediaDraft("meta-sample-upload-handle"),
      { providerReady: true }
    );
    assert.equal(ready.ok, true);
  });

  test("advanced buttons support quick reply, URL, phone and Flow", () => {
    const base = {
      ...mediaDraft("meta-handle"),
      headerType: "NONE",
      headerMediaHandle: "",
      buttons: [
        { type: "QUICK_REPLY", text: "Interested" },
        { type: "URL", text: "View", url: "https://onedecore.in/" },
        {
          type: "PHONE_NUMBER",
          text: "Call",
          phoneNumber: "+919876543210",
        },
        {
          type: "FLOW",
          text: "Book",
          flowId: "flow_123",
          navigateScreen: "BOOKING",
        },
      ],
    };
    const built = buildWhatsappTemplateStudioSubmission(base, {
      providerReady: false,
    });
    assert.equal(built.ok, true);
  });

  test("local draft persistence is RLS-protected and optimistic-lock governed", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /create table public\.whatsapp_template_drafts/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /whatsapp\.templates\.read/);
    assert.match(sql, /whatsapp\.templates\.manage/);
    assert.match(sql, /lock_version/);
    assert.match(sql, /p_expected_lock_version/);
    assert.match(sql, /draft_conflict_or_missing/);
    assert.match(sql, /local_draft/);
    assert.match(sql, /locally_reviewed/);
    assert.match(sql, /archived/);
  });

  test("new P3 read models use private definer authority plus public invoker wrappers", () => {
    const sql = read(MIGRATION);
    assert.match(
      sql,
      /private\.list_whatsapp_template_registry_p3_impl[\s\S]*security definer/
    );
    assert.match(
      sql,
      /public\.list_whatsapp_template_registry_p3[\s\S]*security invoker/
    );
    assert.match(
      sql,
      /private\.list_whatsapp_template_status_timeline_impl[\s\S]*security definer/
    );
    assert.match(
      sql,
      /public\.list_whatsapp_template_status_timeline[\s\S]*security invoker/
    );
    assert.doesNotMatch(
      sql,
      /create or replace function public\.list_whatsapp_template_(?:registry_p3|status_timeline)[\s\S]{0,400}security definer/
    );
  });

  test("saving a ONEDECORE draft never calls the provider or changes consent", () => {
    const actions = read(ACTIONS);
    const saveStart = actions.indexOf(
      "export async function saveWhatsappTemplateDraftAction"
    );
    const archiveStart = actions.indexOf(
      "export async function archiveWhatsappTemplateDraftAction"
    );
    const saveBody = actions.slice(saveStart, archiveStart);
    assert.match(saveBody, /save_whatsapp_template_draft/);
    assert.doesNotMatch(saveBody, /submitWhatsappTemplateToProvider/);
    assert.doesNotMatch(saveBody, /syncWhatsappTemplatesFromProvider/);
    assert.doesNotMatch(saveBody, /consent/i);

    const sql = read(MIGRATION);
    assert.doesNotMatch(sql, /insert into public\.consent_events/i);
    assert.doesNotMatch(sql, /update public\.whatsapp_templates[\s\S]*set status/i);
  });

  test("the editor clearly separates local save, local review and Meta submission", () => {
    const forms = read(FORMS);
    assert.match(forms, /Save ONEDECORE Draft/);
    assert.match(forms, /Mark Locally Reviewed/);
    assert.match(forms, /Submit to Meta for review/);
    assert.match(forms, /providerReady: operation === "provider_submit"/);
    assert.match(forms, /IMAGE/);
    assert.match(forms, /VIDEO/);
    assert.match(forms, /DOCUMENT/);
    assert.match(forms, /LOCATION/);
    assert.match(forms, /QUICK_REPLY/);
    assert.match(forms, /PHONE_NUMBER/);
    assert.match(forms, /FLOW/);
    assert.match(forms, /Meta sample upload handle/);
  });

  test("draft list supports edit, duplicate, archive, language filter and provider timeline", () => {
    const page = read(PAGE);
    assert.match(page, /ONEDECORE Drafts/);
    assert.match(page, /duplicateDraft/);
    assert.match(page, /TemplateArchiveForm/);
    assert.match(page, /WHATSAPP_TEMPLATE_STUDIO_LANGUAGES/);
    assert.match(page, /Provider status timeline/);
    assert.match(page, /listWhatsappTemplateStatusTimelineForCurrentUser/);
    assert.match(page, /listWhatsappTemplateDraftsForCurrentUser/);
    assert.match(page, /editorSeedFromWhatsappTemplateComponents/);
  });

  test("Use in Campaign is preparation-only and cannot become an execution template", () => {
    const page = read(PAGE);
    const campaigns = read(CAMPAIGNS);
    assert.match(page, /Use in Campaign/);
    assert.match(page, /draft\.category === "MARKETING"/);
    assert.match(page, /preparation-only until an approved Meta template/);
    assert.match(campaigns, /campaign-local-template-handoff/);
    assert.match(campaigns, /not\s+Meta approved/);
    assert.match(campaigns, /approved MARKETING template appears in the provider registry/);
    assert.doesNotMatch(campaigns, /templateDraftId[\s\S]{0,500}template_snapshot_id/);
  });

  test("draft and timeline queries use the caller session rather than service role", () => {
    const queries = read(QUERIES);
    assert.match(queries, /createClient\(\)/);
    assert.match(queries, /list_whatsapp_template_drafts/);
    assert.match(queries, /get_whatsapp_template_draft/);
    assert.match(queries, /list_whatsapp_template_status_timeline/);
    assert.doesNotMatch(queries, /createAdminClient|service_role|SERVICE_ROLE/);
  });

  test("P3 never opens outbound or marketing execution gates", () => {
    for (const source of [MIGRATION, FORMS, ACTIONS, PAGE]) {
      const body = read(source);
      assert.doesNotMatch(body, /marketing_execution_enabled\s*=\s*true/i);
      assert.doesNotMatch(body, /WHATSAPP_OUTBOUND_MODE\s*=\s*enabled/i);
    }
  });
});
