import "server-only";

import {
  verifyCampaignExecutionContext,
  type SignedCampaignExecutionContext,
} from "./execution-context-crypto.ts";
import type { createAdminClient } from "../../../../lib/supabase/admin.ts";

export interface TrustedRunAttribution {
  readonly campaign_run_reference: string;
  readonly campaign_run_target_reference: string;
  readonly provider_channel: string;
  readonly execution_context_version: string;
}

export async function resolveTrustedRunAttribution(input: {
  readonly signed: SignedCampaignExecutionContext;
  readonly client: ReturnType<typeof createAdminClient>;
  readonly hmacSecret: string | null;
  readonly trustedLandingPublicationReference: string | null;
  readonly nowMs?: number;
}): Promise<{ readonly ok: true; readonly identity: TrustedRunAttribution } | { readonly ok: false }> {
  if (!input.hmacSecret) return { ok: false };
  if (!input.trustedLandingPublicationReference) return { ok: false };
  const verified = verifyCampaignExecutionContext(
    input.hmacSecret,
    input.signed,
    input.nowMs ?? Date.now()
  );
  if (!verified.valid) return { ok: false };
  if (
    input.signed.context.landingPublicationReference !== input.trustedLandingPublicationReference
  ) {
    return { ok: false };
  }

  const { data, error } = await input.client.rpc("verify_campaign_execution_context_binding", {
    p_run_reference: input.signed.context.runReference,
    p_run_target_reference: input.signed.context.runTargetReference,
    p_provider_channel: input.signed.context.providerChannel,
    p_campaign_reference: input.signed.context.campaignReference,
    p_campaign_version_number: input.signed.context.campaignVersionNumber,
    p_landing_publication_reference: input.signed.context.landingPublicationReference ?? "",
  });
  if (error) return { ok: false };
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (String(row.outcome_code) !== "ok") return { ok: false };

  return {
    ok: true,
    identity: {
      campaign_run_reference: input.signed.context.runReference,
      campaign_run_target_reference: input.signed.context.runTargetReference,
      provider_channel: input.signed.context.providerChannel,
      execution_context_version: String(input.signed.context.version),
    },
  };
}

export function ignoreUnsignedRunQuery(query: Record<string, string | undefined>): void {
  void query.run_reference;
  void query.run_target_reference;
  void query.utm_campaign;
}
