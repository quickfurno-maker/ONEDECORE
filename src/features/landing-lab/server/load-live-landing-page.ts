import "server-only";

import { cookies } from "next/headers";
import type { LandingBlock } from "../contracts/blocks.ts";
import { validateLandingPageBlocks } from "../contracts/blocks.ts";
import type { LandingExperiment, LandingVariant } from "../contracts/page-model.ts";
import type { PublicationContext, SignedPublicationContext } from "../contracts/publication-context.ts";
import { resolveDeterministicVariant } from "../domain/routing.ts";
import { signPublicationContext } from "./publication-context-crypto.ts";
import { createLandingLabServiceClient } from "./landing-lab-admin.ts";
import {
  getLandingLabHmacSecret,
  isLandingLabPublicEnabled,
  LP_VISITOR_COOKIE_NAME,
} from "./landing-lab-env.ts";
import { asiaKolkataAssignmentEpoch, hashLandingVisitorKey } from "./visitor-key-hash.ts";
import { createClient } from "@/lib/supabase/server";

export interface LiveLandingPageView {
  readonly title: string;
  readonly slug: string;
  readonly blocks: readonly LandingBlock[];
  readonly signedContext: SignedPublicationContext;
  readonly variantKey: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function loadLiveLandingPageView(slug: string): Promise<LiveLandingPageView | null> {
  if (!isLandingLabPublicEnabled()) return null;
  const secret = getLandingLabHmacSecret();
  if (!secret) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_live_landing_publication", { p_slug: slug });
  if (error || data == null) return null;
  const payload = asRecord(data);
  if (!payload) return null;
  const page = asRecord(payload.page);
  const publication = asRecord(payload.publication);
  const version = asRecord(payload.version);
  if (!page || !publication || !version) return null;

  const experimentRaw = asRecord(payload.experiment);
  let blocks = version.blocks as LandingBlock[];
  let pageVersionNumber = Number(version.version_number);
  let experimentReference: string | null = null;
  let variantKey: string | null = null;
  let experimentId: string | null = null;

  const visitorCookies = await cookies();
  const visitorKey = visitorCookies.get(LP_VISITOR_COOKIE_NAME)?.value ?? "";

  if (experimentRaw && Array.isArray(experimentRaw.variants) && visitorKey) {
    const variants: LandingVariant[] = experimentRaw.variants.map((raw) => {
      const row = asRecord(raw) ?? {};
      return {
        variantKey: String(row.variant_key ?? ""),
        pageReference: String(page.page_reference ?? ""),
        pageVersionNumber: Number(row.version_number ?? 0),
        allocationPercent: Number(row.allocation_percent ?? 0),
        label: String(row.label ?? ""),
      };
    });
    const experiment: LandingExperiment = {
      experimentReference: String(experimentRaw.experiment_reference ?? ""),
      publicationReference: String(publication.publication_reference ?? ""),
      status: "running",
      variants,
      winnerVariantKey: null,
    };
    variantKey = resolveDeterministicVariant({ experiment, visitorKey });
    experimentReference = experiment.experimentReference;
    experimentId = typeof experimentRaw.id === "string" ? experimentRaw.id : null;
    const chosen = (experimentRaw.variants as unknown[]).map(asRecord).find(
      (row) => row && String(row.variant_key) === variantKey
    );
    if (chosen && Array.isArray(chosen.blocks)) {
      blocks = chosen.blocks as LandingBlock[];
      pageVersionNumber = Number(chosen.version_number ?? pageVersionNumber);
    }
  }

  if (validateLandingPageBlocks(blocks) != null) {
    return null;
  }

  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const context: PublicationContext = {
    publicationReference: String(publication.publication_reference ?? ""),
    pageReference: String(page.page_reference ?? ""),
    pageVersionNumber,
    experimentReference,
    variantKey,
    campaignReference:
      typeof publication.campaign_reference === "string" ? publication.campaign_reference : null,
    campaignVersionNumber:
      typeof publication.campaign_version_number === "number"
        ? publication.campaign_version_number
        : null,
    issuedAt,
    expiresAt,
  };
  const signedContext = signPublicationContext(secret, context);

  const publicationId = typeof publication.id === "string" ? publication.id : null;
  if (publicationId && visitorKey) {
    const service = createLandingLabServiceClient();
    if (service) {
      await service.rpc("record_landing_exposure", {
        p_publication_id: publicationId,
        p_experiment_id: experimentId,
        p_variant_key: variantKey,
        p_visitor_key_hash: hashLandingVisitorKey(secret, visitorKey),
        p_assignment_epoch: asiaKolkataAssignmentEpoch(),
      });
    }
  }

  return {
    title: String(page.title ?? "ONEDECORE"),
    slug: String(page.slug ?? slug),
    blocks,
    signedContext,
    variantKey,
  };
}
