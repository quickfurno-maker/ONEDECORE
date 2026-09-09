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

import process from "node:process";
import {
  scanEnvKeys,
  readEnvExampleEntries,
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

// Default roots AND config files: `src/` alone would miss next.config.ts,
// which runs during the build and can read anything.
const { keys: sourceKeys, unknownNamespace } = scanEnvKeys();

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

const exampleEntries = readEnvExampleEntries();
const exampleKeys = readEnvExampleKeys();
const exampleCommented = readEnvExampleCommentedKeys();

/*
 * A duplicate assignment is not a style problem. dotenv keeps the last one, so
 * two lines for the same key means the file documents one value and provisions
 * another, and the reader has no way to tell which without knowing the loader.
 */
const seenExampleKeys = new Set();
for (const entry of exampleEntries) {
  if (seenExampleKeys.has(entry.key)) {
    fail(
      `DUPLICATE KEY ${entry.key} is assigned more than once in .env.example.\n` +
        `              The last assignment silently wins; delete the others.`
    );
  }
  seenExampleKeys.add(entry.key);
}

/*
 * EVERY REGISTERED SECRET MUST BE BLANK.
 *
 * Shape detection alone is not enough: it catches a Supabase JWT or a Meta
 * token, and misses a Groq key, a Google client secret, a bcrypt hash, or
 * somebody's `hunter2`. The registry already knows which keys are secrets, so
 * the rule is the strong one — a secret in a provisioning template has no
 * legitimate non-empty value, placeholder or otherwise. A would-be example
 * belongs in a comment, where it cannot be copied into a running system by a
 * loader.
 */
for (const entry of exampleEntries) {
  const contract = registry.get(entry.key);
  if (!contract || contract.sensitivity !== "secret") continue;
  if (entry.value !== "") {
    fail(
      `SECRET VALUE  ${entry.key} is a registered secret with a non-empty value in .env.example.\n` +
        `              Registered secrets must be exactly \`${entry.key}=\`.\n` +
        `              Put any illustrative value in a comment instead.`
    );
  }
}

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
 * Defence in depth, not the primary rule. The registry check above already
 * requires every known secret to be blank; this catches a credential parked on
 * a key that is NOT registered as a secret — a token pasted into a config slot,
 * say — which the registry alone would have no opinion about.
 */
const SECRET_SHAPES = [
  /^eyJ[A-Za-z0-9_-]{20,}/,
  /^sb_secret_/,
  /^sbp_/,
  /^EAA[A-Za-z0-9]{20,}/,
  /^sk-[A-Za-z0-9_-]{16,}/,
  /^gsk_[A-Za-z0-9]{16,}/,
  /^ya29\./,
  /^ghp_[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
for (const entry of exampleEntries) {
  if (SECRET_SHAPES.some((shape) => shape.test(entry.value))) {
    fail(
      `CREDENTIAL    ${entry.key} holds a value shaped like a real credential.\n` +
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
