import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "../contracts/control-plane.ts";
import {
  parseWhatsappSegmentPreviewPayload,
  parseWhatsappSegmentRuleGroup,
  type WhatsappSegmentPreview,
  type WhatsappSegmentRuleGroup,
} from "../contracts/segment-rules.ts";

/*
 * Segment reads through the CALLER's session. The table answers through RLS
 * on whatsapp.segments.read; the preview RPC re-checks the same permission and
 * counts in SQL. No contact row ever leaves the database from a preview.
 */

export interface WhatsappSegmentView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly ruleGroup: WhatsappSegmentRuleGroup | null;
  readonly updatedAt: string;
}

const SEGMENT_COLUMNS = "id, name, description, rule_group, is_active, updated_at";

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  rule_group: unknown;
  is_active: boolean;
  updated_at: string;
};

function toView(row: SegmentRow): WhatsappSegmentView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    ruleGroup: parseWhatsappSegmentRuleGroup(row.rule_group),
    updatedAt: row.updated_at,
  };
}

export async function listWhatsappSegmentsForCurrentUser(): Promise<readonly WhatsappSegmentView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_segments")
    .select(SEGMENT_COLUMNS)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map(toView);
}

export async function getWhatsappSegmentForCurrentUser(segmentId: string): Promise<WhatsappSegmentView | null> {
  if (!isUuid(segmentId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_segments").select(SEGMENT_COLUMNS).eq("id", segmentId).maybeSingle();
  if (error || !data) return null;
  return toView(data);
}

export type WhatsappSegmentPreviewRead =
  | { readonly kind: "ready"; readonly preview: WhatsappSegmentPreview }
  | { readonly kind: "inactive" }
  | { readonly kind: "failed" };

export async function previewWhatsappSegmentForCurrentUser(segmentId: string): Promise<WhatsappSegmentPreviewRead> {
  if (!isUuid(segmentId)) return { kind: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_whatsapp_segment", { p_segment_id: segmentId });
  if (error) return error.code === "P0002" ? { kind: "inactive" } : { kind: "failed" };
  const preview = parseWhatsappSegmentPreviewPayload(data);
  return preview ? { kind: "ready", preview } : { kind: "failed" };
}
