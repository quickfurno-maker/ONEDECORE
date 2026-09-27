import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  normalizeMetaDisplayPhoneNumber,
  parseWhatsappProductionSenderStatus,
  productionSenderMatchesEnvironment,
} from "../contracts/production-activation.ts";
import {
  activateConfiguredMetaProductionSender,
  getWhatsappProductionActivationEnvironment,
} from "../server/whatsapp-production-activation.ts";
import { metaWebhookEventMatchesProductionSender } from "../server/meta-webhook-ingest.ts";
import type { MetaWebhookServerEnv } from "../server/meta-webhook-env.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("production activation environment exposes readiness, never secret values", () => {
  const env = getWhatsappProductionActivationEnvironment({
    META_WHATSAPP_ACCESS_TOKEN: "secret-token-that-must-never-render",
    META_WHATSAPP_APP_SECRET: "app-secret-that-must-never-render",
    META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-secret",
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: "1546520326779501",
    META_WHATSAPP_PHONE_NUMBER_ID: "123456789133607",
    META_WHATSAPP_GRAPH_API_VERSION: "v22.0",
    ONEDECORE_WHATSAPP_WEBHOOK_MODE: "enabled",
    ONEDECORE_WHATSAPP_OUTBOUND_MODE: "enabled",
  });
  assert.equal(env.accessTokenConfigured, true);
  assert.equal(env.wabaIdLast6, "779501");
  assert.equal(env.phoneNumberIdLast6, "133607");
  assert.equal(JSON.stringify(env).includes("secret-token"), false);
  assert.equal(JSON.stringify(env).includes("app-secret"), false);
});

test("production sender status requires exact env alignment and one active identity", () => {
  const status = parseWhatsappProductionSenderStatus({
    configured: true,
    phone_number_id_last6: "133607",
    waba_id_last6: "779501",
    display_phone_number: "+918459539180",
    phone_status: "active",
    account_status: "active",
    active_phone_count: 1,
    active_account_count: 1,
  });
  const env = getWhatsappProductionActivationEnvironment({
    META_WHATSAPP_ACCESS_TOKEN: "x".repeat(40),
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: "1546520326779501",
    META_WHATSAPP_PHONE_NUMBER_ID: "123456789133607",
  });
  assert.equal(productionSenderMatchesEnvironment(status, env), true);
  assert.equal(
    productionSenderMatchesEnvironment({ ...status, activePhoneCount: 2 }, env),
    false
  );
});

test("Meta display number normalization is strict E.164", () => {
  assert.equal(normalizeMetaDisplayPhoneNumber("+91 84595 39180"), "+918459539180");
  assert.equal(normalizeMetaDisplayPhoneNumber("08459539180"), null);
  assert.equal(normalizeMetaDisplayPhoneNumber("not-a-phone"), null);
});

test("activation verifies phone membership in WABA before the service-role cutover", async () => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const result = await activateConfiguredMetaProductionSender({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://lpurlfmpvriyvpkujvyl.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-not-used-by-mock",
      META_WHATSAPP_ACCESS_TOKEN: "t".repeat(40),
      META_WHATSAPP_BUSINESS_ACCOUNT_ID: "1546520326779501",
      META_WHATSAPP_PHONE_NUMBER_ID: "987654321012345",
      META_WHATSAPP_GRAPH_API_VERSION: "v22.0",
    },
    fetchImpl: async (url) => {
      assert.match(String(url), /1546520326779501\/phone_numbers/);
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "987654321012345",
              display_phone_number: "+91 84595 39180",
              verified_name: "OneDecore",
              quality_rating: "GREEN",
              code_verification_status: "VERIFIED",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
    createAdmin: (() => ({
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: { configured: true }, error: null };
      },
    })) as never,
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.fn, "configure_whatsapp_production_sender");
  assert.deepEqual(calls[0]?.args, {
    p_waba_id: "1546520326779501",
    p_phone_number_id: "987654321012345",
    p_display_phone_number: "+918459539180",
  });
});

