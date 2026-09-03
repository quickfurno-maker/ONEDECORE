/**
 * Phase 6B â€” integrated local matrix (repository schema M1â€“M21).
 * Complements pgTAP 13/14/15 with orchestration-level dispatch tests.
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { createFakeWhatsappProviderAdapter } from "../server/whatsapp-fake-provider-adapter.ts";
import { dispatchWhatsappSendIntent } from "../server/whatsapp-dispatch-service.ts";
import type { WhatsappOutboundServerEnv } from "../server/whatsapp-outbound-env.ts";
import { getWhatsappOutboundMode } from "../server/whatsapp-outbound-env.ts";
import { rejectMarketingPurpose } from "../server/send-intent-normalization.ts";
import { WHATSAPP_SERVICE_PURPOSE_CODE } from "../contracts/inbox-permissions.ts";

const root = process.cwd();

const FROZEN_HASHES = {
  M19: "77C8C994C8C391C1E5423584740FDAA1DA9D38064898FC1DEA0CDB99A41BB7F4",
  M20: "A80BAB2FE5E0C7E5E2B986839573AC8881C773EF49A81B8A15EF9EB7CF5A05EB",
  M21: "15178D62677667CD49B08DCA9D2D9907A2AF2F24C658A56CF3ACC1D73F9900DE",
  M22: "74F79FB7985BAC4D556701371555F7717A026EC5EC5F77DA314A42F643775630",
  M23_GIT_BLOB: "785325143dae0e81b918f8371325785ce061d57a",
  M23_SHA256: "64F4F15A9501FCF6BDA954E021812B0B826022304654DBC49699F0CAB7051634",
  M24_FILENAME: "20260811140000_staff_attendance_idempotency_repair.sql",
} as const;

function sha256File(relPath: string): string {
  const normalized = readFileSync(join(root, relPath), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex").toUpperCase();
}

function localTestEnv(): WhatsappOutboundServerEnv {
  return {
    mode: "local-test",
    providerCode: "fake",
    supabaseUrl: "http://127.0.0.1:54321",
    serviceRoleKey: "service-role-test-key-not-publishable",
    graphApiVersion: "v22.0",
    accessToken: null,
    phoneNumberId: null,
  };
}

function mockAdmin(rpcImpl: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>) {
  return {
    rpc: (name: string, args: Record<string, unknown>) => rpcImpl(name, args),
  };
}

describe("Phase 6B integrated â€” frozen migration ledger", () => {
  test("M19/M20/M21/M22 frozen hashes match protected baseline freeze", () => {
    assert.equal(
      sha256File(
        "supabase/migrations/20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql"
      ),
      FROZEN_HASHES.M19
    );
    assert.equal(
      sha256File(
        "supabase/migrations/20260807140000_whatsapp_shared_inbox_read_model_foundation.sql"
      ),
      FROZEN_HASHES.M20
    );
    assert.equal(
      sha256File(
        "supabase/migrations/20260808140000_whatsapp_provider_dispatch_foundation.sql"
      ),
      FROZEN_HASHES.M21
    );
    assert.equal(
      sha256File(
        "supabase/migrations/20260809140000_kriti_audit_persistence_foundation.sql"
      ),
      FROZEN_HASHES.M22
    );
  });

  test("M23 remains immutable historical artifact applied managed (Git blob & SHA-256)", () => {
    assert.equal(
      sha256File(
        "supabase/migrations/20260810140000_staff_attendance_leave_foundation.sql"
      ),
      FROZEN_HASHES.M23_SHA256
    );
    const m23Blob = execSync(
      "git hash-object supabase/migrations/20260810140000_staff_attendance_leave_foundation.sql",
      { cwd: root, encoding: "utf8" }
    ).trim();
    assert.equal(m23Blob, FROZEN_HASHES.M23_GIT_BLOB);
  });

  test("repository has M1â€“M37 COD, timeline v2, notes repair, CRM 2A-1/2A-2/2A-3/2A-6/2A-7; payment M38 fail-closed", () => {
    const files = readdirSync(join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    assert.equal(files.length, 53, "Migration count must be exactly 53");

    // Workforce V1 attendance lifecycle. Still no payment M38.
    const workforce = files.filter((f) => f.startsWith("20260902160000"));
    assert.equal(workforce.length, 1);
    assert.equal(
      workforce[0],
      "20260902160000_workforce_attendance_v1_lifecycle.sql"
    );

    const phase6c = files.filter((f) => f.startsWith("20260809"));
    assert.equal(phase6c.length, 1);
    assert.equal(phase6c[0], "20260809140000_kriti_audit_persistence_foundation.sql");

    const phase6d_m23 = files.filter((f) => f.startsWith("20260810"));
    assert.equal(phase6d_m23.length, 1);
    assert.equal(phase6d_m23[0], "20260810140000_staff_attendance_leave_foundation.sql");

    const phase6d_m24 = files.filter((f) => f.startsWith("20260811"));
    assert.equal(phase6d_m24.length, 1);
    assert.equal(phase6d_m24[0], FROZEN_HASHES.M24_FILENAME);

    const phase7a_m25 = files.filter((f) => f.startsWith("20260812"));
    assert.equal(phase7a_m25.length, 1);
    assert.equal(phase7a_m25[0], "20260812140000_commercial_quotation_draft_foundation.sql");

    const phase7b_m26 = files.filter((f) => f.startsWith("20260813"));
    assert.equal(phase7b_m26.length, 1);
    assert.equal(phase7b_m26[0], "20260813140000_commercial_quotation_finalization_delivery_acceptance.sql");

    const m26Content = readFileSync(
      join(root, "supabase/migrations", phase6d_m24[0]),
      "utf8"
    );
    assert.match(m26Content, /check_in_attendance/);
    assert.match(m26Content, /check_out_attendance/);

    const phase7b_m27 = files.filter((f) => f.startsWith("20260814"));
    assert.equal(phase7b_m27.length, 1);
    assert.equal(phase7b_m27[0], "20260814140000_quotation_trigger_execute_privilege_hardening.sql");

    const phase8a_m28 = files.filter((f) => f.startsWith("20260815"));
    assert.equal(phase8a_m28.length, 1);
    assert.equal(phase8a_m28[0], "20260815140000_closed_won_project_conversion_pm_handover.sql");

    const phase8b_m29 = files.filter((f) => f.startsWith("20260816"));
    assert.equal(phase8b_m29.length, 1);
    assert.equal(phase8b_m29[0], "20260816140000_designer_assignment_design_collaboration.sql");

    const phase8c_m30 = files.filter((f) => f.startsWith("20260817"));
    assert.equal(phase8c_m30.length, 1);
    assert.equal(phase8c_m30[0], "20260817140000_project_execution_workspace.sql");

    const phase9a_m31 = files.filter((f) => f.startsWith("20260818"));
    assert.equal(phase9a_m31.length, 1);
    assert.equal(phase9a_m31[0], "20260818140000_campaign_consent_audience_approval_foundation.sql");

    const phase9b_m32 = files.filter((f) => f.startsWith("20260819"));
    assert.equal(phase9b_m32.length, 1);
    assert.equal(phase9b_m32[0], "20260819140000_landing_page_lab_experimentation_foundation.sql");

    const phase9c_m33 = files.filter((f) => f.startsWith("20260820"));
    assert.equal(phase9c_m33.length, 1);
    assert.equal(phase9c_m33[0], "20260820140000_campaign_execution_foundation.sql");

    const phase9c_m34 = files.filter((f) => f.startsWith("20260821"));
    assert.equal(phase9c_m34.length, 1);
    assert.equal(phase9c_m34[0], "20260821140000_campaign_metrics_conversion_feedback_foundation.sql");

    const phase9d_m35 = files.filter((f) => f.startsWith("20260822"));
    assert.equal(phase9d_m35.length, 1);
    assert.equal(phase9d_m35[0], "20260822140000_commerce_catalogue_inventory_foundation.sql");

    const phase9d_c1 = files.filter((f) => f.startsWith("20260823"));
    assert.equal(phase9d_c1.length, 1);
    assert.equal(phase9d_c1[0], "20260823140000_commerce_public_storefront_read_foundation.sql");

    const phase9d_d1 = files.filter((f) => f.startsWith("20260824"));
    assert.equal(phase9d_d1.length, 1);
    assert.equal(phase9d_d1[0], "20260824140000_commerce_order_cod_checkout_foundation.sql");

    const later = files.filter((f) => f > "20260824140000_commerce_order_cod_checkout_foundation.sql");
    assert.deepEqual(
      later,
      [
        "20260825163000_lead_timeline_taxonomy_v2.sql",
        "20260825170000_crm_lead_notes_insert_privilege_repair.sql",
        "20260826120000_crm_activity_control_plane_foundation.sql",
        "20260827140000_crm_business_sla_foundation.sql",
        "20260828140000_crm_activity_rpc_workflows.sql",
        "20260829120000_crm_my_day_read_model.sql",
        "20260829140000_crm_assignment_first_contact_automation.sql",
        "20260830140000_crm_cadence_playbook_foundation.sql",
        "20260831140000_crm_lead_commercial_read_models.sql",
        "20260831174021_crm_lead_notes_insert_privilege_redrift_repair.sql",
        "20260901140000_crm_management_analytics_read_model.sql",
        "20260902140000_crm_whatsapp_lead_link_repair.sql",
        "20260902160000_workforce_attendance_v1_lifecycle.sql",
        "20260902170000_workforce_salary_payment_ledger.sql",
        "20260903120000_staff_optional_email_employment_identity.sql",
        "20260903140000_attendance_policy_publish_weekly_off_optional.sql",
      ],
      "Only timeline v2, notes privilege repair, CRM 2A-1, CRM 2A-2, CRM 2A-3, CRM 2A-6 My Day, CRM 2A-7, CRM 2C cadences, CRM 2D commercial read models, the lead_notes INSERT privilege redrift repair, CRM 2E management analytics, the WhatsApp lead-link repair, and the Workforce V1 attendance lifecycle may follow 9D-D1 COD order foundation"
    );
    assert.equal(
      files.includes("20260825140000_commerce_online_payment_adapter_foundation.sql"),
      false,
      "Deferred online-payment M38 must remain absent"
    );
  });
});

describe("Phase 6B integrated â€” consent/purpose", () => {
  test("MARKETING purpose is rejected on service path", () => {
    assert.throws(() => rejectMarketingPurpose("MARKETING"), /MARKETING/);
    assert.doesNotThrow(() =>
      rejectMarketingPurpose(WHATSAPP_SERVICE_PURPOSE_CODE)
    );
  });
});

describe("Phase 6B integrated â€” outbound modes", () => {
  test("defaults to disabled; local-test forbidden in production NODE_ENV", () => {
    assert.equal(getWhatsappOutboundMode({}), "disabled");
    assert.equal(
      getWhatsappOutboundMode({
        ONEDECORE_WHATSAPP_OUTBOUND_MODE: "local-test",
        NODE_ENV: "production",
      }),
      "disabled"
    );
  });
});

describe("Phase 6B integrated â€” dispatch orchestration", () => {
  const envBackup = { ...process.env };

  before(() => {
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = "local-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key-not-publishable";
  });

  after(() => {
    process.env = { ...envBackup };
  });

  test("disabled mode records intent path without provider RPC", async () => {
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = "disabled";
    let rpcCalls = 0;
    const result = await dispatchWhatsappSendIntent("intent-disabled", {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        ({
          rpc: async () => {
            rpcCalls += 1;
            return { data: null, error: null };
          },
        }) as never,
      createProviderAdapter: () => createFakeWhatsappProviderAdapter(),
    });

    assert.equal(result.outcome, "disabled");
    assert.equal(rpcCalls, 0);
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = "local-test";
  });

  test("fake provider success binds with provider evidence", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const calls: string[] = [];

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          calls.push(name);
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "bind_whatsapp_send_intent_dispatch") {
            return {
              data: [
                {
                  outcome_code: "bound",
                  send_intent_id: intentId,
                  outbound_message_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                  provider_message_id: "wamid.fake.test",
                },
              ],
              error: null,
            };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => createFakeWhatsappProviderAdapter(),
    });

    assert.equal(result.outcome, "bound");
    assert.equal(calls[0], "claim_whatsapp_send_intent_for_dispatch");
    assert.equal(calls[1], "bind_whatsapp_send_intent_dispatch");
    assert.equal(result.providerMessageId, "wamid.fake.test");
    assert.match(result.message, /webhook evidence/i);
  });

  test("terminal provider failure records outcome without bind", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const calls: string[] = [];

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          calls.push(name);
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "record_whatsapp_dispatch_attempt_outcome") {
            return { data: [{ outcome_code: "recorded" }], error: null };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => ({
        providerCode: "fake" as const,
        async dispatchTextMessage() {
          return {
            kind: "failed" as const,
            errorClass: "terminal" as const,
            code: "validation",
            message: "Provider rejected message.",
            httpStatus: 400,
            responseSnapshot: {},
          };
        },
      }),
    });

    assert.equal(result.outcome, "failed");
    assert.ok(calls.includes("record_whatsapp_dispatch_attempt_outcome"));
    assert.equal(
      calls.includes("bind_whatsapp_send_intent_dispatch"),
      false
    );
  });

  test("ambiguous provider result records ambiguous without bind", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "record_whatsapp_dispatch_attempt_outcome") {
            return { data: [{ outcome_code: "recorded" }], error: null };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => ({
        providerCode: "fake" as const,
        async dispatchTextMessage() {
          return {
            kind: "ambiguous" as const,
            code: "timeout",
            message: "Ambiguous provider response.",
            httpStatus: 504,
            responseSnapshot: {},
          };
        },
      }),
    });

    assert.equal(result.outcome, "ambiguous");
  });

  test("bind failure after provider success becomes ambiguous reconciliation", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "bind_whatsapp_send_intent_dispatch") {
            return {
              data: null,
              error: { message: "bind failed" },
            };
          }
          if (name === "record_whatsapp_dispatch_attempt_outcome") {
            return { data: [{ outcome_code: "recorded" }], error: null };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => createFakeWhatsappProviderAdapter(),
    });

    assert.equal(result.outcome, "ambiguous");
    assert.match(result.message, /Reconciliation required/i);
  });
});

describe("Phase 6B integrated â€” security contracts", () => {
  test("Meta adapter source references graph API version only in enabled adapter module", () => {
    const meta = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-meta-provider-adapter.ts"),
      "utf8"
    );
    const sendActions = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-send-actions.ts"),
      "utf8"
    );
    assert.match(meta, /graph\.facebook\.com/);
    assert.doesNotMatch(sendActions, /graph\.facebook/i);
  });

  test("dispatch service is server-only", () => {
    const src = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-dispatch-service.ts"),
      "utf8"
    );
    assert.match(src, /server-only/);
  });
});
