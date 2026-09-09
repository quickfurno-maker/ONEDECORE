/**
 * The rules `.env.example` must satisfy, as pure functions.
 *
 * These lived inline in `verify-env-contract.mjs`, which made them testable
 * only by mutating the repository's real `.env.example` and watching the script
 * exit non-zero. That works once, by hand, and is a poor thing to leave behind:
 * a test that edits tracked files can fail dirty, and a rule asserted by
 * grepping the implementation for the string "SECRET VALUE" passes on code that
 * says the right thing and does the wrong one.
 *
 * Extracted here they take entries and a registry and return findings, so the
 * suite can hand them a fixture and check what comes back.
 */

/**
 * Credential shapes, as defence in depth.
 *
 * The registry rule below is the primary one: a REGISTERED secret must be
 * blank, whatever it looks like. This list exists for the other case — a
 * credential parked on a key the registry does not classify as secret, which
 * the registry alone would have no opinion about.
 */
const CREDENTIAL_SHAPES = [
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

/**
 * Keys assigned more than once.
 *
 * dotenv keeps the last assignment, so a duplicate means the file documents one
 * value and provisions another, and a reader cannot tell which without knowing
 * the loader.
 */
export function findDuplicateKeys(entries) {
  const seen = new Set();
  const duplicates = [];
  for (const entry of entries) {
    if (seen.has(entry.key) && !duplicates.includes(entry.key)) {
      duplicates.push(entry.key);
    }
    seen.add(entry.key);
  }
  return duplicates;
}

/**
 * Registered secrets carrying any value at all.
 *
 * Shape detection alone was not enough — it catches a Supabase JWT and misses a
 * Groq key, a Google client secret, or somebody's `hunter2`. The registry
 * already knows which keys are secrets, so the rule is the strong one: a secret
 * in a provisioning template has no legitimate non-empty value, placeholder
 * included. An illustrative value belongs in a comment, where no loader can
 * pick it up.
 *
 * @param registry Map of key name to `{ sensitivity }`.
 */
export function findNonBlankSecrets(entries, registry) {
  const offenders = [];
  for (const entry of entries) {
    const contract = registry.get(entry.key);
    if (contract?.sensitivity !== "secret") continue;
    if (entry.value !== "") offenders.push(entry.key);
  }
  return offenders;
}

/** Values shaped like real credentials, on any key. */
export function findCredentialShapedValues(entries) {
  return entries
    .filter((entry) => CREDENTIAL_SHAPES.some((shape) => shape.test(entry.value)))
    .map((entry) => entry.key);
}
