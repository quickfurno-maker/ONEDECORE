/**
 * ONEDECORE — CRM + WhatsApp launch certification, end-to-end. LOCAL ONLY.
 *
 * Drives the eight launch certification scenarios against a freshly reset local
 * Supabase, through the REAL production code paths:
 *
 *   - the real Next.js webhook route handler (src/app/api/webhooks/meta/whatsapp)
 *   - real X-Hub-Signature-256 HMAC over the exact raw bytes
 *   - the real service-role admin client and the real ingest RPCs
 *   - the real send-intent authority, provider adapter boundary and SLA
 *     evidence validator
 *
 * Nothing here targets a managed project, calls Meta, applies a managed
 * migration, or uses a production secret. `local-test` mode is loopback-locked
 * by src/features/whatsapp/server/meta-webhook-env.ts and the fake provider
 * adapter stands in for Meta dispatch.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' npm run qa:crm-whatsapp-launch-certification
 *
 * Artifacts: .artifacts/crm-whatsapp-launch-certification/ (gitignored)
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLocalSupabaseUrl,
  requireQaPassword,
} from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(
  root,
  ".artifacts",
  "crm-whatsapp-launch-certification"
);
const CONTAINER = "supabase_db_OneDecore";
const LOCAL_PASSWORD = requireQaPassword();

const SUPER_ADMIN = "f1111111-1111-1111-1111-111111111111";
const MANAGER = "f2222222-2222-2222-2222-222222222222";
const EXEC_A = "f3333333-3333-3333-3333-333333333333";
const EXEC_B = "f4444444-4444-4444-4444-444444444444";

const STAFF = [
  { id: SUPER_ADMIN, email: "cert-qa-sa@example.test" },
  { id: MANAGER, email: "cert-qa-mgr@example.test" },
  { id: EXEC_A, email: "cert-qa-execa@example.test" },
  { id: EXEC_B, email: "cert-qa-execb@example.test" },
  { id: "f5555555-5555-5555-5555-555555555555", email: "cert-qa-pm@example.test" },
  { id: "f7777777-7777-7777-7777-777777777777", email: "cert-qa-designer@example.test" },
];

/** Deterministic local-only webhook credentials. Never a production secret. */
const APP_SECRET = "launch-certification-local-app-secret";
const VERIFY_TOKEN = "launch-certification-local-verify-token";
const BUSINESS_E164 = "+919876543210";
const WABA_ID = "770001";
const PHONE_NUMBER_ID = "660001";

/* -------------------------------------------------------------------------- */
/* Harness plumbing                                                            */
/* -------------------------------------------------------------------------- */

const checks: { label: string; ok: boolean; detail: string }[] = [];
function record(label: string, ok: boolean, detail = ""): boolean {
  checks.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-Atq", "-c", sql],
    { encoding: "utf8" }
  ).trim();
}

/** Runs privileged SQL and returns the error text instead of throwing. */
function psqlExpectError(sql: string): string | null {
  try {
    psql(sql);
    return null;
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return String(err.stderr ?? err.message ?? "").trim();
  }
}

function readSupabaseStatus() {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  const status = JSON.parse(raw);
  assertLocalSupabaseUrl(status.API_URL, "Supabase API URL");
  return status;
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

/**
 * Minimal structural view of the PostgREST client this harness uses. The
 * generated `Database` types are not applied here on purpose: the harness
 * deliberately calls RPCs with deliberately wrong arguments (wrong lead, wrong
 * conversation) to prove the fail-closed paths, which a generated signature
 * would reject at compile time rather than at the authority under test.
 */
type QaQuery = PromiseLike<{
  data: { id: string }[] | null;
  error: { message: string } | null;
}> & {
  eq: (column: string, value: string) => QaQuery;
};

type RoleClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => { select: (columns: string) => QaQuery };
};

