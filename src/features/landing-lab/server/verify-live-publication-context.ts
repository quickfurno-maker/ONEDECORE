import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../../types/database.generated.ts";
import type { SignedPublicationContext } from "../contracts/publication-context.ts";
import { verifyPublicationContext } from "./publication-context-crypto.ts";
import { getLandingLabHmacSecret } from "./landing-lab-env.ts";

export interface TrustedLandingIdentity {
  readonly landing_page_reference: string;
  readonly page_version_number: string;
  readonly publication_reference: string;
  readonly experiment_reference?: string;
  readonly variant_key?: string;
  readonly campaign_reference?: string;
  readonly campaign_version_number?: string;
}

export async function resolveTrustedLandingIdentity(input: {
  readonly signed: SignedPublicationContext;
  readonly client: SupabaseClient<Database>;
  readonly hmacSecret?: string | null;
}): Promise<
  | { readonly ok: true; readonly identity: TrustedLandingIdentity }
  | { readonly ok: false; readonly reason: string }
> {
  const secret = input.hmacSecret ?? getLandingLabHmacSecret();
  if (!secret) {
    return { ok: false, reason: "Landing publication context is unavailable." };
  }
  const signature = verifyPublicationContext(secret, input.signed);
  if (!signature.valid) {
    return { ok: false, reason: signature.reason };
  }

  const { data, error } = await input.client.rpc("verify_live_landing_publication_context", {
    p_publication_reference: input.signed.context.publicationReference,
    p_page_reference: input.signed.context.pageReference,
    p_page_version_number: input.signed.context.pageVersionNumber,
    p_experiment_reference: input.signed.context.experimentReference,
    p_variant_key: input.signed.context.variantKey,
  });
  if (error || data == null) {
    return { ok: false, reason: "Landing publication context is not live." };
  }
  const row = data as Record<string, Json | undefined>;
  if (row.ok !== true) {
    return { ok: false, reason: "Landing publication context is not live." };
  }

  const campaignReference =
    typeof row.campaign_reference === "string"
      ? row.campaign_reference
      : input.signed.context.campaignReference;
  const campaignVersion =
    typeof row.campaign_version_number === "number"
      ? String(row.campaign_version_number)
      : input.signed.context.campaignVersionNumber != null
        ? String(input.signed.context.campaignVersionNumber)
        : null;

  const identity: TrustedLandingIdentity = {
    landing_page_reference: input.signed.context.pageReference,
    page_version_number: String(input.signed.context.pageVersionNumber),
    publication_reference: input.signed.context.publicationReference,
    ...(input.signed.context.experimentReference
      ? { experiment_reference: input.signed.context.experimentReference }
      : {}),
    ...(input.signed.context.variantKey ? { variant_key: input.signed.context.variantKey } : {}),
    ...(campaignReference ? { campaign_reference: campaignReference } : {}),
    ...(campaignVersion ? { campaign_version_number: campaignVersion } : {}),
  };
  return { ok: true, identity };
}
