/**
 * Category C material marketing assets — ONEDECORE-owned generated artwork.
 * Not photographs of completed client work. Public-repository redistribution permitted.
 * No attribution required.
 */
export type MaterialStoryAssetId =
  | "travertine-bronze"
  | "timber-joinery"
  | "textured-panel";

export interface MaterialMarketingAsset {
  readonly id: MaterialStoryAssetId;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly focalPoint: string;
  readonly mobileFocalPoint: string;
  readonly provenanceCategory: "C";
  readonly bytes: number;
  readonly publicRedistribution: true;
  readonly depictsCompletedProject: false;
  readonly ownership: "ONEDECORE";
  readonly attributionRequired: false;
  readonly generationMethod: "Cursor GenerateImage";
  readonly generationDate: "2026-07-27";
}

export const MATERIAL_MARKETING_ASSETS = {
  "travertine-bronze": {
    id: "travertine-bronze",
    path: "/marketing/materials/travertine-bronze-detail.webp",
    width: 1800,
    height: 1200,
    alt: "Abstract travertine surface with a slim bronze reveal and charcoal shadow",
    focalPoint: "48% 46%",
    mobileFocalPoint: "50% 48%",
    provenanceCategory: "C",
    bytes: 117146,
    publicRedistribution: true,
    depictsCompletedProject: false,
    ownership: "ONEDECORE",
    attributionRequired: false,
    generationMethod: "Cursor GenerateImage",
    generationDate: "2026-07-27",
  },
  "timber-joinery": {
    id: "timber-joinery",
    path: "/marketing/materials/timber-joinery-detail.webp",
    width: 1800,
    height: 1200,
    alt: "Abstract warm timber joinery detail with aligned edges and a recessed shadow line",
    focalPoint: "38% 58%",
    mobileFocalPoint: "40% 55%",
    provenanceCategory: "C",
    bytes: 71478,
    publicRedistribution: true,
    depictsCompletedProject: false,
    ownership: "ONEDECORE",
    attributionRequired: false,
    generationMethod: "Cursor GenerateImage",
    generationDate: "2026-07-27",
  },
  "textured-panel": {
    id: "textured-panel",
    path: "/marketing/materials/textured-panel-charcoal-detail.webp",
    width: 1200,
    height: 800,
    alt: "Abstract textured neutral panel composition with a charcoal recessed detail",
    focalPoint: "45% 50%",
    mobileFocalPoint: "48% 52%",
    provenanceCategory: "C",
    bytes: 117564,
    publicRedistribution: true,
    depictsCompletedProject: false,
    ownership: "ONEDECORE",
    attributionRequired: false,
    generationMethod: "Cursor GenerateImage",
    generationDate: "2026-07-27",
  },
} as const satisfies Record<MaterialStoryAssetId, MaterialMarketingAsset>;