function actingAs(userId: string, status: Record<string, string>): RoleClient {
  const token = signJwt(
    {
      role: "authenticated",
      sub: userId,
      aud: "authenticated",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    status.JWT_SECRET
  );
  return createClient(status.API_URL, status.ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RoleClient;
}

function runNpm(script: string): void {
  const result = spawnSync(`npm run ${script}`, {
    encoding: "utf8",
    cwd: root,
    shell: true,
  });
  fs.writeFileSync(
    path.join(artifactsDir, `${script.replace(/[^\w-]/g, "-")}.log`),
    `${result.stdout}\n${result.stderr}`
  );
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed. See artifacts.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Meta webhook payloads + signing                                             */
/* -------------------------------------------------------------------------- */

function inboundPayload(waId: string, messageId: string, text: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: BUSINESS_E164,
                phone_number_id: PHONE_NUMBER_ID,
              },
              contacts: [{ wa_id: waId, profile: { name: "Certification Customer" } }],
              messages: [
                {
                  from: waId,
                  id: messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function statusPayload(messageId: string, status: string, recipient: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: BUSINESS_E164,
                phone_number_id: PHONE_NUMBER_ID,
              },
              statuses: [
                {
                  id: messageId,
                  status,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  recipient_id: recipient.replace("+", ""),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signBody(raw: Uint8Array, secret = APP_SECRET): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;
}

type RouteModule = {
  POST: (request: Request) => Promise<Response>;
  GET: (request: Request) => Promise<Response>;
};

function webhookRequest(
  payload: unknown,
  opts: { signature?: string | null; contentType?: string } = {}
): Request {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  const headers: Record<string, string> = {
    "content-type": opts.contentType ?? "application/json",
    host: "localhost:3000",
    "content-length": String(raw.byteLength),
  };
  const signature =
    opts.signature === undefined ? signBody(raw) : opts.signature;
  if (signature !== null) {
    headers["x-hub-signature-256"] = signature;
  }
  return new Request("http://localhost:3000/api/webhooks/meta/whatsapp", {
    method: "POST",
    headers,
    body: raw,
  });
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const suffix = Date.now().toString().slice(-8);
const phones = {
  linked: `+9198${suffix}`,
  ambiguous: `+9196${suffix}`,
  other: `+9194${suffix}`,
  dnc: `+9193${suffix}`,
};

function intake(name: string, phone: string, key: string, service: string, property: string): void {
  psql(`
    select public.submit_lead_intake(
      p_idempotency_key => gen_random_uuid(),
      p_request_hash => encode(digest('${key}-req', 'sha256'), 'hex'),
      p_network_fingerprint_hash => encode(digest('${key}-net', 'sha256'), 'hex'),
      p_phone_fingerprint_hash => encode(digest('${key}-phone', 'sha256'), 'hex'),
      p_planner_version => 'home-r4-v1',
      p_submitted_name => '${name}',
      p_phone_e164 => '${phone}',
      p_submitted_email => null,
      p_service_code => '${service}',
      p_property_code => '${property}',
      p_timeline_code => 'within-1-month',
      p_room_codes => array['living']::text[],
      p_budget_comfort_code => '6-12l',
      p_estimate_snapshot => null,
      p_locality => null,
      p_message => null,
      p_landing_path => '/',
      p_attribution => '{}'::jsonb,
      p_source => 'local-test',
      p_consent_service_enquiry => true,
      p_consent_service_phone => true,
      p_consent_service_email => false,
      p_consent_whatsapp => true,
      p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
      p_copy_service_communication => 'service-communication-v0.1-draft',
      p_copy_whatsapp => 'whatsapp-service-v0.1-draft',
      p_notice_version => 'privacy-notice-v0.1-draft'
    );
  `);
}

function leadFor(phone: string): string {
  return psql(
    `select l.id from public.leads l
       join public.contact_channels ch on ch.contact_id = l.contact_id
      where ch.channel_type = 'phone' and ch.address_normalized = '${phone}'
      order by l.created_at limit 1;`
  );
}

function conversationFor(phone: string): string {
  return psql(
    `select coalesce(id::text,'') from public.whatsapp_conversations where customer_e164 = '${phone}';`
  );
}

function linkOf(conversationId: string): string {
  return psql(
    `select coalesce(lead_id::text, 'NULL') from public.whatsapp_conversations where id = '${conversationId}';`
  );
}

function countMessages(conversationId: string): number {
  return Number(
    psql(`select count(*) from public.whatsapp_messages where conversation_id = '${conversationId}';`)
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  fs.mkdirSync(artifactsDir, { recursive: true });

  try {
    execFileSync("docker", ["inspect", CONTAINER], { stdio: "ignore" });
  } catch {
    throw new Error(
      `Local container ${CONTAINER} is required. Run npm run db:start first.`
    );
  }

  console.log("resetting local database for deterministic fixtures...");
  runNpm("db:reset");

  const status = readSupabaseStatus();
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const user of STAFF) {
    const { data: existing } = await admin.auth.admin.getUserById(user.id);
    if (!existing?.user) {
      const { error } = await admin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: LOCAL_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser ${user.email}: ${error.message}`);
    }
  }

  const roleFixture = path.join(root, "scripts", "crm-2b-owner-qa.sql");
  const roleResult = spawnSync(
    `npx supabase db query --local --file "${roleFixture}"`,
    { encoding: "utf8", cwd: root, shell: true }
  );
  if (roleResult.status !== 0) {
    throw new Error(`role fixture failed:\n${roleResult.stderr}`);
  }

  intake("Cert Linked", phones.linked, `${suffix}-l`, "complete-home-interiors", "apartment-2bhk");
  intake("Cert Ambiguous", phones.ambiguous, `${suffix}-a1`, "complete-home-interiors", "apartment-2bhk");
  intake("Cert Ambiguous", phones.ambiguous, `${suffix}-a2`, "modular-kitchens", "apartment-3bhk");
  intake("Cert Other", phones.other, `${suffix}-o`, "custom-wardrobes", "villa-rowhouse");
  intake("Cert DNC", phones.dnc, `${suffix}-d`, "modular-kitchens", "apartment-2bhk");

  const leadLinked = leadFor(phones.linked);
  const leadOther = leadFor(phones.other);
  const leadDnc = leadFor(phones.dnc);

  const sa = actingAs(SUPER_ADMIN, status);
  const mgr = actingAs(MANAGER, status);
  const execA = actingAs(EXEC_A, status);
  const execB = actingAs(EXEC_B, status);

  // Assign through the canonical RPC so the visibility model is real.
  for (const [leadId, owner] of [
    [leadLinked, EXEC_A],
    [leadOther, EXEC_A],
    [leadDnc, EXEC_A],
  ] as const) {
    const { error } = await mgr.rpc("assign_lead", {
      p_lead_id: leadId,
      p_assignee_id: owner,
      p_reason: "launch certification fixture",
    });
    if (error) throw new Error(`assign_lead ${leadId}: ${error.message}`);
  }

  const statusBefore = psql(
    `select status from public.leads where id = '${leadLinked}';`
  );

  /* ---------------------------------------------------------------------- */
  /* Scenario 8 — kill switch fails closed BEFORE any secret is needed        */
  /* ---------------------------------------------------------------------- */

  process.env.ONEDECORE_WHATSAPP_WEBHOOK_MODE = "disabled";
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
  process.env.META_WHATSAPP_APP_SECRET = APP_SECRET;

  const route = (await import(
    "../src/app/api/webhooks/meta/whatsapp/route.ts"
  )) as unknown as RouteModule;

  const disabledPost = await route.POST(
    webhookRequest(inboundPayload(phones.linked.slice(1), `wamid.cert.${suffix}.disabled`, "hi"))
  );
  record(
    "S8 disabled webhook mode rejects POST 503 fail-closed",
    disabledPost.status === 503,
    `status=${disabledPost.status}`
  );

  const disabledGet = await route.GET(
    new Request(
      "http://localhost:3000/api/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=" +
        VERIFY_TOKEN + "&hub.challenge=12345",
      { headers: { host: "localhost:3000" } }
    )
  );
  record(
    "S8 disabled webhook mode rejects GET verification 503",
    disabledGet.status === 503,
    `status=${disabledGet.status}`
  );

  record(
    "S8 no conversation created while disabled",
    conversationFor(phones.linked) === "",
    "no row"
  );

  /* ---------------------------------------------------------------------- */
  /* Scenario 1 — inbound for a known lead: signed, linked, idempotent        */
  /* ---------------------------------------------------------------------- */

  process.env.ONEDECORE_WHATSAPP_WEBHOOK_MODE = "local-test";

  const okGet = await route.GET(
    new Request(
      "http://localhost:3000/api/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=" +
        VERIFY_TOKEN + "&hub.challenge=cert-challenge",
      { headers: { host: "localhost:3000" } }
    )
  );
  record(
    "S1 GET verification returns the challenge for the correct token",
    okGet.status === 200 && (await okGet.text()) === "cert-challenge",
    `status=${okGet.status}`
  );

  const badToken = await route.GET(
    new Request(
      "http://localhost:3000/api/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x",
      { headers: { host: "localhost:3000" } }
    )
  );
  record(
    "S1 GET verification rejects a wrong verify token 403",
    badToken.status === 403,
    `status=${badToken.status}`
  );

  const inbound1 = inboundPayload(
    phones.linked.slice(1),
    `wamid.cert.${suffix}.1`,
    "Certification inbound"
  );

  const unsigned = await route.POST(webhookRequest(inbound1, { signature: null }));
  record(
    "S1 unsigned POST rejected 401 before persistence",
    unsigned.status === 401,
    `status=${unsigned.status}`
  );

  const forged = await route.POST(
    webhookRequest(inbound1, { signature: signBody(new TextEncoder().encode("{}"), APP_SECRET) })
  );
  record(
    "S1 forged signature rejected 401",
    forged.status === 401,
    `status=${forged.status}`
  );

  record(
    "S1 no conversation created by rejected requests",
    conversationFor(phones.linked) === "",
    "no row"
  );

  const signed1 = await route.POST(webhookRequest(inbound1));
  const signed1Body = await signed1.json();
  record(
    "S1 correctly signed inbound accepted 200 and persisted",
    signed1.status === 200 && signed1Body.outcome === "persisted",
    `status=${signed1.status} outcome=${signed1Body.outcome}`
  );

  const convLinked = conversationFor(phones.linked);
  record("S1 conversation persisted", convLinked !== "", convLinked);
  record(
    "S1 conversation deterministically linked to the one canonical lead",
    linkOf(convLinked) === leadLinked,
    `lead=${linkOf(convLinked)}`
  );
  record("S1 message persisted exactly once", countMessages(convLinked) === 1, "1");

  const replay = await route.POST(webhookRequest(inbound1));
  const replayBody = await replay.json();
  record(
    "S1 duplicate webhook is idempotent (no second message)",
    replay.status === 200 &&
      replayBody.outcome === "duplicate" &&
      countMessages(convLinked) === 1,
    `outcome=${replayBody.outcome} messages=${countMessages(convLinked)}`
  );

  record(
    "S1 duplicate does not create a second conversation",
    Number(
      psql(`select count(*) from public.whatsapp_conversations where customer_e164 = '${phones.linked}';`)
    ) === 1,
    "1"
  );

  /* ---------------------------------------------------------------------- */
  /* Scenario 2 — ambiguous identity never guesses a lead                     */
  /* ---------------------------------------------------------------------- */

  const ambiguousInbound = inboundPayload(
    phones.ambiguous.slice(1),
    `wamid.cert.${suffix}.amb`,
    "Ambiguous inbound"
  );
  const ambRes = await route.POST(webhookRequest(ambiguousInbound));
  const convAmb = conversationFor(phones.ambiguous);
  record(
    "S2 ambiguous inbound still persists its message",
    ambRes.status === 200 && convAmb !== "" && countMessages(convAmb) === 1,
    `status=${ambRes.status}`
  );
  record(
    "S2 ambiguous conversation stays unlinked (no guessed lead)",
    linkOf(convAmb) === "NULL",
    linkOf(convAmb)
  );
  record(
    "S2 resolver reports ambiguity explicitly",
    psql(`select resolution_code from private.crm_resolve_whatsapp_lead_link('${phones.ambiguous}');`) ===
      "ambiguous_lead",
    "ambiguous_lead"
  );

  const { data: execASeesAmb } = await execA
    .from("whatsapp_conversations")
    .select("id")
    .eq("id", convAmb);
  record(
    "S2 sales executive cannot reach an unresolved conversation",
    (execASeesAmb ?? []).length === 0,
    `rows=${(execASeesAmb ?? []).length}`
  );

  const { data: mgrSeesAmb } = await mgr
    .from("whatsapp_conversations")
    .select("id")
    .eq("id", convAmb);
  record(
    "S2 manage scope retains oversight of unresolved conversations",
    (mgrSeesAmb ?? []).length === 1,
    `rows=${(mgrSeesAmb ?? []).length}`
  );

  /* ---------------------------------------------------------------------- */
  /* Scenario 3 — authorization on the linked conversation                    */
  /* ---------------------------------------------------------------------- */

  const { data: aSees } = await execA
    .from("whatsapp_conversations").select("id").eq("id", convLinked);
  record("S3 assigned sales executive can read the linked conversation",
    (aSees ?? []).length === 1, `rows=${(aSees ?? []).length}`);

  const { data: bSees } = await execB
    .from("whatsapp_conversations").select("id").eq("id", convLinked);
  record("S3 unrelated sales executive is denied the linked conversation",
    (bSees ?? []).length === 0, `rows=${(bSees ?? []).length}`);

  const { data: mSees } = await mgr
    .from("whatsapp_conversations").select("id").eq("id", convLinked);
  const { data: saSees } = await sa
    .from("whatsapp_conversations").select("id").eq("id", convLinked);
  record("S3 manager and super admin retain broad access",
    (mSees ?? []).length === 1 && (saSees ?? []).length === 1,
    `mgr=${(mSees ?? []).length} sa=${(saSees ?? []).length}`);

  const { data: bMsgs } = await execB
    .from("whatsapp_messages").select("id").eq("conversation_id", convLinked);
  record("S3 unrelated executive cannot read the conversation's messages",
    (bMsgs ?? []).length === 0, `rows=${(bMsgs ?? []).length}`);

  /* ---------------------------------------------------------------------- */
  /* Scenario 4 — governed outbound                                           */
  /* ---------------------------------------------------------------------- */

  const { error: execBIntentErr } = await execB.rpc(
    "create_whatsapp_service_send_intent",
    {
      p_conversation_id: convLinked,
      p_idempotency_key: `cert-${suffix}-denied`,
      p_purpose_code: "WHATSAPP_SERVICE",
      p_body_text: "should not be allowed",
    }
  );
  record(
    "S4 unrelated executive cannot create a send intent",
    /denied_conversation_scope/.test(execBIntentErr?.message ?? ""),
    execBIntentErr?.message ?? "no error"
  );

  const { data: intentRow, error: intentErr } = await execA.rpc(
    "create_whatsapp_service_send_intent",
    {
      p_conversation_id: convLinked,
      p_idempotency_key: `cert-${suffix}-ok`,
      p_purpose_code: "WHATSAPP_SERVICE",
      p_body_text: "Thanks for reaching out to ONEDECORE.",
    }
  );
  const sendIntentId = (intentRow as { id?: string } | null)?.id ?? "";
  record(
    "S4 assigned executive creates a governed send intent",
    !intentErr && sendIntentId !== "",
    intentErr?.message ?? sendIntentId
  );
  record(
    "S4 send intent recorded eligible under consent + session governance",
    psql(`select eligibility_code from public.whatsapp_send_intents where id = '${sendIntentId}';`) ===
      "eligible",
    "eligible"
  );

  // DNC must fail closed on its own conversation.
  const dncInbound = inboundPayload(
    phones.dnc.slice(1), `wamid.cert.${suffix}.dnc`, "dnc inbound"
  );
  await route.POST(webhookRequest(dncInbound));
  const convDnc = conversationFor(phones.dnc);
  psql(
    `update public.contacts set status = 'do_not_contact'
      where id = (select contact_id from public.leads where id = '${leadDnc}');`
  );
  const { error: dncErr } = await execA.rpc("create_whatsapp_service_send_intent", {
    p_conversation_id: convDnc,
    p_idempotency_key: `cert-${suffix}-dnc`,
    p_purpose_code: "WHATSAPP_SERVICE",
    p_body_text: "should be refused",
  });
  record(
    "S4 do-not-contact rejects the send intent",
    /denied_dnc/.test(dncErr?.message ?? ""),
    dncErr?.message ?? "no error"
  );

  // Dispatch through the provider adapter boundary using the fake provider.
  process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = "local-test";
  const { dispatchWhatsappSendIntent } = await import(
    "../src/features/whatsapp/server/whatsapp-dispatch-service.ts"
  );
  const dispatch = await dispatchWhatsappSendIntent(sendIntentId);
  record(
    "S4 dispatch binds through the provider adapter boundary",
    dispatch.outcome === "bound",
    `${dispatch.outcome} ${dispatch.message ?? ""}`
  );

  const outboundMessageId = psql(
    `select coalesce(outbound_message_id::text,'') from public.whatsapp_send_intents where id = '${sendIntentId}';`
  );
  const providerMessageId = psql(
    `select coalesce(provider_message_id,'') from public.whatsapp_messages where id = '${outboundMessageId}';`
  );
  record(
    "S4 provider outcome persisted as a real outbound message",
    outboundMessageId !== "" && providerMessageId !== "",
    providerMessageId
  );
  record(
    "S4 dispatch attempt recorded as succeeded with the same provider id",
    psql(`select count(*) from public.whatsapp_provider_dispatch_attempts
            where send_intent_id = '${sendIntentId}' and status = 'succeeded'
              and provider_message_id = '${providerMessageId}';`) === "1",
    "1"
  );

  const redispatch = await dispatchWhatsappSendIntent(sendIntentId);
  record(
    "S4 re-dispatch is idempotent (already bound, no second send)",
    redispatch.outcome === "already_bound" &&
      psql(`select count(*) from public.whatsapp_messages where direction = 'outbound';`) === "1",
    redispatch.outcome
  );

  // Delivery status webhook keeps status processing coherent.
  const statusRes = await route.POST(
    webhookRequest(statusPayload(providerMessageId, "delivered", phones.linked))
  );
  record(
    "S4 delivered status webhook accepted and applied",
    statusRes.status === 200 &&
      psql(`select latest_status from public.whatsapp_messages where id = '${outboundMessageId}';`) ===
        "delivered",
    psql(`select latest_status from public.whatsapp_messages where id = '${outboundMessageId}';`)
  );

  const readRes = await route.POST(
    webhookRequest(statusPayload(providerMessageId, "read", phones.linked))
  );
  record(
    "S4 read status advances the same outbound message",
    readRes.status === 200 &&
      psql(`select latest_status from public.whatsapp_messages where id = '${outboundMessageId}';`) ===
        "read",
    psql(`select latest_status from public.whatsapp_messages where id = '${outboundMessageId}';`)
  );

  /* ---------------------------------------------------------------------- */
  /* Scenario 5 — CRM first-contact SLA evidence                              */
  /* ---------------------------------------------------------------------- */

  const evidenceTs = psql(
    `select private.validate_crm_whatsapp_send_evidence('${sendIntentId}'::uuid, '${leadLinked}'::uuid, null);`
  );
  record(
    "S5 governed send evidence validates for its own lead",
    evidenceTs !== "",
    evidenceTs
  );

  const wrongLead = psqlExpectError(
    `select private.validate_crm_whatsapp_send_evidence('${sendIntentId}'::uuid, '${leadOther}'::uuid, null);`
  );
  record(
    "S5 governed send evidence is refused for a different lead",
    /WHATSAPP_SEND_EVIDENCE_INVALID/.test(wrongLead ?? ""),
    "WHATSAPP_SEND_EVIDENCE_INVALID"
  );

  const bogus = psqlExpectError(
    `select private.validate_crm_whatsapp_send_evidence(gen_random_uuid(), '${leadLinked}'::uuid, null);`
  );
  record(
    "S5 a bogus/unverified send intent cannot satisfy the SLA path",
    /WHATSAPP_SEND_EVIDENCE_INVALID/.test(bogus ?? ""),
    "WHATSAPP_SEND_EVIDENCE_INVALID"
  );

  // A raw inbound-only conversation row is not send evidence.
  const rawIntent = psql(
    `select coalesce((select id::text from public.whatsapp_send_intents
        where lifecycle_status <> 'dispatch_bound' limit 1), '');`
  );
  if (rawIntent !== "") {
    const rawErr = psqlExpectError(
      `select private.validate_crm_whatsapp_send_evidence('${rawIntent}'::uuid, '${leadLinked}'::uuid, null);`
    );
    record(
      "S5 an unbound send intent is not accepted as evidence",
      /WHATSAPP_SEND_EVIDENCE_INVALID/.test(rawErr ?? ""),
      "WHATSAPP_SEND_EVIDENCE_INVALID"
    );
  }

  // Canonical path: complete a WhatsApp activity with the governed evidence.
  const { data: activityRow, error: activityErr } = await execA.rpc(
    "create_lead_activity",
    {
      p_lead_id: leadLinked,
      p_activity_type: "whatsapp",
      p_title: "Certification first contact",
      p_due_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_priority: "normal",
      p_owner_id: EXEC_A,
      p_is_primary: true,
    }
  );
  if (activityErr) throw new Error(`create_lead_activity: ${activityErr.message}`);
  const activityId = (activityRow as { id?: string } | null)?.id ?? "";

  const { error: completeErr } = await execA.rpc("complete_lead_activity", {
    p_activity_id: activityId,
    p_outcome_code: "whatsapp_sent",
    p_resolution: "NEXT_PRIMARY",
    p_next_activity_type: "call",
    p_next_title: "Certification follow-up call",
    p_next_due_at: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    p_next_priority: "normal",
    p_whatsapp_send_intent_id: sendIntentId,
  });
  record(
    "S5 governed WhatsApp evidence completes the activity through the canonical RPC",
    !completeErr,
    completeErr?.message ?? "completed"
  );

  const attemptAt = psql(
    `select coalesce(first_contact_attempt_at::text,'NULL') from public.crm_sla_clocks where lead_id = '${leadLinked}';`
  );
  record(
    "S5 first-contact SLA attempt recorded from governed send evidence only",
    attemptAt !== "NULL",
    attemptAt
  );
  record(
    "S5 the attempt instant is the provider timestamp, not a local clock",
    attemptAt ===
      psql(`select provider_timestamp::text from public.whatsapp_messages where id = '${outboundMessageId}';`),
    "provider_timestamp"
  );

  /* ---------------------------------------------------------------------- */
  /* Scenario 6 — quotation WhatsApp delivery                                 */
  /* ---------------------------------------------------------------------- */

  // Seed a finalized quotation + ready PDF + live grant on the OTHER lead as
  // postgres (service_role holds no privilege on the quotation domain).
  const qId = crypto.randomUUID();
  const qvId = crypto.randomUUID();
  const grantId = crypto.randomUUID();
  psql(`
    insert into public.quotations (id, lead_id, quotation_number, created_by)
      values ('${qId}', '${leadOther}', 'OD-Q-2026-${suffix}', '${SUPER_ADMIN}');
    insert into public.quotation_versions
      (id, quotation_id, version_number, status, is_current_draft, title, created_by)
      values ('${qvId}', '${qId}', 1, 'finalized', false, 'Certification quotation', '${SUPER_ADMIN}');
    insert into public.quotation_pdf_documents
      (quotation_id, quotation_version_id, object_path, status,
       pdf_sha256, file_size_bytes, created_by, ready_at)
      values ('${qId}', '${qvId}', 'cert/${qvId}.pdf', 'ready',
              repeat('a', 64), 4096, '${SUPER_ADMIN}', now());
    insert into public.quotation_access_grants
      (id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash)
      values ('${grantId}', '${qId}', '${qvId}', repeat('b', 32), repeat('c', 64));
  `);

  const { error: crossLeadErr } = await execA.rpc(
    "create_quotation_whatsapp_service_send_intent",
    {
      p_version_id: qvId,
      p_grant_id: grantId,
      p_conversation_id: convLinked, // belongs to leadLinked, not leadOther
      p_idempotency_key: `cert-${suffix}-quote-cross`,
    }
  );
  record(
    "S6 quotation send across a mismatched lead fails closed",
    /CONVERSATION_LEAD_MISMATCH/.test(crossLeadErr?.message ?? ""),
    crossLeadErr?.message ?? "no error"
  );

  // The correct lead's own linked conversation remains usable.
  const otherInbound = inboundPayload(
    phones.other.slice(1), `wamid.cert.${suffix}.other`, "quotation lead inbound"
  );
  await route.POST(webhookRequest(otherInbound));
  const convOther = conversationFor(phones.other);
  record(
    "S6 the quotation lead's own conversation linked deterministically",
    linkOf(convOther) === leadOther,
    linkOf(convOther)
  );

  const { data: qIntent, error: qErr } = await execA.rpc(
    "create_quotation_whatsapp_service_send_intent",
    {
      p_version_id: qvId,
      p_grant_id: grantId,
      p_conversation_id: convOther,
      p_idempotency_key: `cert-${suffix}-quote-ok`,
    }
  );
  record(
    "S6 quotation send on the correctly linked conversation remains usable",
    !qErr && (qIntent as { id?: string } | null)?.id != null,
    qErr?.message ?? "created"
  );
  record(
    "S6 quotation intent carries the secure-content binding, not a raw link",
    psql(`select secure_content_kind from public.whatsapp_send_intents
            where id = '${(qIntent as { id?: string } | null)?.id}';`) === "quotation_link",
    "quotation_link"
  );

  /* ---------------------------------------------------------------------- */
  /* Scenario 7 — timeline / reporting honesty                                */
  /* ---------------------------------------------------------------------- */

  const statusAfter = psql(`select status from public.leads where id = '${leadLinked}';`);
  record(
    "S7 linking and sending never mutate the lead stage on their own",
    statusAfter === statusBefore,
    `${statusBefore} -> ${statusAfter}`
  );

  record(
    "S7 no stage-change event was written by WhatsApp linking or sending",
    psql(`select count(*) from public.lead_events
            where lead_id = '${leadLinked}'
              and event_type in ('lead.status_changed', 'lead.on_hold', 'lead.resumed');`) === "0",
    "0"
  );

  record(
    "S7 no consent event was written by WhatsApp linking or sending",
    psql(`select count(*) from public.lead_events
            where lead_id = '${leadLinked}' and event_type = 'lead.consent_updated';`) === "0",
    "0"
  );

  record(
    "S7 no MARKETING consent was fabricated anywhere in the run",
    psql(`select count(*) from public.consent_events where purpose_code = 'MARKETING';`) === "0",
    "0"
  );

  record(
    "S7 outbound messages exist only for governed, dispatch-bound intents",
    psql(`select count(*) from public.whatsapp_messages m
            where m.direction = 'outbound'
              and not exists (
                select 1 from public.whatsapp_send_intents si
                 where si.outbound_message_id = m.id
                   and si.lifecycle_status = 'dispatch_bound');`) === "0",
    "0"
  );

  record(
    "S7 every persisted conversation link is provably canonical",
    psql(`select count(*) from public.whatsapp_conversations c
            where c.lead_id is not null
              and c.lead_id is distinct from (
                select r.lead_id from private.crm_resolve_whatsapp_lead_link(c.customer_e164) r);`) === "0",
    "0"
  );

  // CRM 2E analytics must still answer for the super admin after all of this.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const { error: analyticsErr } = await sa.rpc("get_crm_management_analytics", {
    p_start: monthStart.toISOString(),
    p_end: monthEnd.toISOString(),
    p_target_month: monthStart.toISOString().slice(0, 10),
    p_owner_id: null,
    p_source_id: null,
  });
  record(
    "S7 CRM 2E management analytics still resolves after WhatsApp activity",
    !analyticsErr,
    analyticsErr?.message ?? "ok"
  );

  /* ---------------------------------------------------------------------- */

  const passed = checks.every((c) => c.ok);
  fs.writeFileSync(
    path.join(artifactsDir, "certification-report.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        target: "local",
        leadLinked,
        conversationLinked: convLinked,
        sendIntentId,
        checks,
        passed,
      },
      null,
      2
    )}\n`
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${checks.length - failed.length}/${checks.length} certification checks passed.`
  );
  console.log(`artifacts: ${path.relative(root, artifactsDir)}`);
  if (!passed) {
    console.log("FAILED CHECKS:");
    for (const c of failed) console.log(` - ${c.label} (${c.detail})`);
  }
  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
