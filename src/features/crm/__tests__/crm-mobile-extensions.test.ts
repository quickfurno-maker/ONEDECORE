import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

function source(...parts: string[]): string {
  return readFileSync(join(process.cwd(), "src", "app", "api", "mobile", "crm", ...parts, "route.ts"), "utf8");
}

describe("mobile CRM extensions are governed read-only surfaces", () => {
  test("WhatsApp extension enforces CRM bearer auth and lead RLS before content-free signals", () => {
    const code = source("leads", "[leadId]", "whatsapp-engagement");
    assert.match(code, /resolveCrmMobileAuth\(request\)/);
    assert.match(code, /isCrmLeadIdShape\(leadId\)/);
    assert.match(code, /\.from\("leads"\)/);
    assert.match(code, /\.select\("id"\)/);
    assert.match(code, /\.eq\("id", leadId\.trim\(\)\)/);
    assert.match(code, /\.maybeSingle\(\)/);
    assert.match(code, /if \(!visibleLead\) return crmMobileError\("not_found"/);
    assert.match(code, /fetchWhatsappEngagementSignals\(\[visibleLead\.id\], auth\.db\)/);
    assert.ok(code.indexOf('if (!visibleLead)') < code.indexOf('const signals = await fetchWhatsappEngagementSignals'));
    assert.doesNotMatch(code, /fetchLeadScoreBatch|queryLeadIntelligence/);
    assert.match(code, /Cache-Control.*no-store, private/);
    assert.match(code, /hasCustomerReply: signal\.hasCustomerReply/);
    assert.doesNotMatch(code, /return NextResponse\.json\(signal\)/);
    assert.doesNotMatch(code, /sendWhatsapp|dispatchWhatsapp|service_role|SUPABASE_SERVICE_ROLE/i);
    assert.doesNotMatch(code, /POST|DELETE|PUT/);
  });
  test("Nurture uses caller RLS with a fixed long-horizon scope", () => {
    const code = source("nurture");
    assert.match(code, /resolveCrmMobileAuth\(request\)/);
    assert.match(code, /month: "all"/);
    assert.match(code, /timeline: "after-2-months"/);
    assert.match(code, /excludeTerminal: true/);
    assert.match(code, /auth\.context/);
    assert.match(code, /auth\.db/);
    assert.match(code, /countScope: "current_page"/);
    assert.match(code, /Cache-Control.*no-store, private/);
    assert.doesNotMatch(code, /sendWhatsapp|scheduleCampaign|service_role|SUPABASE_SERVICE_ROLE/i);
    assert.doesNotMatch(code, /POST|DELETE|PUT/);
  });
});
