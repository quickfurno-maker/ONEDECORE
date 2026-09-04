import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { fetchCrmPipelineBoard } from "@/features/crm/server/crm-pipeline-queries.ts";

/**
 * Canonical enriched pipeline board for the ONEDECORE Owner mobile app.
 *
 * Same reasoning as the leads endpoint: the board's per-card score and effective
 * bucket come from the shared pure derivations, and its urgency ordering is
 * canonical. Android consumes the assembled board rather than rebuilding it.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  const url = new URL(request.url);
  const ownerId = url.searchParams.get("ownerId");

  try {
    const board = await fetchCrmPipelineBoard(
      auth.context,
      { ownerId: ownerId ?? null },
      auth.db
    );

    return NextResponse.json(board);
  } catch (error) {
    console.error("[mobile/crm/pipeline]", error);

    return crmMobileError(
      "unavailable",
      "The pipeline is unavailable right now. Try again."
    );
  }
}
