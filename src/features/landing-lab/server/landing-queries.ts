import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LandingBlock } from "../contracts/blocks.ts";
import type { LandingPublicationStatus, LandingExperimentStatus } from "../contracts/page-model.ts";

export interface LandingPageListItem {
  readonly id: string;
  readonly pageReference: string;
  readonly title: string;
  readonly slug: string;
  readonly latestVersionNumber: number;
  readonly publicationStatus: LandingPublicationStatus | null;
  readonly experimentStatus: LandingExperimentStatus | null;
}

export interface LandingPageWorkspace {
  readonly id: string;
  readonly pageReference: string;
  readonly title: string;
  readonly slug: string;
  readonly versions: readonly {
    readonly id: string;
    readonly versionNumber: number;
    readonly label: string;
    readonly frozenAt: string | null;
    readonly lockVersion: number;
    readonly blocks: readonly LandingBlock[];
  }[];
  readonly publications: readonly {
    readonly id: string;
    readonly publicationReference: string;
    readonly versionId: string;
    readonly status: LandingPublicationStatus;
    readonly campaignReference: string | null;
    readonly campaignVersionNumber: number | null;
    readonly lockVersion: number;
  }[];
  readonly experiments: readonly {
    readonly id: string;
    readonly experimentReference: string;
    readonly publicationId: string;
    readonly status: LandingExperimentStatus;
    readonly winnerVariantKey: string | null;
    readonly variants: readonly {
      readonly variantKey: string;
      readonly versionId: string;
      readonly allocationPercent: number;
      readonly label: string;
    }[];
  }[];
  readonly analytics: readonly {
    readonly publicationReference: string;
    readonly exposures: number;
    readonly leads: number;
    readonly qualified: number;
    readonly consultationScheduled: number;
    readonly proposalSent: number;
    readonly closedWon: number;
  }[];
}

export async function listLandingPages(): Promise<readonly LandingPageListItem[]> {
  const supabase = await createClient();
  const { data: pages, error } = await supabase
    .from("landing_pages")
    .select("id, page_reference, title, slug")
    .order("created_at", { ascending: false });
  if (error || !pages) return [];

  const ids = pages.map((page) => page.id);
  const [{ data: versions }, { data: publications }, { data: experiments }] = await Promise.all([
    supabase.from("landing_page_versions").select("landing_page_id, version_number").in("landing_page_id", ids),
    supabase.from("landing_publications").select("landing_page_id, status, created_at").in("landing_page_id", ids),
    supabase.from("landing_experiments").select("publication_id, status"),
  ]);

  return pages.map((page) => {
    const latestVersionNumber = Math.max(
      0,
      ...(versions ?? []).filter((row) => row.landing_page_id === page.id).map((row) => row.version_number)
    );
    const pagePubs = (publications ?? [])
      .filter((row) => row.landing_page_id === page.id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const latestPub = pagePubs[0] ?? null;
    const running = (experiments ?? []).find(
      (exp) => pagePubs.some((pub) => pub.landing_page_id === page.id) && exp.status === "running"
    );
    const concluded = (experiments ?? []).find((exp) => exp.status === "concluded");
    return {
      id: page.id,
      pageReference: page.page_reference,
      title: page.title,
      slug: page.slug,
      latestVersionNumber,
      publicationStatus: (latestPub?.status as LandingPublicationStatus | undefined) ?? null,
      experimentStatus: (running?.status ?? concluded?.status ?? null) as LandingExperimentStatus | null,
    };
  });
}

export async function getLandingPageWorkspace(pageId: string): Promise<LandingPageWorkspace | null> {
  const supabase = await createClient();
  const { data: page, error } = await supabase
    .from("landing_pages")
    .select("id, page_reference, title, slug")
    .eq("id", pageId)
    .maybeSingle();
  if (error || !page) return null;

  const [{ data: versions }, { data: publications }] = await Promise.all([
    supabase
      .from("landing_page_versions")
      .select("id, version_number, label, frozen_at, lock_version, blocks")
      .eq("landing_page_id", pageId)
      .order("version_number", { ascending: false }),
    supabase
      .from("landing_publications")
      .select("id, publication_reference, landing_page_version_id, status, campaign_reference, campaign_version_number, lock_version")
      .eq("landing_page_id", pageId)
      .order("created_at", { ascending: false }),
  ]);

  const publicationIds = (publications ?? []).map((row) => row.id);
  const { data: experiments } = publicationIds.length
    ? await supabase
        .from("landing_experiments")
        .select("id, experiment_reference, publication_id, status, winner_variant_key")
        .in("publication_id", publicationIds)
    : { data: [] as never[] };
  const experimentIds = (experiments ?? []).map((row) => row.id);
  const { data: variants } = experimentIds.length
    ? await supabase
        .from("landing_experiment_variants")
        .select("experiment_id, variant_key, landing_page_version_id, allocation_percent, label")
        .in("experiment_id", experimentIds)
    : { data: [] as never[] };

  const { data: exposures } = publicationIds.length
    ? await supabase.from("landing_exposures").select("publication_id").in("publication_id", publicationIds)
    : { data: [] as never[] };

  const pubRefs = (publications ?? []).map((row) => row.publication_reference);
  const { data: leads } = pubRefs.length
    ? await supabase.from("leads").select("status, attribution").like("landing_path", "/lp/%")
    : { data: [] as never[] };

  const analytics = (publications ?? []).map((pub) => {
    const matchingLeads = (leads ?? []).filter((lead) => {
      const attr = lead.attribution as Record<string, unknown> | null;
      return attr?.publication_reference === pub.publication_reference;
    });
    const countStatus = (status: string) => matchingLeads.filter((lead) => lead.status === status).length;
    return {
      publicationReference: pub.publication_reference,
      exposures: (exposures ?? []).filter((row) => row.publication_id === pub.id).length,
      leads: matchingLeads.length,
      qualified: countStatus("qualified"),
      consultationScheduled: countStatus("consultation_scheduled"),
      proposalSent: countStatus("proposal_sent"),
      closedWon: countStatus("closed_won"),
    };
  });

  return {
    id: page.id,
    pageReference: page.page_reference,
    title: page.title,
    slug: page.slug,
    versions: (versions ?? []).map((row) => ({
      id: row.id,
      versionNumber: row.version_number,
      label: row.label,
      frozenAt: row.frozen_at,
      lockVersion: row.lock_version,
      blocks: row.blocks as unknown as LandingBlock[],
    })),
    publications: (publications ?? []).map((row) => ({
      id: row.id,
      publicationReference: row.publication_reference,
      versionId: row.landing_page_version_id,
      status: row.status as LandingPublicationStatus,
      campaignReference: row.campaign_reference,
      campaignVersionNumber: row.campaign_version_number,
      lockVersion: row.lock_version,
    })),
    experiments: (experiments ?? []).map((row) => ({
      id: row.id,
      experimentReference: row.experiment_reference,
      publicationId: row.publication_id,
      status: row.status as LandingExperimentStatus,
      winnerVariantKey: row.winner_variant_key,
      variants: (variants ?? [])
        .filter((variant) => variant.experiment_id === row.id)
        .map((variant) => ({
          variantKey: variant.variant_key,
          versionId: variant.landing_page_version_id,
          allocationPercent: variant.allocation_percent,
          label: variant.label,
        })),
    })),
    analytics,
  };
}
