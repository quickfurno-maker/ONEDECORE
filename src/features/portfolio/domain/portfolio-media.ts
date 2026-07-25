import type { PortfolioMediaRole, PortfolioMediaStatus } from "./portfolio-status";

export interface PortfolioMediaItem {
  id: string;
  projectId: string;
  publicBucket: string;
  publicObjectPath: string | null;
  mediaRole: PortfolioMediaRole;
  status: PortfolioMediaStatus;
  altText: string;
  caption: string | null;
  widthPx: number | null;
  heightPx: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  sortOrder: number;
}
