/**
 * ESM loader hook: stub server-only for Node app tests.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: new URL("./test-stub-server-only-empty.mjs", import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
