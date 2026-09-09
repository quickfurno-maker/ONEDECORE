/**
 * Canonical Supabase type generation.
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE
 *
 * `src/types/database.generated.ts` is machine output. Nobody edits it by hand.
 * Application-specific corrections live in `src/types/database.ts`, which is
 * reviewed like ordinary code. The file went stale precisely because the two
 * roles were mixed: a stale generated file was patched by hand, which made a
 * full regeneration look like an unrelated thousand-line diff and so kept being
 * deferred.
 *
 * THE SOURCE OF TRUTH IS THE LOCAL STACK, NOT PRODUCTION
 *
 * Types are generated from `supabase/migrations/` applied to a clean local
 * database. Generating from the managed project would make the checked-in
 * contract depend on whatever happens to be deployed, which is the opposite of
 * a repository invariant — and it would put a production credential in CI.
 *
 * REPRODUCIBILITY
 *
 * The pinned CLI is invoked as a plain Node script from `node_modules`, not
 * through a shell or a globally installed binary, so Windows and Linux run
 * exactly the same code path. The only post-processing is line-ending
 * normalisation, which is required because Git checks the file out with CRLF on
 * Windows while the generator always emits LF; without it the drift guard would
 * fail on every Windows machine and pass in CI.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** The one file the generator owns. */
export const GENERATED_TYPES_FILE = path.join(
  repositoryRoot,
  "src",
  "types",
  "database.generated.ts"
);

/**
 * The schema the application talks to.
 *
 * `public` only. The historical checked-in file also carried `graphql_public`,
 * which no application code references — the repository does not use the
 * GraphQL endpoint — so it was stale output kept alive by inertia rather than a
 * contract anybody depends on.
 */
export const CANONICAL_SCHEMAS = "public";

const CLI_ENTRY = path.join(repositoryRoot, "node_modules", "supabase", "dist", "supabase.js");

/**
 * The exact generation command, as data, so the verifier and the writer cannot
 * drift apart and the tests can assert what runs.
 */
export const GENERATION_ARGUMENTS = [
  "gen",
  "types",
  "--local",
  "--schema",
  CANONICAL_SCHEMAS,
  "--lang",
  "typescript",
];

/** Human-readable form of the same command, for error messages and docs. */
export const GENERATION_COMMAND = `supabase ${GENERATION_ARGUMENTS.join(" ")}`;

/**
 * The only normalisation applied to generator output.
 *
 * Deterministic and total: CRLF and lone CR become LF, and the file ends with
 * exactly one newline. Anything beyond this belongs in the handwritten overlay,
 * not in a post-processing step.
 */
export function normalizeGeneratedSource(text) {
  return `${text.replace(/\r\n?/g, "\n").replace(/\n+$/, "")}\n`;
}

/**
 * Run the pinned CLI against the running local stack.
 *
 * @returns {{ ok: true, source: string } | { ok: false, reason: string }}
 */
export function generateDatabaseTypes() {
  if (!fs.existsSync(CLI_ENTRY)) {
    return {
      ok: false,
      reason: `the pinned Supabase CLI is missing at ${path.relative(repositoryRoot, CLI_ENTRY)}; run npm ci`,
    };
  }

  const result = spawnSync(process.execPath, [CLI_ENTRY, ...GENERATION_ARGUMENTS], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    return { ok: false, reason: `could not run the Supabase CLI: ${result.error.message}` };
  }
  if (result.status !== 0) {
    const detail = (result.stderr || "").trim().split("\n").slice(-3).join("\n");
    return {
      ok: false,
      reason:
        `type generation failed (exit ${result.status}).\n` +
        `Is the local stack running? Start it with: npx supabase start\n${detail}`,
    };
  }

  const source = normalizeGeneratedSource(result.stdout);
  if (!source.includes("export type Database = {")) {
    return { ok: false, reason: "the generator produced output with no Database type" };
  }
  return { ok: true, source };
}

/** The checked-in file, normalised the same way, or null when it is absent. */
export function readCheckedInTypes() {
  if (!fs.existsSync(GENERATED_TYPES_FILE)) return null;
  return normalizeGeneratedSource(fs.readFileSync(GENERATED_TYPES_FILE, "utf8"));
}
