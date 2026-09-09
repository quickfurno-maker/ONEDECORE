/**
 * Fails the build when the environment contract, the source and `.env.example`
 * disagree.
 *
 * Three lists must line up:
 *
 *   SOURCE      what production code actually reads (AST, see lib/env-key-scanner.mjs)
 *   REGISTRY    what src/config/env-contract.ts says is supported
 *   EXAMPLE     what .env.example documents for whoever provisions a machine
 *
 * When they drifted, `.env.example` declared 22 keys while source read 47. The
 * gap was not obscure: every Meta Ads credential, every Google Ads credential,
 * the entire Kriti group and both campaign activation gates were undocumented.
 * Nobody could have provisioned an environment correctly from the repository.
 *
 * The guard also enforces the rules that make the metadata worth trusting: a
 * secret may not be public-scoped, and NEXT_PUBLIC_ may not carry one.
 */

import fs from "node:fs";
import process from "node:process";
import {
  scanEnvKeys,
  readEnvExampleKeys,
  readEnvExampleCommentedKeys,
} from "./lib/env-key-scanner.mjs";
import { ONEDECORE_ENV_CONTRACT } from "../src/config/env-contract.ts";

const problems = [];
const fail = (message) => problems.push(message);

// --------------------------------------------------------------- registry ---

const registry = new Map();
for (const entry of ONEDECORE_ENV_CONTRACT) {
  if (registry.has(entry.name)) {
    fail(`DUPLICATE     ${entry.name} appears twice in the registry.`);
    continue;
  }
  registry.set(entry.name, entry);
}

for (const entry of registry.values()) {
  // A secret inlined into the browser bundle is not a secret.
  if (entry.sensitivity === "secret" && entry.scope === "public") {
    fail(
      `PUBLIC SECRET ${entry.name} is marked secret but public-scoped.\n` +
        `              A public value ships to every visitor's browser.`
    );
  }
  if (entry.name.startsWith("NEXT_PUBLIC_") && entry.sensitivity === "secret") {
    fail(
      `PUBLIC SECRET ${entry.name} carries the NEXT_PUBLIC_ prefix and is marked secret.\n` +
        `              Next.js inlines that prefix into client JavaScript at build time.`
    );
  }
  if (entry.name.startsWith("NEXT_PUBLIC_") && entry.scope !== "public") {
    fail(
      `SCOPE         ${entry.name} is NEXT_PUBLIC_ but not declared public-scoped.`
    );
  }
  // A key nobody can set is a key nobody can use.
  if (entry.lifecycle === "local-test-only" && entry.inEnvExample) {
    fail(
      `LIFECYCLE     ${entry.name} is local-test-only and must not be an active .env.example line.`
    );
  }
}

// ----------------------------------------------------------------- source ---

const { keys: sourceKeys, unknownNamespace } = scanEnvKeys("src");

for (const [name, files] of sourceKeys) {
  if (!registry.has(name)) {
    const where = [...files].slice(0, 2).join(", ");
    fail(
      `UNREGISTERED  ${name} is read by source but absent from the contract.\n` +
        `              read in: ${where}\n` +
        `              Add it to src/config/env-contract.ts with its scope,\n` +
        `              sensitivity, lifecycle and subsystem.`
    );
  }
}

for (const name of registry.keys()) {
  if (!sourceKeys.has(name)) {
    fail(
      `UNUSED        ${name} is in the contract but nothing in src/ reads it.\n` +
        `              Remove it, or note why it is retained.`
    );
  }
}

/*
 * The scanner's namespace filter can be too narrow as easily as too broad. A
 * SCREAMING_SNAKE read outside the known namespaces is reported rather than
 * dropped, because that is how QUOTATION_CAPABILITY_SECRET stayed invisible.
 */
for (const [name, files] of unknownNamespace) {
  fail(
    `UNKNOWN NS    ${name} is read from the environment but matches no known namespace.\n` +
      `              read in: ${[...files][0]}\n` +
      `              Either add its namespace to lib/env-key-scanner.mjs or\n` +
      `              name it explicitly there.`
  );
}

// ---------------------------------------------------------- .env.example ---

const exampleKeys = readEnvExampleKeys();
const exampleCommented = readEnvExampleCommentedKeys();

for (const entry of registry.values()) {
  if (entry.inEnvExample && !exampleKeys.has(entry.name)) {
    fail(
      `NOT DOCUMENTED ${entry.name} is supported but has no .env.example line.\n` +
        `              Someone provisioning an environment cannot discover it.`
    );
  }
  if (!entry.inEnvExample && exampleKeys.has(entry.name)) {
    fail(
      `SHOULD COMMENT ${entry.name} is ${entry.lifecycle} and should be a commented\n` +
        `              example rather than an active line.`
    );
  }
}

for (const name of exampleKeys) {
  if (!registry.has(name)) {
    fail(
      `STALE EXAMPLE ${name} is in .env.example but not in the contract.\n` +
        `              Remove it, or register it if it is genuinely supported.`
    );
  }
}
for (const name of exampleCommented) {
  if (!registry.has(name) && name !== "NODE_ENV") {
    fail(`STALE COMMENT ${name} is commented in .env.example but not registered.`);
  }
}

// -------------------------------------------------------- no real secrets ---

/*
 * A placeholder is fine; a token is not. This looks for values with the shape
 * of real credentials rather than for any non-empty value, so documented
 * defaults like `false` and `disabled` stay allowed.
 */
const SECRET_SHAPES = [
  /^eyJ[A-Za-z0-9_-]{20,}/,
  /^sb_secret_/,
  /^sbp_/,
  /^EAA[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
for (const line of fs.readFileSync(".env.example", "utf8").split(/\r?\n/)) {
  const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (!match) continue;
  const value = match[2].trim();
  if (SECRET_SHAPES.some((shape) => shape.test(value))) {
    fail(
      `SECRET VALUE  ${match[1]} looks like a real credential in .env.example.\n` +
        `              Replace it with an empty placeholder.`
    );
  }
}

// ----------------------------------------------------------------- report ---

if (problems.length > 0) {
  console.error("\nEnvironment contract is out of date:\n");
  for (const problem of problems) console.error(problem + "\n");
  console.error(
    `source=${sourceKeys.size} registry=${registry.size} example=${exampleKeys.size}\n`
  );
  process.exit(1);
}

const activationGated = [...registry.values()].filter(
  (entry) => entry.lifecycle === "activation-gated"
).length;
console.log(
  `env contract OK: ${registry.size} keys ` +
    `(source ${sourceKeys.size}, .env.example ${exampleKeys.size}, ` +
    `${activationGated} activation-gated)`
);
