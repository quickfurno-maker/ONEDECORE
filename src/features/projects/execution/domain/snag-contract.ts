/**
 * Snag item contracts — migration-independent, no work-order ERP.
 */

export const SNAG_STATUSES = ["open", "in_progress", "resolved"] as const;

export type SnagStatus = (typeof SNAG_STATUSES)[number];

export interface SnagItem {
  readonly snagRef: string;
  readonly description: string;
  readonly status: SnagStatus;
  readonly evidenceRefs: readonly string[];
  readonly createdAt: string;
  readonly createdByProfileId: string;
  readonly resolvedAt: string | null;
  readonly resolvedByProfileId: string | null;
}

export interface SnagSummaryView {
  readonly total: number;
  readonly open: number;
  readonly inProgress: number;
  readonly resolved: number;
  readonly blockingHandover: boolean;
}

export function validateSnagItem(item: SnagItem): string | null {
  if (!item.snagRef.trim()) {
    return "Snag reference is required.";
  }
  const description = item.description.trim();
  if (description.length < 5) {
    return "Snag description must be at least 5 characters.";
  }
  if (description.length > 2000) {
    return "Snag description exceeds maximum length.";
  }
  if (item.status === "resolved") {
    if (!item.resolvedAt || !item.resolvedByProfileId) {
      return "Resolved snags require resolved metadata.";
    }
    if (item.evidenceRefs.length === 0) {
      return "Resolved snags require at least one evidence reference.";
    }
  }
  return null;
}

export function buildSnagSummary(items: readonly SnagItem[]): SnagSummaryView {
  let open = 0;
  let inProgress = 0;
  let resolved = 0;

  for (const item of items) {
    if (item.status === "open") open += 1;
    if (item.status === "in_progress") inProgress += 1;
    if (item.status === "resolved") resolved += 1;
  }

  return {
    total: items.length,
    open,
    inProgress,
    resolved,
    blockingHandover: open > 0 || inProgress > 0,
  };
}

export function canResolveSnag(item: SnagItem): boolean {
  return item.status !== "resolved";
}
