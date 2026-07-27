/**
 * Frozen C5B material story content — owner-approved editorial captions.
 * Category-C marketing artwork only; not completed project photography.
 * No material-performance claims.
 */
import type { MaterialStoryAssetId } from "../config/material-assets";

export const MATERIAL_STORY_SECTION_COPY = {
  overline: "Material Story",
  heading: "Materials considered as part of the wider composition",
  introduction:
    "Stone, timber, texture, light, and shadow are considered together to shape a calm and coherent interior language.",
} as const;

export type MaterialStoryItemId =
  | "travertine-bronze"
  | "timber-joinery"
  | "textured-panel";

export type MaterialStoryRole = "primary" | "supporting";

export interface MaterialStoryItem {
  readonly id: MaterialStoryItemId;
  readonly ordinal: "01" | "02" | "03";
  readonly theme: string;
  readonly caption: string;
  readonly assetId: MaterialStoryAssetId;
  readonly role: MaterialStoryRole;
}

export const MATERIAL_STORY_ITEMS = [
  {
    id: "travertine-bronze",
    ordinal: "01",
    theme: "Travertine and bronze architectural detail",
    caption: "Stone, light, and shadow brought together with restraint.",
    assetId: "travertine-bronze",
    role: "primary",
  },
  {
    id: "timber-joinery",
    ordinal: "02",
    theme: "Warm timber joinery detail",
    caption: "Joinery considered through proportion, alignment, and material detail.",
    assetId: "timber-joinery",
    role: "supporting",
  },
  {
    id: "textured-panel",
    ordinal: "03",
    theme: "Textured neutral panel with charcoal recess",
    caption: "Layers of texture held within a calm and coherent palette.",
    assetId: "textured-panel",
    role: "supporting",
  },
] as const satisfies readonly MaterialStoryItem[];
