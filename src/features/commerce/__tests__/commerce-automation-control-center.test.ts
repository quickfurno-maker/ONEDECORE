import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  getCommerceAutomationWorkerSecret,
  isCommerceAutomationEnabled,
} from "../automation/server/automation-env.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const foundation = read("supabase/migrations/20260920130000_commerce_automation_control_plane.sql");
const control = read("supabase/migrations/20260920133000_commerce_automation_admin_control.sql");
const workspace = read("src/features/commerce/automation/components/AutomationWorkspace.tsx");

describe("Commerce automation control center", () => {
  test("deployment gate fails closed and worker secret requires 32 characters", () => {
    assert.equal(isCommerceAutomationEnabled({}), false);
    assert.equal(isCommerceAutomationEnabled({ ONEDECORE_COMMERCE_AUTOMATION_ENABLED: "true" }), true);
    assert.equal(getCommerceAutomationWorkerSecret({ ONEDECORE_COMMERCE_AUTOMATION_WORKER_SECRET: "short" }), null);
    assert.equal(getCommerceAutomationWorkerSecret({ ONEDECORE_COMMERCE_AUTOMATION_WORKER_SECRET: "x".repeat(32) }), "x".repeat(32));
  });
  test("commerce automation owns its own durable queue and immutable event intake", () => {
    assert.match(foundation, /commerce_automation_events/);
    assert.match(foundation, /commerce_automation_jobs/);
    assert.match(foundation, /unique \(event_id, rule_id\)/);
    assert.match(foundation, /lease_expires_at/);
    assert.match(foundation, /last_error_code/);
    assert.match(foundation, /status in \('pending','claimed','succeeded','dead'\)/);
  });

  test("queued jobs snapshot rule behavior before operators edit workflows", () => {
    assert.match(control, /action_kind_snapshot/);
    assert.match(control, /audience_snapshot/);
    assert.match(control, /template_code_snapshot/);
    assert.match(control, /task_code_snapshot/);
    assert.match(control, /config_snapshot/);
    assert.match(control, /r.action_kind,r.audience,r.template_code,r.task_code/);
  });

  test("runtime pause is a second gate and cannot override deployment shutdown", () => {
    assert.match(control, /commerce_automation_settings/);
    assert.match(control, /runtime_enabled/);
    assert.match(control, /set_commerce_automation_runtime_enabled/);
    const dispatcher = read("src/features/commerce/automation/server/automation-dispatcher.ts");
    assert.match(dispatcher, /isCommerceAutomationEnabled/);
    assert.match(dispatcher, /outcomeCode === "paused"/);
  });
  test("admin UI exposes full workflow and recovery controls", () => {
    for (const label of ["Overview", "Workflows", "Queue", "Tasks", "WhatsApp", "Activity"]) {
      assert.ok(workspace.includes(`"${label}"`), `${label} tab is declared`);
    }
    assert.match(workspace, /Save workflow/);
    assert.match(workspace, /Run now/);
    assert.match(workspace, /Replay event/);
    assert.match(workspace, /Retry/);
    assert.match(workspace, /cancelCommerceAutomationJobAction/);
    assert.match(workspace, /Complete/);
  });

  test("WhatsApp is provisioned as a disabled adapter rather than workflow owner", () => {
    assert.match(control, /'whatsapp','WhatsApp','whatsapp',false,'not_connected',true/);
    assert.match(control, /adapter_status<>'certified'/);
    assert.match(control, /COMMERCE_AUTOMATION_CHANNEL_NOT_CERTIFIED/);
    assert.match(workspace, /Live delivery is locked/);
    assert.match(workspace, /Enable after certification/);
    assert.doesNotMatch(read("src/features/commerce/automation/server/automation-dispatcher.ts"), /meta|graph\.facebook|waba|whatsapp/i);
  });

  test("internal worker endpoint has a dedicated bearer secret", () => {
    const route = read("src/app/api/internal/commerce-automation/dispatch/route.ts");
    assert.match(route, /getCommerceAutomationWorkerSecret/);
    assert.match(route, /timingSafeEqual/);
    assert.match(route, /Bearer /);
    assert.doesNotMatch(route, /CAMPAIGN_EXECUTION|WHATSAPP|N8N/i);
  });
});

describe("Commerce automation native scheduler", () => {
  test("VPS timer invokes only the internal OneDecore worker without exposing the secret in argv", () => {
    const runner = read("scripts/commerce-automation-dispatch.mjs");
    const service = read("scripts/systemd/onedecore-commerce-automation.service");
    const timer = read("scripts/systemd/onedecore-commerce-automation.timer");

    assert.match(runner, /127\.0\.0\.1:3000\/api\/internal\/commerce-automation\/dispatch/);
    assert.match(runner, /ONEDECORE_COMMERCE_AUTOMATION_ENABLED/);
    assert.match(runner, /ONEDECORE_COMMERCE_AUTOMATION_WORKER_SECRET/);
    assert.doesNotMatch(runner, /n8n|graph\.facebook|waba|whatsapp|razorpay/i);

    assert.match(service, /User=onedecore/);
    assert.match(service, /EnvironmentFile=\/var\/www\/onedecore\/\.env\.production\.local/);
    assert.match(service, /ExecStart=\/usr\/bin\/node \/var\/www\/onedecore\/scripts\/commerce-automation-dispatch\.mjs/);
    assert.match(service, /NoNewPrivileges=true/);
    assert.doesNotMatch(service, /Authorization|Bearer|WORKER_SECRET/);

    assert.match(timer, /OnUnitActiveSec=1min/);
    assert.match(timer, /Persistent=true/);
  });
});
