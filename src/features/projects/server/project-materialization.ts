import "server-only";

export type ProjectMaterializationState = "ready" | "pending_repair" | "skipped";

/**
 * Post-acceptance project materialization is separate from Phase 7B.
 * Failure must never rewrite acceptance success.
 */
export async function runPostAcceptanceProjectMaterialization(params: {
  quotationVersionId: string | null;
  materialize: (quotationVersionId: string, idempotencyKey: string) => Promise<boolean>;
}): Promise<ProjectMaterializationState> {
  if (!params.quotationVersionId) {
    return "pending_repair";
  }

  try {
    const ok = await params.materialize(
      params.quotationVersionId,
      `post-acceptance:${params.quotationVersionId}`
    );
    return ok ? "ready" : "pending_repair";
  } catch {
    return "pending_repair";
  }
}

export function resolveTrustedQuotationVersionId(
  capabilityData: Record<string, unknown> | undefined
): string | null {
  const value = capabilityData?.quotation_version_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}
