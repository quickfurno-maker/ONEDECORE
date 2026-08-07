/**
 * Append-only audit event contracts — persistence deferred to formal Phase 6C.
 */

import type { KritiErrorCode } from "./errors.ts";
import type { KritiTaskType } from "./task-types.ts";

export interface KritiRequestAuditEvent {
  readonly eventType: "kriti.request";
  readonly requestId: string;
  readonly taskType: KritiTaskType;
  readonly requestedAt: string;
  readonly contextHash: string;
}

export interface KritiSuggestionAuditEvent {
  readonly eventType: "kriti.suggestion";
  readonly requestId: string;
  readonly taskType: KritiTaskType;
  readonly schemaName: string;
  readonly resultHash: string;
  readonly occurredAt: string;
}

export interface KritiHumanUseAuditEvent {
  readonly eventType: "kriti.human_use";
  readonly requestId: string;
  readonly action: "copy" | "insert_draft";
  readonly occurredAt: string;
}

export interface KritiDismissAuditEvent {
  readonly eventType: "kriti.dismiss";
  readonly requestId: string;
  readonly occurredAt: string;
}

export type KritiAuditEvent =
  | KritiRequestAuditEvent
  | KritiSuggestionAuditEvent
  | KritiHumanUseAuditEvent
  | KritiDismissAuditEvent;

export interface KritiAuditSink {
  readonly record: (event: KritiAuditEvent) => Promise<void>;
}

export interface KritiFailureAuditMetadata {
  readonly code: KritiErrorCode;
  readonly occurredAt: string;
}
