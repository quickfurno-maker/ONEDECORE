"use client";

import { useActionState, type ReactNode } from "react";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_SERVICE_CODES,
} from "@/features/lead-intake/planner-allowlist";
import type { CrmAssigneeDirectoryEntry } from "@/features/crm/contracts/lead-detail-dtos.ts";
import type { CrmLeadSourceOption } from "@/features/crm/contracts/lead-detail-dtos.ts";
import type {
  AssignmentRuleActionState,
  LeadAssignmentRuleSummary,
} from "@/features/crm/contracts/assignment-rule-contracts.ts";
import {
  createLeadAssignmentRuleAction,
  setLeadAssignmentRuleActiveAction,
} from "@/features/crm/server/crm-assignment-rule-actions.ts";

const INITIAL_STATE: AssignmentRuleActionState = {
  success: false,
  message: "",
};

interface AssignmentRulesPanelProps {
  readonly rules: readonly LeadAssignmentRuleSummary[];
  readonly sources: readonly CrmLeadSourceOption[];
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
}

export function AssignmentRulesPanel({
  rules,
  sources,
  assignees,
}: AssignmentRulesPanelProps) {
  const [createState, createAction, createPending] = useActionState(
    createLeadAssignmentRuleAction,
    INITIAL_STATE
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    setLeadAssignmentRuleActiveAction,
    INITIAL_STATE
  );

  const message = createState.message || toggleState.message;

  return (
    <div className="space-y-6">
      <form
        action={createAction}
        className="grid gap-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 md:grid-cols-2"
      >
        <h2 className="md:col-span-2 text-lg font-semibold text-neutral-50">
          Create assignment rule
        </h2>

        <Field label="Lead source">
          <select
            name="sourceId"
            required
            className="min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          >
            <option value="">Select source</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.displayName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assignee">
          <select
            name="targetUserId"
            required
            className="min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          >
            <option value="">Select assignee</option>
            {assignees.map((assignee) => (
              <option key={assignee.userId} value={assignee.userId}>
                {assignee.displayName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <input
            name="priority"
            type="number"
            min={1}
            required
            className="min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </Field>

        <Field label="Service (optional)">
          <select
            name="serviceCode"
            className="min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          >
            <option value="">Any service</option>
            {LEAD_SERVICE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Locality (optional)">
          <input
            name="locality"
            className="min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </Field>

        <Field label="Budget (optional)">
          <select
            name="budgetComfortCode"
            className="min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          >
            <option value="">Any budget</option>
            {LEAD_BUDGET_COMFORT_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={createPending}
            className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            {createPending ? "Creating…" : "Create rule"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="text-sm text-neutral-300" role="status">
          {message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-950/80 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Specificity</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No assignment rules configured yet.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-4 py-3 text-neutral-100">
                    {rule.sourceDisplayName ?? rule.sourceId}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {rule.targetDisplayName ?? rule.targetUserId}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {[rule.serviceCode, rule.localityNormalized, rule.budgetComfortCode]
                      .filter(Boolean)
                      .join(" · ") || "Source only"}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        rule.isActive
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {rule.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={rule.isActive ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        disabled={togglePending}
                        className="text-sm text-amber-300 hover:underline"
                      >
                        {rule.isActive ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm text-neutral-300">
      <span className="font-medium text-neutral-200">{label}</span>
      {children}
    </label>
  );
}
