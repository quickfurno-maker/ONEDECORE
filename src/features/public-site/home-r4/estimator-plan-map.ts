/**
 * Canonical estimator → PlanContext mapping for R5.3.1.
 * Pure functions — no React. PlanContext remains the single store.
 */
import {
  ESTIMATOR_FINISHES,
  ESTIMATOR_SERVICES,
  computeEstimate,
  formatInrRange,
  suggestBudgetComfort,
  type BudgetComfortId,
  type EstimatorFinishId,
  type EstimatorServiceId,
} from "./budget-config.ts";
import type { PmPropertyId, PmRoomId, PmServiceId } from "./content.ts";
import type { PlanEstimateSummary } from "./plan-state.ts";

export interface EstimatorPlanSelection {
  readonly service: PmServiceId;
  readonly property: PmPropertyId;
  readonly rooms: readonly PmRoomId[];
  readonly budgetComfort: BudgetComfortId | null;
  readonly estimatorServiceLabel: string;
  readonly estimatorSizeLabel: string;
  readonly estimatorFinishLabel: string;
  readonly estimatorRangeLabel: string;
}

const COMPLETE_HOME_PROPERTY: Record<string, PmPropertyId> = {
  "1bhk": "apartment-1bhk",
  "2bhk": "apartment-2bhk",
  "3bhk": "apartment-3bhk",
  "4bhk": "apartment-4bhk-plus",
  villa: "villa-rowhouse",
};

export function mapEstimatorToPlanSelection(
  serviceId: EstimatorServiceId,
  sizeId: string,
  finishId: EstimatorFinishId
): EstimatorPlanSelection | null {
  const service = ESTIMATOR_SERVICES.find((entry) => entry.id === serviceId);
  const size = service?.sizes.find((entry) => entry.id === sizeId);
  const finish = ESTIMATOR_FINISHES.find((entry) => entry.id === finishId);
  const estimate = computeEstimate(serviceId, sizeId, finishId);
  if (!service || !size || !finish || !estimate) return null;

  let planService: PmServiceId;
  let property: PmPropertyId;
  let rooms: readonly PmRoomId[] = [];

  switch (serviceId) {
    case "complete-home": {
      planService = "complete-home-interiors";
      property = COMPLETE_HOME_PROPERTY[sizeId] ?? "single-room";
      rooms = [];
      break;
    }
    case "modular-kitchen": {
      planService = "modular-kitchens";
      property = "single-room";
      rooms = ["kitchen"];
      break;
    }
    case "custom-wardrobes": {
      planService = "custom-wardrobes";
      property = "single-room";
      rooms = ["wardrobes"];
      break;
    }
    case "selected-room": {
      planService = "complete-home-interiors";
      property = "single-room";
      if (sizeId === "living") rooms = ["living"];
      else if (sizeId === "bedroom") rooms = ["bedrooms"];
      else if (sizeId === "dining") rooms = ["dining"];
      else if (sizeId === "study") rooms = ["other"];
      else rooms = [];
      break;
    }
    default:
      return null;
  }

  const mid = (estimate.min + estimate.max) / 2;

  return {
    service: planService,
    property,
    rooms,
    budgetComfort: suggestBudgetComfort(mid),
    estimatorServiceLabel: service.label,
    estimatorSizeLabel: size.label,
    estimatorFinishLabel: finish.label,
    estimatorRangeLabel: estimate.label,
  };
}

export function toEstimateSummary(
  selection: EstimatorPlanSelection
): PlanEstimateSummary {
  return {
    serviceLabel: selection.estimatorServiceLabel,
    sizeLabel: selection.estimatorSizeLabel,
    finishLabel: selection.estimatorFinishLabel,
    rangeLabel: selection.estimatorRangeLabel,
  };
}

/** Static no-JS price guide rows derived from budget-config (no duplicated literals). */
export function buildNoscriptPriceGuide(): readonly {
  readonly serviceLabel: string;
  readonly sizes: readonly { readonly label: string; readonly range: string }[];
}[] {
  return ESTIMATOR_SERVICES.map((service) => ({
    serviceLabel: service.label,
    sizes: service.sizes.map((size) => ({
      label: size.label,
      range: formatInrRange(
        size.range.min,
        size.range.max,
        "openEnded" in size.range ? Boolean(size.range.openEnded) : false
      ),
    })),
  }));
}

export const NOSCRIPT_FINISH_GUIDANCE = [
  { id: "essential" as const, label: "Essential", factor: "base range" },
  {
    id: "premium" as const,
    label: "Premium",
    factor: "approximately 1.30×",
  },
  {
    id: "luxury" as const,
    label: "Luxury",
    factor: "approximately 1.65×",
  },
] as const;

export const NOSCRIPT_PRICE_DISCLAIMER =
  "These are indicative planning ranges, not final quotations. Measurements, detailed scope, materials, hardware, civil work and site conditions can change the final price.";
