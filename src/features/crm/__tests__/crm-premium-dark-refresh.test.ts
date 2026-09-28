import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const SHELL = "src/features/crm/components/shell/CrmWorkspaceShell.tsx";
const TOKENS = "src/features/admin-ops/tokens.css";
const EXECUTIVE = "src/features/crm/components/dashboard/CrmExecutiveBar.tsx";
const SUMMARY = "src/features/crm/server/crm-executive-summary.ts";
const OVERVIEW = "src/app/admin/crm/page.tsx";
const DATE_FIELD = "src/features/crm/components/ui/CrmDateTimeField.tsx";
const CALENDAR_DIALOG = "src/features/crm/components/calendar/CalendarEventDialog.tsx";
const SIDEBAR = "src/features/admin-ops/components/AdminSidebar.tsx";

describe("CRM premium dark refresh", () => {
  test("the entire CRM is dark from one root", () => {
    const shell = read(SHELL);
    assert.match(shell, /od-crm od-crm-dark crm-app-shell/);
    assert.match(shell, /data-crm-theme="dark"/);
    assert.doesNotMatch(shell, /usePathname|theme="light"/);
  });

  test("previous hardcoded light surfaces now use CRM tokens", () => {
    assert.doesNotMatch(read(DATE_FIELD), /\bbg-white\b/);
    assert.doesNotMatch(read(CALENDAR_DIALOG), /bg-\[#fdf8ec\]|text-\[#8a6c1f\]/);
    assert.match(read(DATE_FIELD), /bg-\[var\(--crm-surface\)\]/);
    assert.match(read(CALENDAR_DIALOG), /bg-\[var\(--crm-primary-soft\)\]/);
  });

  test("the overview owns a live executive command bar", () => {
    const overview = read(OVERVIEW);
    const bar = read(EXECUTIVE);
    assert.match(overview, /<CrmExecutiveBar summary=\{executive\}/);
    for (const label of [
      "New",
      "Open",
      "Hot",
      "Warm",
      "Cold",
      "Overdue",
      "Unassigned",
      "WhatsApp",
    ]) {
      assert.match(bar, new RegExp(`label: "${label}"`));
    }
  });

  test("executive metrics are server-derived and RLS-scoped", () => {
    const src = read(SUMMARY);
    assert.match(src, /createClient\(\)/);
    assert.match(src, /manual_sales_temperature/);
    assert.match(src, /lead_follow_ups/);
    assert.match(src, /whatsapp_conversations/);
    assert.match(src, /context\.canReadBroad/);
    assert.match(src, /options\.includeWhatsapp/);
    assert.doesNotMatch(src, /service_role|SUPABASE_SERVICE_ROLE/);
  });

  test("premium styling includes command bar, sticky nav and responsive metrics", () => {
    const css = read(TOKENS);
    assert.match(css, /\.od-crm-dark \.crm-executive-bar \{/);
    assert.match(css, /\.od-crm-dark \.crm-nav \{[\s\S]*position: sticky;/);
    assert.match(css, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
    assert.match(css, /@media \(max-width: 639px\)/);
  });

  test("main CRM destinations are visible in the admin sidebar", () => {
    const sidebar = read(SIDEBAR);
    for (const href of [
      "/admin/crm/nurture",
      "/admin/crm/pipeline",
      "/admin/crm/calendar",
    ]) {
      assert.match(sidebar, new RegExp(href.replaceAll("/", "\\/")));
    }
  });
});
