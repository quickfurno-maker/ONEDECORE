/**
 * Kriti suggestion and result contracts.
 */

import type { KritiError } from "./errors.ts";
import type { KritiTaskType } from "./task-types.ts";
import type { KritiStructuredOutput } from "./task-schemas.ts";
import type { KritiUsage } from "./provider.ts";

export interface KritiSafetyDecision {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface KritiSuggestion {
  readonly taskType: KritiTaskType;
  readonly schemaName: string;
  readonly output: KritiStructuredOutput;
  readonly humanReviewRequired: boolean;
  readonly disclaimer: string;
}

export type KritiResult =
  | {
      readonly ok: true;
      readonly requestId: string;
      readonly suggestion: KritiSuggestion;
      readonly usage: KritiUsage;
    }
  | {
      readonly ok: false;
      readonly requestId: string;
      readonly error: KritiError;
    };
