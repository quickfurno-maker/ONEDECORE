"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { landingLabErrorFromUnknown, type LandingLabActionCode } from "./landing-errors.ts";
import { validateLandingPageBlocks, type LandingBlock } from "../contracts/blocks.ts";
import type { Json } from "@/types/database.generated.ts";

export interface LandingLabActionResult<T = void> {
  readonly success: boolean;
  readonly message: string;
  readonly code?: LandingLabActionCode;
  readonly data?: T;
}

function newKey(): string {
  return crypto.randomUUID();
}

function parseBlocks(raw: string): LandingBlock[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    if (validateLandingPageBlocks(parsed as LandingBlock[]) != null) return null;
    return parsed as LandingBlock[];
  } catch {
    return null;
  }
}

export async function createLandingPageAction(
  formData: FormData
): Promise<LandingLabActionResult<{ pageId: string }>> {
  try {
    const blocks = parseBlocks(String(formData.get("blocks") ?? "[]"));
    if (!blocks) {
      return { success: false, message: "Structured blocks failed validation.", code: "LANDING_LAB_UNKNOWN_ERROR" };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_landing_page_draft", {
      p_title: String(formData.get("title") ?? "").trim(),
      p_slug: String(formData.get("slug") ?? "").trim(),
      p_blocks: blocks as unknown as Json,
      p_version_label: String(formData.get("versionLabel") ?? "Draft v1").trim(),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    const pageId = String((data as Record<string, unknown>).landing_page_id);
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Landing page draft created.", data: { pageId } };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function saveLandingDraftAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const blocks = parseBlocks(String(formData.get("blocks") ?? "[]"));
    if (!blocks) {
      return { success: false, message: "Structured blocks failed validation.", code: "LANDING_LAB_UNKNOWN_ERROR" };
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_landing_page_draft", {
      p_version_id: String(formData.get("versionId")),
      p_expected_lock_version: Number(formData.get("lockVersion")),
      p_title: String(formData.get("title") ?? "").trim(),
      p_slug: String(formData.get("slug") ?? "").trim(),
      p_blocks: blocks as unknown as Json,
      p_version_label: String(formData.get("versionLabel") ?? "").trim(),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Draft saved." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function freezeLandingVersionAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("freeze_landing_page_version", {
      p_version_id: String(formData.get("versionId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Version frozen." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function createNextLandingVersionAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_next_landing_page_version", {
      p_landing_page_id: String(formData.get("pageId")),
      p_source_version_id: String(formData.get("sourceVersionId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Next draft version created." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function createLandingPublicationAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const campaign = String(formData.get("campaignReference") ?? "").trim();
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_landing_publication", {
      p_landing_page_id: String(formData.get("pageId")),
      p_version_id: String(formData.get("versionId")),
      p_campaign_reference: campaign || null,
      p_campaign_version_number: campaign ? Number(formData.get("campaignVersionNumber") || 1) : null,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Publication created." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function transitionLandingPublicationAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_landing_publication", {
      p_publication_id: String(formData.get("publicationId")),
      p_target_status: String(formData.get("targetStatus")),
      p_expected_lock_version: Number(formData.get("lockVersion")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Publication updated." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function saveLandingExperimentAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const variants = JSON.parse(String(formData.get("variants") ?? "[]")) as Json;
    const experimentId = String(formData.get("experimentId") ?? "").trim();
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_landing_experiment_draft", {
      p_publication_id: String(formData.get("publicationId")),
      p_experiment_id: experimentId || null,
      p_variants: variants,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Experiment draft saved." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function startLandingExperimentAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("start_landing_experiment", {
      p_experiment_id: String(formData.get("experimentId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Experiment started." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function concludeLandingExperimentAction(formData: FormData): Promise<LandingLabActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("conclude_landing_experiment", {
      p_experiment_id: String(formData.get("experimentId")),
      p_winner_variant_key: String(formData.get("winnerVariantKey")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/landing-pages");
    return { success: true, message: "Experiment concluded with human winner." };
  } catch (error) {
    const err = landingLabErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}
