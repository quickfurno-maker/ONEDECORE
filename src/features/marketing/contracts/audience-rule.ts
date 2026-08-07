/**
 * Phase 9 migration-independent — audience rule AST contracts.
 */

export const AUDIENCE_RULE_OPERATORS = [
  "equals",
  "not_equals",
  "in",
  "not_in",
] as const;

export type AudienceRuleOperator = (typeof AUDIENCE_RULE_OPERATORS)[number];

export const AUDIENCE_RULE_FIELDS = [
  "lead_source",
  "lead_stage",
  "service_interest",
  "locality",
] as const;

export type AudienceRuleField = (typeof AUDIENCE_RULE_FIELDS)[number];

export interface AudienceRule {
  readonly field: AudienceRuleField;
  readonly operator: AudienceRuleOperator;
  readonly values: readonly string[];
}

export interface AudienceRuleGroup {
  readonly logic: "and" | "or";
  readonly rules: readonly AudienceRule[];
}

export interface AudienceVersion {
  readonly audienceVersionId: string;
  readonly ruleGroup: AudienceRuleGroup;
  readonly ruleHash: string;
  readonly frozenAt: string;
  readonly frozenByProfileId: string;
}

export type AudienceRuleHash = string & { readonly __brand: "AudienceRuleHash" };
