"use client";

import { useState } from "react";
import type { CampaignVersionDetail } from "../server/campaign-queries";
import type { CampaignRunListItem } from "../server/campaign-queries";
import {
  cancelCampaignRunAction,
  createCampaignRunAction,
  dispatchMockCampaignExecutionAction,
  pauseCampaignRunAction,
  resumeCampaignRunAction,
} from "../server/campaign-actions";
import { resolvePaidAdsExecutionChannel, describeDeferredChannels } from "../execution/domain/paid-channel";
import { visibleRunControls } from "../execution/domain/execution-capabilities";
import type { CrmRoleCode } from "@/features/crm/contracts/permissions";
import type { CampaignRunState } from "../execution/contracts/run-lifecycle";
import type { CampaignExecutionMode } from "../execution/contracts/execution-mode";

interface CampaignExecutionPanelProps {
  readonly campaignId: string;
  readonly role: CrmRoleCode;
  readonly canExecute: boolean;
  readonly canPause: boolean;
  readonly executionMode: CampaignExecutionMode;
  readonly sharingEnabled: boolean;
  readonly versions: readonly CampaignVersionDetail[];
  readonly runs: readonly CampaignRunListItem[];
}

export function CampaignExecutionPanel({
  campaignId,
  role,
  canExecute,
  canPause,
  executionMode,
  sharingEnabled,
  versions,
  runs,
}: CampaignExecutionPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const approved = versions.filter((version) => version.status === "approved");
  const latestApproved = [...approved].sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const paid = latestApproved
    ? resolvePaidAdsExecutionChannel(latestApproved.intendedChannels)
    : null;

  return (
    <section className="space-y-4 rounded-xl border border-neutral-800 p-4">
      <h2 className="text-lg font-semibold text-neutral-100">Execution</h2>
      <div role="status" aria-live="polite" className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
        Mode: {executionMode.toUpperCase()} — No live provider writes. Production activation Phase 10.
      </div>
      {latestApproved?.targetingMode === "direct_or_custom" && !sharingEnabled ? (
        <p className="text-xs text-red-300">
          Provider export for direct/custom is disabled. MARKETING consent is not Ads sharing permission. This does not switch to broad_public.
        </p>
      ) : null}
      {paid && !paid.ok ? (
        <p className="text-sm text-red-300">{paid.message}</p>
      ) : null}
      {paid?.ok ? (
        <p className="text-sm text-neutral-300">
          Provider to execute: <strong>{paid.providerChannel}</strong>. {describeDeferredChannels(paid.deferredChannels)}
        </p>
      ) : null}
      {canExecute && latestApproved && paid?.ok ? (
        <form
          action={async (formData) => {
            const result = await createCampaignRunAction(formData);
            setMessage(result.message);
          }}
          className="flex flex-wrap gap-2"
        >
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="campaignVersionId" value={latestApproved.id} />
          <button type="submit" className="rounded bg-amber-700 px-3 py-1 text-xs text-white">
            Create/schedule mock run
          </button>
        </form>
      ) : null}
      {canExecute && executionMode === "mock" ? (
        <form
          action={async () => {
            const result = await dispatchMockCampaignExecutionAction();
            setMessage(result.message);
          }}
        >
          <button type="submit" className="rounded border border-neutral-600 px-3 py-1 text-xs text-neutral-200">
            Dispatch mock worker
          </button>
        </form>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" className="text-xs text-neutral-400">
          {message}
        </p>
      ) : null}
      <ul className="space-y-2 text-sm text-neutral-300">
        {runs.length === 0 ? <li>No runs yet.</li> : null}
        {runs.map((run) => {
          const controls = visibleRunControls(role, run.status as CampaignRunState);
          return (
            <li key={run.id} className="rounded border border-neutral-800 p-3">
              <div>
                {run.runReference} · {run.providerChannel} · {run.status}
              </div>
              <div className="text-xs text-neutral-500">
                Target {run.target?.runTargetReference ?? "n/a"} · provider object{" "}
                {run.target?.providerCampaignId ?? "unbound"} · {run.target?.providerStatus ?? "no status"}
              </div>
              <div className="text-xs text-neutral-500">
                Operations:{" "}
                {run.operations.length === 0
                  ? "none"
                  : run.operations.map((op) => `${op.operationType}:${op.operationState}`).join(", ")}
              </div>
              <div className="text-xs text-neutral-500">{describeDeferredChannels(run.deferredChannels)}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {canPause && controls.showPause ? (
                  <form
                    action={async (formData) => {
                      const result = await pauseCampaignRunAction(formData);
                      setMessage(result.message);
                    }}
                  >
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input type="hidden" name="campaignRunId" value={run.id} />
                    <button type="submit" className="text-xs text-amber-300">
                      Pause
                    </button>
                  </form>
                ) : null}
                {canPause && controls.showResume ? (
                  <form
                    action={async (formData) => {
                      const result = await resumeCampaignRunAction(formData);
                      setMessage(result.message);
                    }}
                  >
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input type="hidden" name="campaignRunId" value={run.id} />
                    <button type="submit" className="text-xs text-amber-300">
                      Resume
                    </button>
                  </form>
                ) : null}
                {controls.showCancel ? (
                  <form
                    action={async (formData) => {
                      const result = await cancelCampaignRunAction(formData);
                      setMessage(result.message);
                    }}
                  >
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input type="hidden" name="campaignRunId" value={run.id} />
                    <button type="submit" className="text-xs text-red-300">
                      Cancel
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-neutral-500">Metrics dashboard is a Phase 9C-C placeholder. Spend/feedback not implemented.</p>
    </section>
  );
}
