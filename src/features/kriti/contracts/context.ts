/**
 * Sanitized Kriti context DTOs — no raw DB clients or secrets.
 */

import type { KritiTaskType } from "./task-types.ts";

export interface KritiTrustedPolicyContext {
  readonly brandName: string;
  readonly assistanceScope: string;
  readonly prohibitedActions: readonly string[];
}

export interface KritiAuthorizedBusinessContext {
  readonly leadReference: string | null;
  readonly conversationReference: string | null;
  readonly quotationReference: string | null;
  readonly projectReference: string | null;
  readonly staffRole: string;
  readonly staffDisplayName: string | null;
}

export interface KritiUntrustedCustomerContent {
  readonly messages: readonly {
    readonly id: string;
    readonly direction: "inbound" | "outbound";
    readonly body: string;
    readonly sentAt: string;
  }[];
  readonly notes: readonly string[];
}

export interface KritiContext {
  readonly taskType: KritiTaskType;
  readonly trustedPolicy: KritiTrustedPolicyContext;
  readonly authorizedBusiness: KritiAuthorizedBusinessContext;
  readonly untrustedCustomer: KritiUntrustedCustomerContent;
  readonly supplementalFacts: readonly string[];
}

export interface KritiRequest {
  readonly requestId: string;
  readonly taskType: KritiTaskType;
  readonly context: KritiContext;
  readonly requestedAt: string;
}
