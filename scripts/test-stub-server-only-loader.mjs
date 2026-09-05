/**
 * ESM loader hook for the Node app tests.
 *
 * Three resolutions Node cannot do on its own:
 *
 *  1. `server-only` — a build-time marker with no Node-loadable implementation.
 *  2. `next/<sub>`  — Next ships these as `next/<sub>.js`; the extensionless
 *                     specifier only resolves through a bundler.
 *  3. `@/...`       — the tsconfig path alias for `src/`, which is a TypeScript
 *                     compile-time mapping Node knows nothing about.
 *
 * Without 2 and 3, any module reachable from a Route Handler could only be
 * asserted by reading its source. Resolving them lets those flows be EXECUTED
 * in tests instead, which is a materially stronger proof.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(fileURLToPath(new URL("../src/", import.meta.url)));

/** `@/foo/bar` -> the real file under src/, trying the usual extensions. */
function resolveSrcAlias(specifier) {
  const relative = specifier.slice(2);
  const base = path.join(SRC_ROOT, relative);

  // Extension-bearing candidates only, so a directory of the same name is never
  // mistaken for the module.
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: new URL("./test-stub-server-only-empty.mjs", import.meta.url).href,
    };
  }

  // next/server, next/navigation, next/headers, ... ship with a .js extension.
  if (/^next\/[a-z-]+$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.js`, context);
    } catch {
      // Fall through to the default resolution and let Node report it.
    }
  }

  if (specifier.startsWith("@/")) {
    const url = resolveSrcAlias(specifier);
    if (url) {
      return { shortCircuit: true, url };
    }
  }

  // Extensionless relative imports (`./session`) — TypeScript resolves these,
  // Node does not. Tried ONLY after the literal specifier fails, so nothing that
  // already resolves is affected.
  if (specifier.startsWith(".") && path.extname(specifier) === "") {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      const parent = context.parentURL;
      if (!parent) {
        throw error;
      }
      const base = path.resolve(path.dirname(fileURLToPath(parent)), specifier);
      for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.mts`,
        `${base}.js`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ]) {
        if (existsSync(candidate)) {
          return { shortCircuit: true, url: pathToFileURL(candidate).href };
        }
      }
      throw error;
    }
  }

  return nextResolve(specifier, context);
}
