import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Ask several permission questions in one round trip.
 *
 * WHY THIS EXISTS
 *
 * Managed `pg_stat_statements`, accumulated since 2026-07-24, recorded 65,586
 * `authorize` calls against 78,938 PostgREST requests in total. Eighty-three
 * per cent of every database round trip this application has made was an
 * authorization check — at 3.36 ms each, and already index-driven, so nothing
 * about the query was wrong. The count was.
 *
 * Instrumenting one real path made it concrete: resolving the CRM access
 * context issues TWENTY-ONE `authorize` calls for one request, each for a
 * different permission, none duplicated. The admin layout's navigation flags
 * add roughly forty more. The page needs to know all of those things. It does
 * not need sixty network round trips to find out.
 *
 * WHAT THIS IS NOT
 *
 * It is not a cache. Every call still asks the database, and the answer is not
 * kept between requests, between users, or anywhere a stale grant could
 * survive a revocation. `public.authorize` remains the only place the access
 * rules live; `public.authorize_many` is a loop over it, and a pgTAP suite
 * compares the two answers for a granted user, a suspended profile, an inactive
 * role, revoked app access, a user with no role and an unauthenticated session.
 */

type AuthorizeManyClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The batch ceiling, matching the `limit 50` inside the RPC.
 *
 * Requests are split rather than truncated: silently dropping the fifty-first
 * code would answer `false` for a permission nobody actually checked, which is
 * a denial the user cannot explain and a bug nobody would find.
 */
const MAX_CODES_PER_CALL = 50;

/** Every requested code, mapped to whether the current user holds it. */
export type PermissionAnswers<Code extends string = string> = Readonly<
  Record<Code, boolean>
>;

function denyAll<Code extends string>(codes: readonly Code[]): PermissionAnswers<Code> {
  return Object.fromEntries(codes.map((code) => [code, false])) as PermissionAnswers<Code>;
}

/**
 * Resolve a set of permissions for the current authenticated staff user.
 *
 * Unknown codes, blank codes and RPC failures all answer `false`, exactly as a
 * single `authorize` call does — an authorization helper that threw on a
 * transport error would turn a slow network into an unhandled exception inside
 * a layout, and one that answered `true` would be a hole.
 */
export async function authorizeMany<Code extends string>(
  codes: readonly Code[],
  db?: AuthorizeManyClient
): Promise<PermissionAnswers<Code>> {
  if (codes.length === 0) {
    return {} as PermissionAnswers<Code>;
  }

  const supabase = db ?? (await createClient());
  const answers: Record<string, boolean> = denyAll(codes);

  for (let index = 0; index < codes.length; index += MAX_CODES_PER_CALL) {
    const batch = codes.slice(index, index + MAX_CODES_PER_CALL);
    const { data, error } = await supabase.rpc("authorize_many", {
      requested_permissions: batch as unknown as string[],
    });

    if (error || data === null || typeof data !== "object" || Array.isArray(data)) {
      // Fail closed for this batch. The codes already read `false`.
      continue;
    }

    for (const code of batch) {
      answers[code] = (data as Record<string, unknown>)[code] === true;
    }
  }

  return answers as PermissionAnswers<Code>;
}
