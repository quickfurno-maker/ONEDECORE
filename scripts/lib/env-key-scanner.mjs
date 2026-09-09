/**
 * Finds the environment variables production source actually reads.
 *
 * WHY THIS IS AN AST WALK AND NOT A REGEX
 *
 * A previous attempt scanned for SCREAMING_SNAKE string literals and reported
 * `META_AUTH`, `KRITI_RATE_LIMITED` and `GOOGLE_ADS_TIMEOUT_UNKNOWN` as
 * environment variables. They are error codes. A drift guard that cries wolf on
 * every provider error constant gets switched off within a week, so the guard
 * was deferred rather than shipped noisy.
 *
 * Two independent filters fix that:
 *
 *   1. SHAPE. Only real read sites count — `process.env.X`, `process.env["X"]`,
 *      `env.X`, `env["X"]`, and the string argument of the repository's own
 *      env readers (`readOptional(env, "X")`, `getEnvVar("X")`). A bare string
 *      sitting in a union type or a throw is not a read.
 *
 *   2. NAMESPACE. Only names inside the namespaces this project actually uses.
 *      `META_WHATSAPP_ACCESS_TOKEN` is an env var; `META_AUTH` is not, and no
 *      amount of shape analysis would tell them apart — the namespace does.
 *
 * Both must agree before a name is reported.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * The environment namespaces ONEDECORE actually uses.
 *
 * Deliberately narrow. `META_*` and `GOOGLE_*` are NOT namespaces here — the
 * provider credentials live under `ONEDECORE_META_ADS_*` and
 * `ONEDECORE_GOOGLE_ADS_*`, while bare `META_*` names in the source are
 * provider error codes.
 */
const ENV_PREFIXES = [
  "ONEDECORE_",
  "NEXT_PUBLIC_",
  "META_WHATSAPP_",
  "SUPABASE_",
];

/**
 * Individually named keys that carry no project prefix.
 *
 * `QUOTATION_CAPABILITY_SECRET` predates the ONEDECORE_ convention and is read
 * as `process.env.QUOTATION_CAPABILITY_SECRET`. It is named here rather than
 * given a prefix rule, because one legacy name should not widen the namespace
 * filter that keeps provider error codes out.
 */
const ENV_EXACT = new Set(["NODE_ENV", "QUOTATION_CAPABILITY_SECRET"]);

/**
 * Functions whose string arguments name an environment variable.
 *
 * `read` is deliberately included even though the name is generic: a match
 * still has to satisfy the namespace filter, so an unrelated `read(x, "foo")`
 * contributes nothing. Leaving it out cost more — the Meta and Google Ads
 * credentials are read through exactly that helper and went unreported.
 */
const ENV_READER_FUNCTIONS = new Set([
  "read",
  "readOptional",
  "readRequired",
  "getEnvVar",
  "readEnv",
]);

export function isEnvKeyName(name) {
  if (ENV_EXACT.has(name)) return true;
  return ENV_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function listSourceFiles(root) {
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Tests may reference any key to exercise a parser; they are not the
        // production contract and would otherwise inflate it.
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".d.ts")) continue;
      files.push(full);
    }
  })(root);
  return files.sort();
}

/** `process.env` or a parameter/identifier conventionally named `env`. */
function isEnvBearingExpression(node) {
  if (ts.isPropertyAccessExpression(node)) {
    return (
      ts.isIdentifier(node.expression) &&
      node.expression.text === "process" &&
      node.name.text === "env"
    );
  }
  return ts.isIdentifier(node) && node.text === "env";
}

function stringLiteralText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

/**
 * @returns {{ keys: Map<string, Set<string>>, unknownNamespace: Map<string, Set<string>> }}
 */
export function scanEnvKeys(root = "src") {
  const found = new Map();
  /*
   * The namespace filter can fail in two directions, and only one of them is
   * loud. Too broad reports error codes; too narrow silently drops a real key —
   * which is how QUOTATION_CAPABILITY_SECRET went unnoticed. Anything read from
   * the environment but outside the known namespaces is collected here so the
   * verifier can surface it instead of pretending it does not exist.
   */
  const unknownNamespace = new Map();

  const record = (name, file) => {
    if (!name) return;
    if (!isEnvKeyName(name)) {
      /*
       * `env` is also a perfectly ordinary name for a resolved config object,
       * so `env.hashSecret` reaches here without being an environment read at
       * all. Environment variables are SCREAMING_SNAKE by universal
       * convention; a camelCase property is a field on somebody's object and
       * reporting it would make this net noise rather than a signal.
       */
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
        if (!unknownNamespace.has(name)) unknownNamespace.set(name, new Set());
        unknownNamespace.get(name).add(file);
      }
      return;
    }
    if (!found.has(name)) found.set(name, new Set());
    found.get(name).add(file);
  };

  for (const file of listSourceFiles(root)) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    /*
     * Names bound to an env-key literal, so a constant used as an indirection
     * still resolves. `const LEAD_MODE_ENV = "ONEDECORE_LEAD_INTAKE_MODE"`
     * followed by `env[LEAD_MODE_ENV]` is the repository's own idiom.
     */
    const constants = new Map();

    (function collectConstants(node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        const literal = stringLiteralText(node.initializer);
        if (literal && isEnvKeyName(literal)) {
          constants.set(node.name.text, literal);
        }
      }
      ts.forEachChild(node, collectConstants);
    })(source);

    (function visit(node) {
      // process.env.X  |  env.X
      if (
        ts.isPropertyAccessExpression(node) &&
        isEnvBearingExpression(node.expression)
      ) {
        record(node.name.text, file);
      }

      // process.env["X"]  |  env["X"]  |  env[CONSTANT]
      if (
        ts.isElementAccessExpression(node) &&
        isEnvBearingExpression(node.expression)
      ) {
        const literal = stringLiteralText(node.argumentExpression);
        if (literal) {
          record(literal, file);
        } else if (
          ts.isIdentifier(node.argumentExpression) &&
          constants.has(node.argumentExpression.text)
        ) {
          record(constants.get(node.argumentExpression.text), file);
        }
      }

      // readOptional(env, "X")  |  read(env, "X")  |  getEnvVar("X")
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (ENV_READER_FUNCTIONS.has(node.expression.text)) {
          for (const argument of node.arguments) {
            const literal = stringLiteralText(argument);
            // Namespace-only here: a generic `read(...)` argument is not
            // evidence of an environment read on its own.
            if (literal && isEnvKeyName(literal)) record(literal, file);
            if (
              ts.isIdentifier(argument) &&
              constants.has(argument.text)
            ) {
              record(constants.get(argument.text), file);
            }
          }
        }
      }

      /*
       * An exported constant whose value is an env key is part of the contract
       * even when the read happens through a helper this scanner cannot follow.
       * `LANDING_LAB_HMAC_SECRET_ENV` is declared in one module and consumed in
       * another.
       */
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        /_ENV$/.test(node.name.text) &&
        node.initializer
      ) {
        record(stringLiteralText(node.initializer), file);
      }

      ts.forEachChild(node, visit);
    })(source);
  }

  return { keys: found, unknownNamespace };
}

/** Uncommented `KEY=` assignments in a dotenv-style file. */
export function readEnvExampleKeys(file = ".env.example") {
  const keys = new Set();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match) keys.add(match[1]);
  }
  return keys;
}

/** Commented-out `# KEY=` lines: documented but intentionally unset. */
export function readEnvExampleCommentedKeys(file = ".env.example") {
  const keys = new Set();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^#\s*([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match) keys.add(match[1]);
  }
  return keys;
}
