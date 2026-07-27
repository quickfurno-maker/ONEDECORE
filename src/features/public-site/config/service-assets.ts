/**
 * Category C service marketing assets — ONEDECORE-owned generated artwork.
 * Not photographs of completed client work. Public-repository redistribution permitted.
 */
import type { ServiceStoryId } from "../content/services";

export interface ServiceMarketingAsset {
  readonly id: ServiceStoryId;
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
}

export const SERVICE_MARKETING_ASSETS = {
  "complete-home-interiors": {
    id: "complete-home-interiors",
    path: "/marketing/services/complete-home-interiors.webp",
    width: 1600,
    height: 1200,
    alt: "Abstract architectural composition of connected stone and timber interior planes",
    focalPoint: "48% 46%",
    mobileFocalPoint: "50% 48%",
    provenanceCategory: "C",
    bytes: 99864,
    publicRedistribution: true,
    depictsCompletedProject: false,
  },
  "modular-kitchens": {
    id: "modular-kitchens",
    path: "/marketing/services/modular-kitchens.webp",
    width: 1600,
    height: 1200,
    alt: "Abstract modular kitchen composition with stone work surface and aligned cabinetry planes",
    focalPoint: "52% 48%",
    mobileFocalPoint: "55% 50%",
    provenanceCategory: "C",
    bytes: 113924,
    publicRedistribution: true,
    depictsCompletedProject: false,
  },
  "custom-wardrobes": {
    id: "custom-wardrobes",
    path: "/marketing/services/custom-wardrobes.webp",
    width: 1600,
    height: 1200,
    alt: "Abstract wardrobe joinery composition with vertical timber panels and recessed shadow lines",
    focalPoint: "50% 45%",
    mobileFocalPoint: "48% 42%",
    provenanceCategory: "C",
    bytes: 115290,
    publicRedistribution: true,
    depictsCompletedProject: false,
  },
} as const satisfies Record<ServiceStoryId, ServiceMarketingAsset>;
