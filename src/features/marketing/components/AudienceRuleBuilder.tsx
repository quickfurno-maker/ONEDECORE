"use client";

import type { AudienceRuleGroup } from "../contracts/audience-rule.ts";
import { AUDIENCE_RULE_FIELDS } from "../contracts/audience-rule.ts";
import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface AudienceRuleBuilderProps {
  readonly ruleGroup: AudienceRuleGroup;
  readonly disabled?: boolean;
  readonly onAddRule: () => void;
}

export function AudienceRuleBuilder({
  ruleGroup,
  disabled = false,
  onAddRule,
}: AudienceRuleBuilderProps) {
  return (
    <section aria-label="Audience rule builder" aria-live="polite" className="space-y-4">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Audience rules</h3>
      <p className="text-xs text-neutral-400">
        Supported fields: {AUDIENCE_RULE_FIELDS.join(", ")}. Membership is evaluated at execution time.
      </p>
      <ul className="space-y-2 text-sm text-neutral-300">
        {ruleGroup.rules.map((rule, index) => (
          <li key={`${rule.field}-${index}`} className="rounded border border-neutral-800 p-2">
            {rule.field} {rule.operator} [{rule.values.join(", ")}]
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        className="rounded-md border border-neutral-600 px-3 py-2 text-sm disabled:opacity-50"
        onClick={onAddRule}
      >
        Add rule
      </button>
    </section>
  );
}
