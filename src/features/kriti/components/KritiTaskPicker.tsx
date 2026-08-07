"use client";

import {
  KRITI_TASK_TYPES,
  type KritiTaskType,
} from "../contracts/task-types.ts";

const TASK_LABELS: Record<KritiTaskType, string> = {
  conversation_summary: "Conversation summary",
  missing_information: "Missing information",
  objection_suggestions: "Objection suggestions",
  next_action_suggestions: "Next action suggestions",
  service_reply_draft: "Service reply draft",
  quotation_wording_draft: "Quotation wording draft",
  project_update_draft: "Project update draft",
  design_summary: "Design summary",
  campaign_copy_draft: "Campaign copy draft",
};

interface KritiTaskPickerProps {
  readonly allowedTasks?: readonly KritiTaskType[];
  readonly selectedTask: KritiTaskType | null;
  readonly disabled?: boolean;
  readonly onSelect: (task: KritiTaskType) => void;
}

export function KritiTaskPicker({
  allowedTasks = KRITI_TASK_TYPES,
  selectedTask,
  disabled = false,
  onSelect,
}: KritiTaskPickerProps) {
  return (
    <fieldset
      disabled={disabled}
      className="space-y-2 disabled:opacity-60"
      aria-label="Kriti assistance task"
    >
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Assistance type
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {allowedTasks.map((task) => (
          <label
            key={task}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-400"
          >
            <input
              type="radio"
              name="kriti-task"
              value={task}
              checked={selectedTask === task}
              onChange={() => onSelect(task)}
              className="mt-1"
            />
            <span>{TASK_LABELS[task]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
