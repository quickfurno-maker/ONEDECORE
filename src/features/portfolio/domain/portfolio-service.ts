export const PORTFOLIO_SERVICE_CODES = [
  "complete_home_interiors",
  "modular_kitchens",
  "custom_wardrobes",
] as const;

export type PortfolioServiceCode = (typeof PORTFOLIO_SERVICE_CODES)[number];

export const PORTFOLIO_SERVICE_LABELS: Record<PortfolioServiceCode, string> = {
  complete_home_interiors: "Complete Home Interiors",
  modular_kitchens: "Modular Kitchens",
  custom_wardrobes: "Custom Wardrobes",
};
