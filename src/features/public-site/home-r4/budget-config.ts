/**
 * Indicative budget estimator — planning ranges only, not quotations.
 */
export type EstimatorServiceId =
  | "complete-home"
  | "modular-kitchen"
  | "custom-wardrobes"
  | "selected-room";

export type EstimatorFinishId = "essential" | "premium" | "luxury";

export type BudgetComfortId =
  | "under-3l"
  | "3-6l"
  | "6-12l"
  | "12-20l"
  | "20-30l"
  | "30l-plus";

export interface PriceRange {
  readonly min: number;
  readonly max: number;
  readonly openEnded?: boolean;
}

export const ESTIMATOR_FINISHES = [
  {
    id: "essential" as const,
    label: "Essential",
    multiplier: 1,
    description:
      "Functional layouts, dependable materials, clean finishes.",
  },
  {
    id: "premium" as const,
    label: "Premium",
    multiplier: 1.3,
    description:
      "Upgraded finishes, hardware, detailing and refinement.",
  },
  {
    id: "luxury" as const,
    label: "Luxury",
    multiplier: 1.65,
    description:
      "High-detail customisation, premium finishes and more complex execution.",
  },
] as const;

export const ESTIMATOR_SERVICES = [
  {
    id: "complete-home" as const,
    label: "Complete Home Interiors",
    sizes: [
      { id: "1bhk", label: "1 BHK", range: { min: 350_000, max: 550_000 } },
      { id: "2bhk", label: "2 BHK", range: { min: 450_000, max: 800_000 } },
      { id: "3bhk", label: "3 BHK", range: { min: 650_000, max: 1_200_000 } },
      { id: "4bhk", label: "4 BHK+", range: { min: 900_000, max: 1_800_000 } },
      {
        id: "villa",
        label: "Villa / Row House",
        range: { min: 1_500_000, max: 3_000_000, openEnded: true },
      },
    ],
  },
  {
    id: "modular-kitchen" as const,
    label: "Modular Kitchen",
    sizes: [
      {
        id: "compact",
        label: "Compact / Straight",
        range: { min: 80_000, max: 150_000 },
      },
      { id: "l-shape", label: "L-Shaped", range: { min: 120_000, max: 250_000 } },
      {
        id: "parallel",
        label: "Parallel",
        range: { min: 160_000, max: 320_000 },
      },
      { id: "u-shape", label: "U-Shaped", range: { min: 200_000, max: 400_000 } },
      {
        id: "island",
        label: "Island / Large Kitchen",
        range: { min: 300_000, max: 600_000, openEnded: true },
      },
    ],
  },
  {
    id: "custom-wardrobes" as const,
    label: "Custom Wardrobes",
    sizes: [
      {
        id: "upto-6",
        label: "Up to 6 ft",
        range: { min: 35_000, max: 75_000 },
      },
      {
        id: "7-10",
        label: "7–10 ft",
        range: { min: 60_000, max: 125_000 },
      },
      {
        id: "11-15",
        label: "11–15 ft",
        range: { min: 100_000, max: 200_000 },
      },
      {
        id: "16-plus",
        label: "16 ft+",
        range: { min: 150_000, max: 300_000, openEnded: true },
      },
    ],
  },
  {
    id: "selected-room" as const,
    label: "Selected Room Interiors",
    sizes: [
      { id: "living", label: "Living Room", range: { min: 100_000, max: 400_000 } },
      { id: "bedroom", label: "Bedroom", range: { min: 80_000, max: 300_000 } },
      { id: "dining", label: "Dining", range: { min: 75_000, max: 250_000 } },
      {
        id: "study",
        label: "Study / Home Office",
        range: { min: 60_000, max: 200_000 },
      },
    ],
  },
] as const;

export const BUDGET_COMFORT_OPTIONS = [
  { id: "under-3l" as const, label: "Under ₹3L" },
  { id: "3-6l" as const, label: "₹3L–₹6L" },
  { id: "6-12l" as const, label: "₹6L–₹12L" },
  { id: "12-20l" as const, label: "₹12L–₹20L" },
  { id: "20-30l" as const, label: "₹20L–₹30L" },
  { id: "30l-plus" as const, label: "₹30L+" },
] as const;

export function roundEstimate(value: number): number {
  if (value >= 500_000) return Math.round(value / 10_000) * 10_000;
  return Math.round(value / 5_000) * 5_000;
}

export function formatInrRange(
  min: number,
  max: number,
  openEnded = false
): string {
  const fmt = (n: number) => {
    if (n >= 100_000) {
      const lakhs = n / 100_000;
      const text =
        Math.abs(lakhs - Math.round(lakhs)) < 0.05
          ? String(Math.round(lakhs))
          : lakhs.toFixed(1).replace(/\.0$/, "");
      return `₹${text}L`;
    }
    return `₹${n.toLocaleString("en-IN")}`;
  };
  return `${fmt(min)} – ${fmt(max)}${openEnded ? "+" : ""}`;
}

export function computeEstimate(
  serviceId: EstimatorServiceId,
  sizeId: string,
  finishId: EstimatorFinishId
): { min: number; max: number; openEnded: boolean; label: string } | null {
  const service = ESTIMATOR_SERVICES.find((s) => s.id === serviceId);
  const size = service?.sizes.find((s) => s.id === sizeId);
  const finish = ESTIMATOR_FINISHES.find((f) => f.id === finishId);
  if (!service || !size || !finish) return null;
  const min = roundEstimate(size.range.min * finish.multiplier);
  const max = roundEstimate(size.range.max * finish.multiplier);
  return {
    min,
    max,
    openEnded: "openEnded" in size.range ? Boolean(size.range.openEnded) : false,
    label: formatInrRange(
      min,
      max,
      "openEnded" in size.range ? Boolean(size.range.openEnded) : false
    ),
  };
}

/** Map estimator result mid-point to optional budget comfort band. */
export function suggestBudgetComfort(
  mid: number
): BudgetComfortId | null {
  if (mid < 300_000) return "under-3l";
  if (mid < 600_000) return "3-6l";
  if (mid < 1_200_000) return "6-12l";
  if (mid < 2_000_000) return "12-20l";
  if (mid < 3_000_000) return "20-30l";
  return "30l-plus";
}
