import type { PortfolioMediaRole, PortfolioMediaStatus } from "./portfolio-status";

/**
 * Upload limits, defined HERE rather than beside the sharp pipeline.
 *
 * The browser needs them: an uploader that lets somebody queue a 40MB file and
 * only learns it is too large after sending it is worse than one that says so
 * immediately. But importing them from `portfolio-image-pipeline` drags `sharp`
 * — a native module — into the client bundle, and the build fails outright
 * trying to resolve `detect-libc` for the browser.
 *
 * So the numbers live in this pure module and the pipeline re-exports them.
 * One definition, importable from either side.
 */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MiB
export const MAX_DIMENSION_PX = 12000;
export const MAX_PIXELS_TOTAL = 50000000; // 50 MP

/** The formats the pipeline accepts, as MIME types a file input can filter on. */
export const ACCEPTED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

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
