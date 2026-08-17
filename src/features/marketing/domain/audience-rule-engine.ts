/**
 * Phase 9 migration-independent — deterministic audience rule canonicalization and hashing.
 */

import { createHash } from "node:crypto";
import type {
  AudienceRule,
  AudienceRuleGroup,
  AudienceRuleHash,
} from "../contracts/audience-rule.ts";
import {
  AUDIENCE_RULE_FIELDS,
  AUDIENCE_RULE_OPERATORS,
} from "../contracts/audience-rule.ts";

export function canonicalizeAudienceRule(rule: AudienceRule): AudienceRule {
  return {
    field: rule.field,
    operator: rule.operator,
    values: [...rule.values].map((v) => v.trim().toLowerCase()).sort(),
  };
}

export function canonicalizeAudienceRuleGroup(
  group: AudienceRuleGroup
): AudienceRuleGroup {
  const rules = group.rules
    .map(canonicalizeAudienceRule)
    .sort((a, b) => {
      const fieldCmp = a.field.localeCompare(b.field);
      if (fieldCmp !== 0) return fieldCmp;
      const opCmp = a.operator.localeCompare(b.operator);
      if (opCmp !== 0) return opCmp;
      return a.values.join(",").localeCompare(b.values.join(","));
    });
  return { logic: group.logic, rules };
}

export function validateAudienceRule(rule: AudienceRule): string | null {
  if (!(AUDIENCE_RULE_FIELDS as readonly string[]).includes(rule.field)) {
    return `Unsupported audience rule field: ${rule.field}`;
  }
  if (!(AUDIENCE_RULE_OPERATORS as readonly string[]).includes(rule.operator)) {
    return `Unsupported audience rule operator: ${rule.operator}`;
  }
  if (rule.values.length < 1 || rule.values.length > 20) {
    return "Audience rule values must contain 1 to 20 entries.";
  }
  const canonical = rule.values.map((v) => v.trim().toLowerCase());
  if (canonical.some((value) => !value || value.length > 120)) {
    return "Audience rule values must be non-empty and at most 120 characters.";
  }
  if (new Set(canonical).size !== canonical.length) {
    return "Audience rule values must be unique after canonicalization.";
  }
  if ((rule.operator === "equals" || rule.operator === "not_equals") && canonical.length !== 1) {
    return "equals/not_equals requires exactly one value.";
  }
  return null;
}

export function validateAudienceRuleGroup(group: AudienceRuleGroup): string | null {
  if (group.rules.length < 1 || group.rules.length > 20) {
    return "Audience rule group requires 1 to 20 rules.";
  }
  for (const rule of group.rules) {
    const error = validateAudienceRule(rule);
    if (error) return error;
  }
  return null;
}

export function buildCanonicalAudienceRulePayload(group: AudienceRuleGroup): string {
  const canonical = canonicalizeAudienceRuleGroup(group);
  return JSON.stringify({
    logic: canonical.logic,
    rules: canonical.rules.map((rule) => ({
      field: rule.field,
      operator: rule.operator,
      values: rule.values,
    })),
  });
}

export function hashAudienceRule(group: AudienceRuleGroup): AudienceRuleHash {
  const payload = buildCanonicalAudienceRulePayload(group);
  const digest = createHash("sha256").update(payload, "utf8").digest("hex");
  return digest as AudienceRuleHash;
}
