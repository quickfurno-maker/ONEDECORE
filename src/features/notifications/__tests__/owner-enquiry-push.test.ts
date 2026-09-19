import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";

const root = process.cwd();
const read = (path: string) =>
  readFileSync(join(root, path), "utf8");

describe("owner enquiry push contracts", () => {
  test("device registry is service-role only with token and platform constraints", () => {
    const migration = read(
      "supabase/migrations/20260921110000_mobile_owner_push_notifications.sql"
    );

    assert.match(migration, /create table if not exists public\.mobile_push_tokens/i);
    assert.match(migration, /enable row level security/i);
    assert.match(
      migration,
      /revoke all on table public\.mobile_push_tokens from public, anon, authenticated/i
    );
    assert.match(migration, /grant .* to service_role/i);
    assert.match(migration, /platform in \('android', 'ios'\)/i);
    assert.match(migration, /ExponentPushToken\|ExpoPushToken/);
  });

  test("mobile registration uses canonical bearer auth and owner-only permission", () => {
    const route = read("src/app/api/mobile/push-token/route.ts");

    assert.match(route, /resolveCrmMobileAuth/);
    assert.match(route, /canDeleteLeads/);
    assert.doesNotMatch(route, /super_admin|SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(route, /mobile_push_tokens/);
    assert.match(route, /expo_push_token/);
  });

  test("dispatch carries only operational preview data and internal lead id", () => {
    const dispatcher = read(
      "src/features/notifications/server/enquiry-push.ts"
    );

    assert.match(dispatcher, /https:\/\/exp\.host\/--\/api\/v2\/push\/send/);
    assert.match(dispatcher, /title: "New Website Enquiry"/);
    assert.match(dispatcher, /kind: "website_enquiry"/);
    assert.match(dispatcher, /leadId: lead\.id/);
    assert.doesNotMatch(dispatcher, /phone_e164|submitted_email/);
    assert.match(dispatcher, /AbortSignal\.timeout\(3_000\)/);
    assert.match(dispatcher, /DeviceNotRegistered/);
  });

  test("website route dispatches only for a newly created durable lead", () => {
    const route = read("src/app/api/public/lead-intake/route.ts");

    assert.match(route, /result\.outcome === "created"/);
    assert.match(route, /dispatchNewWebsiteEnquiryPush\(submissionReference\)/);
    assert.match(route, /Promise\.all/);
    assert.doesNotMatch(
      route,
      /result\.outcome === "idempotent_replay"[\s\S]{0,200}dispatchNewWebsiteEnquiryPush/
    );
  });
});

