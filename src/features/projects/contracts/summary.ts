/**
 * Phase 8 migration-independent — project summary view contracts.
 */

import type { ProjectHandoverState } from "./lifecycle.ts";
import type { ProjectRef } from "./reference.ts";

export interface ProjectSummary {
  readonly ref: ProjectRef;
  readonly clientDisplayName: string;
  readonly projectLabel: string | null;
  readonly handoverState: ProjectHandoverState;
  readonly highLevelStatusLabel: string;
  readonly owningSalesExecutiveId: string | null;
  readonly primaryProjectManagerId: string | null;
  readonly leadDesignerId: string | null;
  readonly createdAt: string;
}
