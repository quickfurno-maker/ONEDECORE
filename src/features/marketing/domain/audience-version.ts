/**
 * Phase 9A migration-independent — immutable audience version helpers.
 */

import type { AudienceRuleGroup, AudienceVersion } from "../contracts/audience-rule.ts";
import { hashAudienceRule, validateAudienceRuleGroup } from "./audience-rule-engine.ts";

export function freezeAudienceVersion(input: {
  readonly audienceVersionId: string;
  readonly ruleGroup: AudienceRuleGroup;
  readonly frozenByProfileId: string;
  readonly frozenAt?: string;
}): AudienceVersion {
  const validationError = validateAudienceRuleGroup(input.ruleGroup);
  if (validationError) throw new Error(validationError);

  return {
    audienceVersionId: input.audienceVersionId,
    ruleGroup: input.ruleGroup,
    ruleHash: hashAudienceRule(input.ruleGroup),
    frozenAt: input.frozenAt ?? new Date().toISOString(),
    frozenByProfileId: input.frozenByProfileId,
  };
}

export function assertAudienceVersionImmutable(
  existing: AudienceVersion,
  proposed: AudienceVersion
): string | null {
  if (existing.audienceVersionId !== proposed.audienceVersionId) {
    return "Audience version id cannot change.";
  }
  if (existing.ruleHash !== proposed.ruleHash) {
    return "Frozen audience rule hash is immutable.";
  }
  if (existing.frozenAt !== proposed.frozenAt) {
    return "Frozen timestamp is immutable.";
  }
  return null;
}
