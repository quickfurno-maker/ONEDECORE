"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { LandingPageBuilder } from "./LandingPageBuilder.tsx";
import { validateLandingPageBlocks, type LandingBlock } from "../contracts/blocks.ts";
import "./landing-builder.css";
import { HumanWinnerControl } from "./HumanWinnerControl.tsx";
import { ExperimentEditor } from "./ExperimentEditor.tsx";
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
  const router = useRouter();
  const latest = workspace.versions[0];
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const editable = Boolean(latest && latest.frozenAt == null);

  /*
   * The blocks the builder is currently showing.
   *
   * Held here rather than inside the builder because Save lives in the header
   * bar, which is outside it. The builder owns the editing; this owns the
   * round trip to the server, including the `lockVersion` the RPC checks.
   */
  const [blocks, setBlocks] = useState<readonly LandingBlock[]>(
    latest?.blocks ?? []
  );
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();

  const onBlocksChange = useCallback((next: readonly LandingBlock[]) => {
    setBlocks(next);
  }, []);

  const blocksError = validateLandingPageBlocks(blocks);

  async function run(action: (formData: FormData) => Promise<{ success: boolean; message: string }>, formData: FormData) {
    const result = await action(formData);
    setMessage(result.message);
    setOk(result.success);
  }

  /*
   * Save the draft.
   *
   * The blocks are validated here first because the server throws the specific
   * message away — `parseBlocks` returns null and the action answers
   * "Structured blocks failed validation." with no field named. Validating
   * before the round trip is the only way the author learns what is wrong.
   */
  function saveDraft() {
    if (!latest) return;
    const error = validateLandingPageBlocks(blocks);
    if (error) {
      setMessage(error);
      setOk(false);
      return;
    }
    const formData = new FormData();
    formData.set("versionId", latest.id);
    formData.set("lockVersion", String(latest.lockVersion));
    formData.set("versionLabel", latest.label);
    formData.set("title", workspace.title);
    formData.set("slug", workspace.slug);
    formData.set("blocks", JSON.stringify(blocks));
    startSaving(async () => {
      const result = await saveLandingDraftAction(formData);
      setMessage(result.message);
      setOk(result.success);
      if (result.success) {
        setDirty(false);
        /*
         * The save actions revalidate the LIST route, not this detail route,
         * so the workspace this component was given is now stale — its
         * `lockVersion` in particular. Refreshing means a second save does not
         * fail on a lock conflict the author cannot see or explain.
         */
        router.refresh();
      }
    });
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

  const liveCount = workspace.publications.filter(
    (publication) => publication.status === "live"
  ).length;

  return (
    <div className="od-lb">
      {/* ------------------------------------------------------ header bar */}
      <header className="od-lb__head">
        <div className="od-lb__identity">
          <h1 className="od-lb__title">{workspace.title}</h1>
          <p className="od-lb__sub">
            /lp/{workspace.slug} · {workspace.pageReference}
          </p>
        </div>

        <div className="od-lb__pills">
          {latest ? (
            <span
              className={`od-lb__pill ${
                editable ? "od-lb__pill--draft" : "od-lb__pill--frozen"
              }`}
            >
              v{latest.versionNumber} {editable ? "Draft" : "Frozen"}
            </span>
          ) : null}
          {liveCount > 0 ? (
            <span className="od-lb__pill od-lb__pill--live">Live</span>
          ) : null}
          {dirty ? <span className="od-lb__pill od-lb__pill--dirty">Unsaved</span> : null}
        </div>

        <div className="od-lb__actions">
          {canManage && latest && editable ? (
            <button
              type="button"
              className="od-lb__btn od-lb__btn--primary"
              onClick={saveDraft}
              disabled={saving || !dirty || Boolean(blocksError)}
              title={blocksError ?? undefined}
              data-testid="save-draft"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          ) : null}

          {canManage && latest && editable ? (
            <form
              action={(formData) => run(freezeLandingVersionAction, formData)}
              style={{ display: "contents" }}
            >
              <input type="hidden" name="versionId" value={latest.id} />
              <button
                className="od-lb__btn"
                disabled={dirty}
                title={
                  dirty
                    ? "Save your changes before freezing this version."
                    : "Freeze this version so it can be published."
                }
              >
                Freeze v{latest.versionNumber}
              </button>
            </form>
          ) : null}

          {canManage && latest && !editable ? (
            <form
              action={(formData) => run(createNextLandingVersionAction, formData)}
              style={{ display: "contents" }}
            >
              <input type="hidden" name="pageId" value={workspace.id} />
              <input type="hidden" name="sourceVersionId" value={latest.id} />
              <button className="od-lb__btn od-lb__btn--primary">
                Create next version
              </button>
            </form>
          ) : null}

          <a
            className="od-lb__btn"
            href={`/lp/${workspace.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Open live page ↗
          </a>
        </div>
      </header>

      {message ? (
        <p className={ok ? "od-lb__ok" : "od-lb__error"} role="status">
          {message}
        </p>
      ) : null}

      {blocksError && editable ? (
        <p className="od-lb__notice">{blocksError}</p>
      ) : null}

      {/* --------------------------------------------------------- builder */}
      {latest ? (
        <LandingPageBuilder
          key={latest.id}
          initialBlocks={latest.blocks}
          readOnly={!canManage || !editable}
          onBlocksChange={onBlocksChange}
          onDirtyChange={setDirty}
        />
      ) : (
        <p className="od-lb__empty">This page has no versions yet.</p>
      )}

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
            <ExperimentEditor
              workspace={workspace}
              publicationId={workspace.publications[0].id}
              experimentId={workspace.experiments[0]?.id ?? ""}
              disabled={workspace.experiments[0]?.status === "running"}
            />
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
          {/*
            Seven columns of counts cannot fit a phone, and shrinking the text
            until they do makes them unreadable. The table gets its own
            horizontal scroll instead, so the page around it never moves.
          */}
          <div className="od-lb__tablewrap">
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
          </div>
        </section>
      ) : null}
    </div>
  );
}
