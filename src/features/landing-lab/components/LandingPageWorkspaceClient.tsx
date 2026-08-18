"use client";

import { useState } from "react";
import type { LandingPageWorkspace } from "../server/landing-queries.ts";
import {
  concludeLandingExperimentAction,
  createLandingPublicationAction,
  createNextLandingVersionAction,
  freezeLandingVersionAction,
  saveLandingDraftAction,
  saveLandingExperimentAction,
  startLandingExperimentAction,
  transitionLandingPublicationAction,
} from "../server/landing-actions.ts";
import { LandingPageEditorShell } from "./LandingPageEditorShell.tsx";
import { HumanWinnerControl } from "./HumanWinnerControl.tsx";
import { LANDING_LAB_PREBUILD_BANNER } from "../fixtures/landing-fixtures.ts";
import type { LandingExperiment } from "../contracts/page-model.ts";

interface LandingPageWorkspaceClientProps {
  readonly workspace: LandingPageWorkspace;
  readonly canManage: boolean;
  readonly canPublish: boolean;
  readonly canExperiments: boolean;
  readonly canAnalytics: boolean;
}

export function LandingPageWorkspaceClient({
  workspace,
  canManage,
  canPublish,
  canExperiments,
  canAnalytics,
}: LandingPageWorkspaceClientProps) {
  const latest = workspace.versions[0];
  const [message, setMessage] = useState("");
  const editable = latest && latest.frozenAt == null;

  async function run(action: (formData: FormData) => Promise<{ success: boolean; message: string }>, formData: FormData) {
    const result = await action(formData);
    setMessage(result.message);
  }

  const experimentForUi: LandingExperiment | null = workspace.experiments[0]
    ? {
        experimentReference: workspace.experiments[0].experimentReference,
        publicationReference:
          workspace.publications.find((pub) => pub.id === workspace.experiments[0]!.publicationId)
            ?.publicationReference ?? "",
        status: workspace.experiments[0].status,
        winnerVariantKey: workspace.experiments[0].winnerVariantKey,
        variants: workspace.experiments[0].variants.map((variant) => ({
          variantKey: variant.variantKey,
          pageReference: workspace.pageReference,
          pageVersionNumber:
            workspace.versions.find((version) => version.id === variant.versionId)?.versionNumber ?? 1,
          allocationPercent: variant.allocationPercent,
          label: variant.label,
        })),
      }
    : null;

  return (
    <div className="space-y-8">
      {message ? <p className="text-sm text-amber-200">{message}</p> : null}
      {canManage && latest ? (
        <form
          className="space-y-3 rounded border border-neutral-800 p-4"
          action={(formData) => run(editable ? saveLandingDraftAction : freezeLandingVersionAction, formData)}
        >
          <input type="hidden" name="versionId" value={latest.id} />
          <input type="hidden" name="lockVersion" value={latest.lockVersion} />
          <input type="hidden" name="versionLabel" value={latest.label} />
          <label className="block text-xs text-neutral-400">
            Title
            <input name="title" defaultValue={workspace.title} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs text-neutral-400">
            Slug
            <input name="slug" defaultValue={workspace.slug} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs text-neutral-400">
            Structured blocks JSON
            <textarea
              name="blocks"
              defaultValue={JSON.stringify(latest.blocks, null, 2)}
              rows={16}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs"
            />
          </label>
          {editable ? (
            <div className="flex gap-2">
              <button className="rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950">Save draft</button>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Frozen versions are immutable.</p>
          )}
        </form>
      ) : null}

      {canManage && latest && latest.frozenAt == null ? (
        <form action={(formData) => run(freezeLandingVersionAction, formData)}>
          <input type="hidden" name="versionId" value={latest.id} />
          <button className="rounded border border-amber-400 px-3 py-2 text-xs text-amber-200">Freeze version</button>
        </form>
      ) : null}

      {canManage && latest?.frozenAt ? (
        <form action={(formData) => run(createNextLandingVersionAction, formData)}>
          <input type="hidden" name="pageId" value={workspace.id} />
          <input type="hidden" name="sourceVersionId" value={latest.id} />
          <button className="rounded border border-neutral-600 px-3 py-2 text-xs">Create next version</button>
        </form>
      ) : null}

      {latest ? <LandingPageEditorShell version={{
        pageReference: workspace.pageReference,
        versionNumber: latest.versionNumber,
        blocks: latest.blocks,
        frozenAt: latest.frozenAt,
        label: latest.label,
      }} readOnly /> : null}

      {canPublish ? (
        <section className="space-y-3 rounded border border-neutral-800 p-4">
          <h2 className="text-sm font-medium">Publication</h2>
          <form className="flex flex-wrap gap-2" action={(formData) => run(createLandingPublicationAction, formData)}>
            <input type="hidden" name="pageId" value={workspace.id} />
            <select name="versionId" className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs">
              {workspace.versions.filter((version) => version.frozenAt).map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber}
                </option>
              ))}
            </select>
            <input name="campaignReference" placeholder="OD-C-YYYY-SEQ optional" className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs" />
            <input name="campaignVersionNumber" placeholder="1" className="w-16 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs" />
            <button className="rounded border border-neutral-600 px-3 py-1 text-xs">Create publication</button>
          </form>
          <ul className="space-y-2 text-xs">
            {workspace.publications.map((publication) => (
              <li key={publication.id} className="rounded border border-neutral-800 p-2">
                {publication.publicationReference} · {publication.status}
                {publication.campaignReference ? ` · ${publication.campaignReference}` : ""}
                <div className="mt-2 flex gap-2">
                  {(["live", "paused", "archived"] as const).map((target) => (
                    <form key={target} action={(formData) => run(transitionLandingPublicationAction, formData)}>
                      <input type="hidden" name="publicationId" value={publication.id} />
                      <input type="hidden" name="lockVersion" value={publication.lockVersion} />
                      <input type="hidden" name="targetStatus" value={target} />
                      <button className="rounded border border-neutral-700 px-2 py-1">{target}</button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canExperiments && workspace.publications[0] ? (
        <section className="space-y-3 rounded border border-neutral-800 p-4">
          <h2 className="text-sm font-medium">Experiment</h2>
          <form action={(formData) => run(saveLandingExperimentAction, formData)} className="space-y-2">
            <input type="hidden" name="publicationId" value={workspace.publications[0].id} />
            <input type="hidden" name="experimentId" value={workspace.experiments[0]?.id ?? ""} />
            <textarea
              name="variants"
              rows={8}
              className="w-full rounded border border-neutral-700 bg-neutral-950 p-2 font-mono text-xs"
              defaultValue={JSON.stringify(
                workspace.experiments[0]?.variants.map((variant) => ({
                  variant_key: variant.variantKey,
                  landing_page_version_id: variant.versionId,
                  allocation_percent: variant.allocationPercent,
                  label: variant.label,
                })) ?? [
                  {
                    variant_key: "control",
                    landing_page_version_id: workspace.publications[0].versionId,
                    allocation_percent: 50,
                    label: "Control",
                  },
                  {
                    variant_key: "variant-b",
                    landing_page_version_id: workspace.versions.find((version) => version.id !== workspace.publications[0].versionId)?.id,
                    allocation_percent: 50,
                    label: "B",
                  },
                ],
                null,
                2
              )}
            />
            <button className="rounded border border-neutral-600 px-3 py-1 text-xs">Save experiment draft</button>
          </form>
          {workspace.experiments[0]?.status === "draft" ? (
            <form action={(formData) => run(startLandingExperimentAction, formData)}>
              <input type="hidden" name="experimentId" value={workspace.experiments[0].id} />
              <button className="rounded border border-amber-400 px-3 py-1 text-xs text-amber-200">Start experiment</button>
            </form>
          ) : null}
          {experimentForUi && workspace.experiments[0]?.status === "running" ? (
            <form action={(formData) => run(concludeLandingExperimentAction, formData)}>
              <input type="hidden" name="experimentId" value={workspace.experiments[0].id} />
              <HumanWinnerControl
                experiment={experimentForUi}
                onSelectWinner={(key) => {
                  const input = document.querySelector<HTMLInputElement>("input[name=winnerVariantKey]");
                  if (input) input.value = key;
                }}
              />
              <input type="hidden" name="winnerVariantKey" defaultValue={experimentForUi.variants[0]?.variantKey ?? ""} />
              <button className="mt-2 rounded border border-amber-400 px-3 py-1 text-xs">Conclude with winner</button>
            </form>
          ) : null}
        </section>
      ) : null}

      {canAnalytics ? (
        <section className="rounded border border-neutral-800 p-4">
          <h2 className="text-sm font-medium">Analytics</h2>
          <p className="mt-1 text-xs text-neutral-500">Unique exposures and CRM-derived outcomes. No spend/CPL/ROAS.</p>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-neutral-500">
              <tr>
                <th className="p-2">Publication</th>
                <th className="p-2">Exposures</th>
                <th className="p-2">Leads</th>
                <th className="p-2">Qualified</th>
                <th className="p-2">Consultation</th>
                <th className="p-2">Proposal</th>
                <th className="p-2">Closed won</th>
              </tr>
            </thead>
            <tbody>
              {workspace.analytics.map((row) => (
                <tr key={row.publicationReference}>
                  <td className="p-2">{row.publicationReference}</td>
                  <td className="p-2">{row.exposures}</td>
                  <td className="p-2">{row.leads}</td>
                  <td className="p-2">{row.qualified}</td>
                  <td className="p-2">{row.consultationScheduled}</td>
                  <td className="p-2">{row.proposalSent}</td>
                  <td className="p-2">{row.closedWon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <p className="text-xs text-amber-200">{LANDING_LAB_PREBUILD_BANNER}</p>
    </div>
  );
}
