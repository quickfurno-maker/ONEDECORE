/**
 * Human-readable CRM field labels for intake codes.
 */

const CODE_LABELS: Readonly<Record<string, string>> = {
  "complete-home-interiors": "Complete Home Interiors",
  "modular-kitchens": "Modular Kitchens",
  "custom-wardrobes": "Custom Wardrobes",
  "apartment-1bhk": "Apartment — 1 BHK",
  "apartment-2bhk": "Apartment — 2 BHK",
  "apartment-3bhk": "Apartment — 3 BHK",
  "apartment-4bhk-plus": "Apartment — 4 BHK+",
  "villa-rowhouse": "Villa / Row House",
  "single-room": "Single Room",
  "ready-now": "Ready now",
  "within-3-months": "Within 3 months",
  "3-6-months": "3–6 months",
  "more-than-6-months": "More than 6 months",
  exploring: "Exploring",
  living: "Living",
  kitchen: "Kitchen",
  bedrooms: "Bedrooms",
  wardrobes: "Wardrobes",
  dining: "Dining",
  other: "Other",
  "under-3l": "Under ₹3L",
  "3-6l": "₹3–6L",
  "6-12l": "₹6–12L",
  "12-20l": "₹12–20L",
  "20-30l": "₹20–30L",
  "30l-plus": "₹30L+",
  manual: "Manual",
  manager: "Manager",
  super_admin: "Super Admin",
  source_rule: "Source rule",
  system: "System",
  open: "Open",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function formatCrmCodeLabel(code: string | null | undefined): string {
  if (!code) {
    return "—";
  }

  if (Object.hasOwn(CODE_LABELS, code)) {
    return CODE_LABELS[code]!;
  }

  return code
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCrmCodeList(codes: readonly string[]): string {
  if (codes.length === 0) {
    return "—";
  }

  return codes.map((code) => formatCrmCodeLabel(code)).join(", ");
}