test("activation refuses an unverified Meta phone before database cutover", async () => {
  let rpcCalled = false;
  const result = await activateConfiguredMetaProductionSender({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://lpurlfmpvriyvpkujvyl.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-not-used-by-mock",
      META_WHATSAPP_ACCESS_TOKEN: "t".repeat(40),
      META_WHATSAPP_BUSINESS_ACCOUNT_ID: "1546520326779501",
      META_WHATSAPP_PHONE_NUMBER_ID: "987654321012345",
    },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "987654321012345",
              display_phone_number: "+91 84595 39180",
              verified_name: "OneDecore",
              quality_rating: "GREEN",
              code_verification_status: "PENDING",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
    createAdmin: (() => ({
      rpc: async () => {
        rpcCalled = true;
        return { data: null, error: null };
      },
    })) as never,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "PHONE_NOT_VERIFIED");
  assert.equal(rpcCalled, false);
});

test("activation refuses a Phone Number ID that Meta does not list under the WABA", async () => {
  let rpcCalled = false;
  const result = await activateConfiguredMetaProductionSender({
    env: {
      META_WHATSAPP_ACCESS_TOKEN: "t".repeat(40),
      META_WHATSAPP_BUSINESS_ACCOUNT_ID: "1546520326779501",
      META_WHATSAPP_PHONE_NUMBER_ID: "987654321012345",
    },
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    createAdmin: (() => ({
      rpc: async () => {
        rpcCalled = true;
        return { data: null, error: null };
      },
    })) as never,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "PHONE_NOT_IN_WABA");
  assert.equal(rpcCalled, false);
});

test("enabled webhook sender lock accepts only the configured WABA + phone pair", () => {
  const env: MetaWebhookServerEnv = {
    mode: "enabled",
    supabaseUrl: "https://lpurlfmpvriyvpkujvyl.supabase.co",
    serviceRoleKey: "service",
    verifyToken: "verify-token",
    appSecret: "a".repeat(32),
    expectedWabaId: "111",
    expectedPhoneNumberId: "222",
  };
  const event = {
    kind: "message_status",
    eventKey: "e",
    eventHash: "h",
    wabaId: "111",
    phoneNumberId: "222",
    displayPhoneNumber: "+918459539180",
    providerMessageId: "wamid.1",
    status: "delivered",
    providerTimestamp: new Date().toISOString(),
    details: {},
  } as const;
  assert.equal(metaWebhookEventMatchesProductionSender(env, event), true);
  assert.equal(
    metaWebhookEventMatchesProductionSender(env, { ...event, phoneNumberId: "333" }),
    false
  );
  assert.equal(
    metaWebhookEventMatchesProductionSender(env, { ...event, wabaId: "999" }),
    false
  );
});

test("migration preserves the current sender until explicit cutover and exposes only service-role cutover", () => {
  const migration = read(
    "supabase/migrations/20260927061751_whatsapp_production_sender_activation.sql"
  );
  assert.match(migration, /production_sender_at/);
  assert.match(migration, /Installing the migration does NOT retire the current test\/legacy sender/);
  assert.match(migration, /where id <> v_phone_id[\s\S]*status = 'active'/i);
  assert.match(migration, /set status = 'archived'/i);
  assert.match(migration, /configure_whatsapp_production_sender/);
  assert.match(
    migration,
    /grant execute on function public\.configure_whatsapp_production_sender\(text,text,text\)[\s\S]*to service_role/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.configure_whatsapp_production_sender\(text,text,text\)[\s\S]{0,80}to authenticated/i
  );
});

test("retired sender mismatch is blocked before Meta in direct and Utility dispatch", () => {
  const direct = read("src/features/whatsapp/server/whatsapp-dispatch-service.ts");
  const utility = read(
    "src/features/whatsapp/server/whatsapp-template-dispatch-service.ts"
  );
  for (const source of [direct, utility]) {
    assert.match(source, /production_sender_mismatch/);
    assert.match(source, /claim\.phone_number_id !== env\.phoneNumberId/);
  }
});

test("Settings exposes a deliberate production cutover and never renders a credential", () => {
  const page = read("src/app/admin/whatsapp/settings/page.tsx");
  const form = read(
    "src/features/whatsapp/components/control-plane/ProductionSenderActivationForm.tsx"
  );
  assert.match(page, /Production Meta sender/);
  assert.match(page, /Locked & aligned/);
  assert.match(form, /Verify & lock production sender/);
  assert.doesNotMatch(page, /META_WHATSAPP_ACCESS_TOKEN/);
  assert.doesNotMatch(form, /META_WHATSAPP_ACCESS_TOKEN/);
});
