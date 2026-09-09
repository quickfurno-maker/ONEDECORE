/**
 * WHICH SUPABASE PROJECT THIS PROCESS IS ALLOWED TO TALK TO.
 *
 * DELIBERATELY NOT `server-only`. This module holds no secret and grants no
 * capability — it validates a URL, and the URL it validates is already public
 * (`NEXT_PUBLIC_SUPABASE_URL` ships in the browser bundle by definition). The
 * browser-side Supabase client resolves its target through `config/env.ts`,
 * which needs these same predicates, and a second copy of a security predicate
 * is how one of them gets relaxed alone. The credential-bearing factories
 * (`service-role.ts`, `admin.ts`) remain server-only.
 *
 * WHY THIS IS ITS OWN LAYER
 *
 * The repository had two service-role client factories exporting the same name
 * with different guarantees. `lib/supabase/admin.ts` resolved its URL through
 * the lead-intake environment, which validates the target host strictly.
 * `lib/supabase/service-role.ts` — used by quotations, commerce, projects and
 * the campaign dispatcher — accepted ANY URL that merely parsed as http or
 * https. A mistyped or swapped `NEXT_PUBLIC_SUPABASE_URL` would therefore have
 * sent a service-role credential, which bypasses RLS entirely, to whatever host
 * happened to be configured.
 *
 * Target identity is a property of the RUNTIME, not of any one feature. It has
 * nothing to do with consent versions, processor diligence or trust-proxy
 * headers, and a feature that needs a privileged client should not have to
 * import lead-intake law to get one. So the check lives here, once, and both
 * clients compose it.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT KNOW
 *
 * Anything about legal gates, lead readiness, or activation. `getLeadIntakeServerEnv`
 * keeps all of that and calls into this for the URL question alone.
 */

/**
 * The ONEDECORE managed Supabase project. A constant rather than an env value
 * on purpose: the whole point is to refuse a target the environment names
 * incorrectly, and a check configured by the thing it checks is not a check.
 */
export const ONEDECORE_MANAGED_SUPABASE_HOST = "lpurlfmpvriyvpkujvyl.supabase.co";

/**
 * True only for strict loopback Supabase URLs (local-test).
 *
 * Requires http:, a loopback host, an explicit valid port and the root path.
 * Credentials, query strings, fragments and deep paths are all refused: each is
 * a way to write a URL that reads as local to a human and resolves elsewhere.
 */
export function isLoopbackSupabaseUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.search) return false;
  if (parsed.hash) return false;
  const path = parsed.pathname === "/" ? "/" : parsed.pathname;
  if (path !== "/" && path !== "") return false;
  if (!parsed.port) return false;
  const portNum = Number(parsed.port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return false;
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/** True only for the ONEDECORE managed Supabase project over HTTPS. */
export function isManagedOneDecoreSupabaseUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.hash) return false;
  if (parsed.search) return false;
  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  if (path !== "" && path !== "/") return false;
  return parsed.hostname.toLowerCase() === ONEDECORE_MANAGED_SUPABASE_HOST;
}

/**
 * An error that names the RULE that failed and never the value that failed it.
 *
 * A Supabase URL is not itself a credential, but it identifies a project, and
 * these messages reach logs and occasionally responses. Naming the expectation
 * is enough for an operator to fix the configuration.
 */
export class SupabaseRuntimeTargetError extends Error {
  constructor(message: string) {
    super(`[ONEDECORE Supabase] ${message}`);
    this.name = "SupabaseRuntimeTargetError";
  }
}

export interface SupabaseRuntimeTargetOptions {
  /**
   * When true, only the managed ONEDECORE project is acceptable.
   *
   * Defaults to `NODE_ENV === "production"`. Passed explicitly by tests so the
   * production rule can be exercised without mutating the ambient environment.
   */
  readonly requireManaged?: boolean;
}

/**
 * Resolve and validate the Supabase URL this process may use.
 *
 * In production the answer is the managed ONEDECORE project or nothing.
 * Elsewhere a strict loopback stack is also acceptable, which is what local
 * development and `local-test` intake run against.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` is read first because it is the value the rest of
 * the app already agrees on; `SUPABASE_URL` remains accepted as the
 * server-side alias some hosts set.
 */
export function resolveSupabaseRuntimeTarget(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options: SupabaseRuntimeTargetOptions = {}
): string {
  const requireManaged = options.requireManaged ?? env.NODE_ENV === "production";

  const url =
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim() || "";

  if (!url) {
    throw new SupabaseRuntimeTargetError("Missing required Supabase URL.");
  }

  if (isManagedOneDecoreSupabaseUrl(url)) {
    return url;
  }

  if (requireManaged) {
    throw new SupabaseRuntimeTargetError(
      "Production requires the managed ONEDECORE Supabase project URL."
    );
  }

  if (isLoopbackSupabaseUrl(url)) {
    return url;
  }

  throw new SupabaseRuntimeTargetError(
    "Supabase URL must be the managed ONEDECORE project, or a loopback stack outside production."
  );
}
