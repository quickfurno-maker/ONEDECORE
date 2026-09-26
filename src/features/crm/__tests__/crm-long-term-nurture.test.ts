import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildLeadListHref,
  parseLeadListQuery,
} from "../contracts/lead-list-query.ts";

const ROOT = process.cwd();
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");

describe("CRM long-term nurture", () => {
  test("project timeline is a governed lead-list filter", () => {
    assert.equal(
      parseLeadListQuery({ timeline: "after-2-months", month: "all" }).timeline,
      "after-2-months"
    );
    assert.equal(parseLeadListQuery({ timeline: "someday" }).timeline, null);

    const query = parseLeadListQuery({
      timeline: "after-2-months",
      month: "all",
      temperature: "hot",
    });
    assert.equal(
      buildLeadListHref(query, undefined, { basePath: "/admin/crm/nurture" }),
      "/admin/crm/nurture?temperature=hot&timeline=after-2-months&month=all"
    );
  });

  test("nurture workspace is automatic, all-time and active-only", () => {
    const page = read("src/app/admin/crm/nurture/page.tsx");
    const query = read("src/features/crm/server/crm-lead-queries.ts");
    const nav = read("src/features/crm/components/shell/CrmNav.tsx");

    assert.match(page, /timeline: "after-2-months"/);
    assert.match(page, /month: "all"/);
    assert.match(page, /excludeTerminal: true/);
    assert.match(page, /hideLost/);
    assert.match(query, /not\("status", "in", "\(closed_won,closed_lost\)"\)/);
    assert.match(nav, /\/admin\/crm\/nurture/);
  });

  test("CRM nurture links directly into consent-aware WhatsApp promotions", () => {
    const page = read("src/app/admin/crm/nurture/page.tsx");
    const campaigns = read("src/features/whatsapp/components/campaigns/CrmCampaignLauncher.tsx");
    const counts = read("src/features/whatsapp/server/whatsapp-crm-campaign-queries.ts");

    assert.match(page, /audiencePreset=long-term-nurture/);
    assert.match(page, /Schedule WhatsApp nurture/);
    assert.match(page, /WHATSAPP_ADMIN_SCHEDULER_PATH/);
    assert.match(campaigns, /Marketing consent and WhatsApp eligibility are still mandatory/);
    assert.match(campaigns, /excludeTerminalStages: nurtureMode/);
    assert.match(counts, /timeline_code", "after-2-months"/);
    assert.match(counts, /closed_won,closed_lost/);
  });
});
