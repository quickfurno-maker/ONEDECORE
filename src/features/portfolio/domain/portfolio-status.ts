export const PORTFOLIO_PROJECT_STATUSES = ["draft", "published", "archived"] as const;
export type PortfolioProjectStatus = (typeof PORTFOLIO_PROJECT_STATUSES)[number];

export const PORTFOLIO_MEDIA_ROLES = ["cover", "gallery"] as const;
export type PortfolioMediaRole = (typeof PORTFOLIO_MEDIA_ROLES)[number];

export const PORTFOLIO_MEDIA_STATUSES = ["draft", "ready", "retired"] as const;
export type PortfolioMediaStatus = (typeof PORTFOLIO_MEDIA_STATUSES)[number];
