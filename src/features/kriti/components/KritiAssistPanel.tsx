"use client";

import { useCallback, useMemo, useState } from "react";
import type { KritiHumanControlCallbacks } from "../contracts/human-control.ts";
import type { KritiRequest } from "../contracts/context.ts";
import type { KritiResult } from "../contracts/result.ts";
import type { KritiTaskType } from "../contracts/task-types.ts";
import type { KritiProviderMode } from "../contracts/provider.ts";
import {
  deriveKritiPanelStatus,
  INITIAL_KRITI_PANEL_STATE,
  type KritiPanelState,
} from "../ui/kriti-panel-state.ts";
import { buildKritiDisplayModel } from "../ui/extract-kriti-display.ts";
import { KritiDraftEditor } from "./KritiDraftEditor.tsx";
import { KritiProviderStatus } from "./KritiProviderStatus.tsx";
import { KritiResultCard } from "./KritiResultCard.tsx";
import { KritiRetryControl } from "./KritiRetryControl.tsx";
import { KritiTaskPicker } from "./KritiTaskPicker.tsx";

export interface KritiAssistPanelProps {
  readonly providerMode: KritiProviderMode;
  readonly allowedTasks?: readonly KritiTaskType[];
  readonly buildRequest: (taskType: KritiTaskType) => KritiRequest;
  readonly runTask: (request: KritiRequest) => Promise<KritiResult>;
  readonly callbacks?: KritiHumanControlCallbacks;
  readonly insertDraftLabel?: string;
}

export function KritiAssistPanel({
  providerMode,
  allowedTasks,
  buildRequest,
  runTask,
  callbacks,
  insertDraftLabel = "Insert into editor",
}: KritiAssistPanelProps) {
  const providerDisabled = providerMode === "disabled";
  const [selectedTask, setSelectedTask] = useState<KritiTaskType | null>(null);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<KritiPanelState>({
    ...INITIAL_KRITI_PANEL_STATE,
    status: providerDisabled ? "disabled" : "idle",
  });
  const [editedDraft, setEditedDraft] = useState<string | null>(null);

  const status = deriveKritiPanelStatus({
    providerDisabled,
    loading,
    result: panel.result,
  });

  const display = useMemo(() => {
    if (!panel.result?.ok) return null;
    return buildKritiDisplayModel(panel.result.suggestion);
  }, [panel.result]);

  const runSelectedTask = useCallback(async () => {
    if (!selectedTask || providerDisabled) return;
    setLoading(true);
    setPanel((prev) => ({ ...prev, result: null, error: null }));
    try {
      const request = buildRequest(selectedTask);
      const result = await runTask(request);
      setPanel({
        status: deriveKritiPanelStatus({ providerDisabled, loading: false, result }),
        selectedTask,
        result,
        error: result.ok ? null : result.error,
      });
      if (result.ok) {
        const model = buildKritiDisplayModel(result.suggestion);
        setEditedDraft(model.insertableDraft);
      }
    } finally {
      setLoading(false);
    }
  }, [buildRequest, providerDisabled, runTask, selectedTask]);

  const handleCopy = () => {
    const text = editedDraft ?? display?.primaryText;
    if (!text) return;
    callbacks?.onCopy?.(text);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }
  };

  const handleInsertDraft = () => {
    const text = editedDraft ?? display?.insertableDraft;
    if (!text) return;
    callbacks?.onInsertDraft?.(text);
  };

  const showInsert =
    Boolean(display?.insertableDraft || editedDraft) &&
    typeof callbacks?.onInsertDraft === "function";

  return (
    <section
      aria-label="Kriti assistance"
      className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/30 p-4"
    >
      <header className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-100">Kriti assist</h2>
        <KritiProviderStatus mode={providerMode} />
      </header>

      <KritiTaskPicker
        allowedTasks={allowedTasks}
        selectedTask={selectedTask}
        disabled={providerDisabled || loading}
        onSelect={setSelectedTask}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={providerDisabled || loading || !selectedTask}
          onClick={() => void runSelectedTask()}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          {loading ? "Generating…" : "Generate suggestion"}
        </button>
        <KritiRetryControl
          status={status}
          retryable={panel.error?.retryable ?? false}
          disabled={loading || !selectedTask}
          onRetry={() => void runSelectedTask()}
        />
        {callbacks?.onDismiss ? (
          <button
            type="button"
            onClick={() => callbacks.onDismiss?.()}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Dismiss
          </button>
        ) : null}
      </div>

      {loading ? (
        <p role="status" aria-live="polite" className="text-sm text-neutral-400">
          Kriti is preparing a suggestion…
        </p>
      ) : null}

      {panel.result ? <KritiResultCard result={panel.result} /> : null}

      {display?.insertableDraft || editedDraft ? (
        <KritiDraftEditor
          draftText={editedDraft ?? display?.insertableDraft ?? ""}
          onChange={setEditedDraft}
        />
      ) : null}

      {display?.primaryText || editedDraft ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Copy
          </button>
          {showInsert ? (
            <button
              type="button"
              onClick={handleInsertDraft}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {insertDraftLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
