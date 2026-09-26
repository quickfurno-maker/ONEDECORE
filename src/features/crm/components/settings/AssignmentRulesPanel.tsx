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
  CrmAutoAssignmentSetting,
  LeadAssignmentRuleSummary,
} from "@/features/crm/contracts/assignment-rule-contracts.ts";
import {
  createLeadAssignmentRuleAction,
  setCrmAutoAssignmentEnabledAction,
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
  readonly autoAssignment: CrmAutoAssignmentSetting;
}

export function AssignmentRulesPanel({
  rules,
  sources,
  assignees,
  autoAssignment,
}: AssignmentRulesPanelProps) {
  const [createState, createAction, createPending] = useActionState(
    createLeadAssignmentRuleAction,
    INITIAL_STATE
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    setLeadAssignmentRuleActiveAction,
    INITIAL_STATE
  );
  const [autoState, autoAction, autoPending] = useActionState(
    setCrmAutoAssignmentEnabledAction,
    INITIAL_STATE
  );

  const message =
    autoState.message || createState.message || toggleState.message;
  const hasEligibleSetup =
    assignees.length > 0 && rules.some((rule) => rule.isActive);

  return (
    <div className="space-y-6">
      <section className="crm-panel p-5 sm:p-6" aria-labelledby="auto-assignment-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="auto-assignment-title"
                className="text-base font-semibold text-[var(--crm-text)]"
              >
                Auto Assignment
              </h2>
              <span
                className={`crm-badge ${
                  autoAssignment.enabled
                    ? "crm-badge-success"
                    : "crm-badge-neutral"
                }`}
              >
                {autoAssignment.enabled ? "ON" : "OFF"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--crm-muted)]">
              When ON, future website leads are matched against the active rules
              below and assigned automatically. Existing leads are never changed
              by this switch.
            </p>
            <p className="mt-1 text-xs text-[var(--crm-muted)]">
              Unmatched leads stay unassigned for manual review. Assignment also
              creates the governed First Contact task when SLA applies.
            </p>
          </div>

          <div className="shrink-0">
            {autoAssignment.canManage ? (
              <form action={autoAction}>
                <input
                  type="hidden"
                  name="enabled"
                  value={autoAssignment.enabled ? "false" : "true"}
                />
                <button
                  type="submit"
                  disabled={
                    autoPending ||
                    (!autoAssignment.enabled && !hasEligibleSetup)
                  }
                  className={
                    autoAssignment.enabled
                      ? "crm-btn crm-btn-secondary"
                      : "crm-btn crm-btn-primary"
                  }
                >
                  {autoPending
                    ? "Saving…"
                    : autoAssignment.enabled
                      ? "Turn Auto Assignment OFF"
                      : "Turn Auto Assignment ON"}
                </button>
              </form>
            ) : (
              <span className="crm-badge crm-badge-neutral">
                Super Admin control
              </span>
            )}
          </div>
        </div>

        {!autoAssignment.enabled && !hasEligibleSetup ? (
          <div className="crm-inline-alert crm-inline-alert-warning mt-4">
            Add at least one active assignment rule with an eligible Sales
            Executive before turning Auto Assignment on.
          </div>
        ) : null}
      </section>

      <form
        action={createAction}
        className="crm-panel grid gap-4 p-5 sm:p-6 md:grid-cols-2"
      >
        <h2 className="md:col-span-2 text-lg font-semibold text-[var(--crm-text)]">
          Create assignment rule
        </h2>

        <Field label="Lead source">
          <select
            name="sourceId"
            required
            className="crm-input"
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
            className="crm-input"
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
            className="crm-input"
          />
        </Field>

        <Field label="Service (optional)">
          <select
            name="serviceCode"
            className="crm-input"
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
            className="crm-input"
          />
        </Field>

        <Field label="Budget (optional)">
          <select
            name="budgetComfortCode"
            className="crm-input"
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
            className="crm-btn crm-btn-primary"
          >
            {createPending ? "Creating…" : "Create rule"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="text-sm text-[var(--crm-muted)]" role="status">
          {message}
        </p>
      ) : null}

      <div className="crm-panel overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--crm-surface-muted)] text-left text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Specificity</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--crm-border)]">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--crm-muted)]">
                  No assignment rules configured yet.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-4 py-3 text-[var(--crm-text)]">
                    {rule.sourceDisplayName ?? rule.sourceId}
                  </td>
                  <td className="px-4 py-3 text-[var(--crm-text-secondary)]">
                    {rule.targetDisplayName ?? rule.targetUserId}
                  </td>
                  <td className="px-4 py-3 text-[var(--crm-muted)]">
                    {[rule.serviceCode, rule.localityNormalized, rule.budgetComfortCode]
                      .filter(Boolean)
                      .join(" · ") || "Source only"}
                  </td>
                  <td className="px-4 py-3 text-[var(--crm-text-secondary)]">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`crm-badge ${
                        rule.isActive
                          ? "crm-badge-success"
                          : "crm-badge-neutral"
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
                        className="text-sm font-medium text-[var(--crm-primary)] hover:underline"
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
    <label className="block space-y-2 text-sm text-[var(--crm-muted)]">
      <span className="font-medium text-[var(--crm-text)]">{label}</span>
      {children}
    </label>
  );
}
