#!/usr/bin/env node
// INT-9 source-only promotion denial gate. No credentials, network, Supabase or Meta calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, relative, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pathOf = (p) => resolve(root, p);
// Canonical LF prevents Windows working-tree CRLF from disagreeing with committed Git blobs on Linux CI.
export const sha = (raw) => createHash("sha256").update(String(Buffer.isBuffer(raw) ? raw.toString("utf8") : raw).replace(/\r\n/g, "\n")).digest("hex");
const pinned = [
  "package.json",
  "package-lock.json",
  ".github/workflows/quality-gate.yml",
  "supabase/config.toml",
  "docs/releases/INT9-FINAL-INTERNAL-CLOSURE-20261023.md",
  "docs/releases/INT9ABC-INTERNAL-ACCEPTANCE-20261023.md",
  "docs/releases/INT10-FINAL-INTERNAL-CERTIFICATION-20261023.md",
  "scripts/crm-2e-owner-qa.mjs",
  "scripts/crm-2e-browser-qa.mjs",
  "scripts/int10-governance-audit.mjs",
  "scripts/int9-worker-contention-lab.mjs",
  "scripts/int9-crm-browser-a11y.mjs",
  "src/features/whatsapp/components/campaigns/campaign-scheduler.css",
  "scripts/int9-release-preflight.mjs",
  "scripts/int9-release-preflight.test.mjs",
  "scripts/verify-dependency-security.mjs",
  "src/features/whatsapp/server/whatsapp-campaign-worker.ts",
  "src/features/whatsapp/__tests__/whatsapp-campaign-scheduler.test.ts"
];
const migrations = readdirSync(pathOf("supabase/migrations"))
  .filter((x) => x.endsWith(".sql"))
  .sort()
  .map((x) => "supabase/migrations/" + x);
const source = [...pinned, ...migrations].sort().map((file) => ({
  file, sha256: sha(readFileSync(pathOf(file)))
}));
const sourceDigest = sha(source.map(({file, sha256}) => file + " " + sha256).join("\n") + "\n");
const out = "ops/releases/onedecore-int9-20261023-hold.json";
const frozen = {
  schema: "onedecore.int9.review-candidate.v1",
  project: "ONEDECORE",
  sourceBaseline: "27521f031195a8b749bebeceae0ba22ad475b816",
  sourceDigest,
  sourceFileCount: source.length,
  migrationCount: migrations.length,
  source,
  safety: {
    independentAppsecApproved: false,
    independentDbaApproved: false,
    disposableCampaignConcurrencyCertified: true,
    mobileBrowserAccessibilityCertified: true,
    controlledStagingAuthorized: false,
    productionAuthorized: false,
    metaActivationAuthorized: false,
    outboundMessagingAuthorized: false,
    internalDevelopmentComplete: true
  },
  decision: "HOLD"
};
export function verifyInt9Manifest(candidate) {
  assert.equal(candidate.schema, frozen.schema, "schema mismatch");
  assert.equal(candidate.sourceBaseline, frozen.sourceBaseline, "source baseline mismatch");
  assert.equal(candidate.sourceDigest, frozen.sourceDigest, "source digest differs");
  assert.equal(candidate.sourceFileCount, frozen.sourceFileCount, "file count differs");
  assert.equal(candidate.migrationCount, frozen.migrationCount, "migration inventory differs");
  assert.deepEqual(candidate.source, frozen.source, "source file hash mismatch");
  assert.deepEqual(candidate.safety, frozen.safety, "review gate altered or not approved");
  assert.equal(candidate.decision, "HOLD", "promotion is not authorized");
  return true;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    mkdirSync(dirname(pathOf(out)), { recursive: true });
    writeFileSync(pathOf(out), JSON.stringify(frozen, null, 2) + "\n");
    console.log("INT9_HOLD_MANIFEST_WRITTEN " + source.length + " files / " + migrations.length + " SQL");
  } else {
    assert.ok(existsSync(pathOf(out)), "missing reviewed manifest");
    verifyInt9Manifest(JSON.parse(readFileSync(pathOf(out), "utf8")));
    console.log("INT9_HOLD_PREFLIGHT_PASS " + source.length + " files / " + migrations.length + " SQL; activation denied");
  }
}
