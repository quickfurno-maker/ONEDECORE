/**
 * WhatsApp <-> CRM lead-link repair — owner QA. Local Supabase only.
 *
 * Drives the four owner-facing states through the real inbound webhook RPC
 * (public.ingest_meta_whatsapp_message) on a freshly reset local database:
 *
 *   1. single match      -> conversation links to exactly that lead
 *   2. unmatched         -> conversation stays NULL, message still persisted
 *   3. ambiguous         -> conversation stays NULL, message still persisted
 *   4. existing conflict -> existing link preserved, conflict reported
 *
 * Privileged fixture writes run in psql as postgres; nothing here targets a
 * managed project, sends to Meta, or mutates consent.
 *
 * Usage: npm run db:reset && npm run qa:crm-whatsapp-lead-link
 * Artifact: .artifacts/crm-whatsapp-lead-link/owner-qa-report.json
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "crm-whatsapp-lead-link");
const CONTAINER = "supabase_db_OneDecore";

function psql(sql) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
      "-c",
      sql,
    ],
    { encoding: "utf8" }
  ).trim();
}

try {
  execFileSync("docker", ["inspect", CONTAINER], { stdio: "ignore" });
} catch {
  console.error(
    `Local container ${CONTAINER} is required. Run npm run db:start && npm run db:reset first.`
  );
  process.exit(1);
}

const suffix = Date.now().toString().slice(-8);
const phones = {
  single: `+9198${suffix}`,
  unmatched: `+9197${suffix}`,
  ambiguousA: `+9196${suffix}`,
  conflict: `+9195${suffix}`,
};

function intake(name, phone, key, service, property) {
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

// Fixtures.
intake("QA Single", phones.single, `${suffix}-s`, "complete-home-interiors", "apartment-2bhk");
intake("QA Ambiguous", phones.ambiguousA, `${suffix}-a1`, "complete-home-interiors", "apartment-2bhk");
intake("QA Ambiguous", phones.ambiguousA, `${suffix}-a2`, "modular-kitchens", "apartment-3bhk");
intake("QA Conflict Donor", phones.conflict, `${suffix}-c`, "custom-wardrobes", "villa-rowhouse");

const leadSingle = psql(
  `select l.id from public.leads l
     join public.contact_channels ch on ch.contact_id = l.contact_id
    where ch.channel_type = 'phone' and ch.address_normalized = '${phones.single}' limit 1;`
);
const leadDonor = psql(
  `select l.id from public.leads l
     join public.contact_channels ch on ch.contact_id = l.contact_id
    where ch.channel_type = 'phone' and ch.address_normalized = '${phones.conflict}' limit 1;`
);

let wamid = 0;
function ingest(phone) {
  wamid += 1;
  const id = `wamid.QA.${suffix}.${wamid}`;
  psql(`
    select conversation_id from public.ingest_meta_whatsapp_message(
      p_event_key => 'msg:qa:${suffix}:${id}',
      p_event_hash => encode(digest('${id}-e', 'sha256'), 'hex'),
      p_envelope_hash => encode(digest('${id}-v', 'sha256'), 'hex'),
      p_waba_id => '99${suffix}',
      p_phone_number_id => '88${suffix}',
      p_display_phone_number => '+919876543210',
      p_provider_message_id => '${id}',
      p_customer_e164 => '${phone}',
      p_recipient_e164 => '+919876543210',
      p_display_name_snapshot => 'QA Customer',
      p_provider_message_type => 'text',
      p_normalized_message_type => 'text',
      p_body_text => 'owner qa',
      p_content => '{}'::jsonb,
      p_context_provider_message_id => null,
      p_provider_timestamp => now()
    );
  `);
  return psql(
    `select id from public.whatsapp_conversations where customer_e164 = '${phone}';`
  );
}

const convSingle = ingest(phones.single);
const convUnmatched = ingest(phones.unmatched);
const convAmbiguous = ingest(phones.ambiguousA);

// Scenario 4: an existing link that contradicts the canonical identity.
psql(
  `update public.whatsapp_conversations set lead_id = '${leadDonor}' where id = '${convUnmatched}';`
);
const conflictConv = convSingle;
psql(
  `update public.whatsapp_conversations set lead_id = '${leadDonor}' where id = '${conflictConv}';`
);
const conflictCode = psql(
  `select private.crm_apply_whatsapp_conversation_lead_link('${conflictConv}');`
);
const conflictLeadAfter = psql(
  `select lead_id from public.whatsapp_conversations where id = '${conflictConv}';`
);

function readLink(id) {
  return psql(
    `select coalesce(lead_id::text, 'NULL') from public.whatsapp_conversations where id = '${id}';`
  );
}
function messageCount(id) {
  return Number(
    psql(`select count(*) from public.whatsapp_messages where conversation_id = '${id}';`)
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  target: "local",
  scenarios: [
    {
      name: "single match links deterministically",
      conversation: convSingle,
      resolver: psql(
        `select resolution_code from private.crm_resolve_whatsapp_lead_link('${phones.single}');`
      ),
      expectedLead: leadSingle,
      messages: messageCount(convSingle),
    },
    {
      name: "unmatched identity stays NULL and keeps its message",
      conversation: convUnmatched,
      resolver: psql(
        `select resolution_code from private.crm_resolve_whatsapp_lead_link('${phones.unmatched}');`
      ),
      messages: messageCount(convUnmatched),
    },
    {
      name: "ambiguous identity stays NULL and keeps its message",
      conversation: convAmbiguous,
      link: readLink(convAmbiguous),
      resolver: psql(
        `select resolution_code from private.crm_resolve_whatsapp_lead_link('${phones.ambiguousA}');`
      ),
      candidates: Number(
        psql(
          `select candidate_lead_count from private.crm_resolve_whatsapp_lead_link('${phones.ambiguousA}');`
        )
      ),
      messages: messageCount(convAmbiguous),
    },
    {
      name: "existing conflicting link is preserved, never overwritten",
      conversation: conflictConv,
      code: conflictCode,
      leadAfter: conflictLeadAfter,
      donorLead: leadDonor,
      canonicalLead: leadSingle,
    },
  ],
  governance: {
    marketingConsentEvents: Number(
      psql(`select count(*) from public.consent_events where purpose_code = 'MARKETING';`)
    ),
    outboundMessages: Number(
      psql(`select count(*) from public.whatsapp_messages where direction = 'outbound';`)
    ),
    sendIntents: Number(psql(`select count(*) from public.whatsapp_send_intents;`)),
  },
};

const checks = [
  ["1 single match resolves to linked", report.scenarios[0].resolver === "linked"],
  ["1 single match wrote the canonical lead", readLink(convSingle) !== "NULL"],
  ["1 single match persisted its message", report.scenarios[0].messages === 1],
  ["2 unmatched resolves to no_identity_match", report.scenarios[1].resolver === "no_identity_match"],
  ["2 unmatched persisted its message", report.scenarios[1].messages === 1],
  ["3 ambiguous resolves to ambiguous_lead", report.scenarios[2].resolver === "ambiguous_lead"],
  ["3 ambiguous stayed NULL", report.scenarios[2].link === "NULL"],
  ["3 ambiguous saw two candidates", report.scenarios[2].candidates === 2],
  ["3 ambiguous persisted its message", report.scenarios[2].messages === 1],
  ["4 conflict reported as existing_link_conflict", conflictCode === "existing_link_conflict"],
  ["4 conflict left the existing link untouched", conflictLeadAfter === leadDonor],
  ["4 conflict did not write the canonical lead", conflictLeadAfter !== leadSingle],
  ["no MARKETING consent fabricated", report.governance.marketingConsentEvents === 0],
  ["no outbound provider message fabricated", report.governance.outboundMessages === 0],
  ["no send intent created", report.governance.sendIntents === 0],
];

report.checks = checks.map(([label, ok]) => ({ label, ok }));
report.passed = checks.every(([, ok]) => ok);

fs.mkdirSync(artifactsDir, { recursive: true });
fs.writeFileSync(
  path.join(artifactsDir, "owner-qa-report.json"),
  `${JSON.stringify(report, null, 2)}\n`
);

for (const { label, ok } of report.checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
}
console.log(report.passed ? "\nOwner QA passed." : "\nOwner QA FAILED.");
process.exit(report.passed ? 0 : 1);
