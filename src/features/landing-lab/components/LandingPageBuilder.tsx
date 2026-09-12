"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LANDING_BLOCK_TYPES,
  LANDING_MAX_BLOCKS,
  explainBlockRemovalBlocked,
  reportLandingPageBlockValidation,
  validateLandingPageBlocks,
  type LandingBlock,
  type LandingBlockType,
} from "../contracts/blocks.ts";
import {
  LANDING_BLOCK_DESCRIPTIONS,
  LANDING_BLOCK_LABELS,
  createLandingBlock,
  duplicateLandingBlock,
  moveLandingBlock,
} from "../domain/block-factory.ts";
import { BlockInspector } from "./BlockInspector.tsx";
import { LandingPageBody } from "../public/LandingPageBody.tsx";
import { LandingActionProvider } from "../public/LandingCta.tsx";
import "./landing-builder.css";

/**
 * The no-code landing page builder.
 *
 * WHAT REPLACED WHAT.
 *
 * The previous authoring surface was a 16-row textarea labelled "Structured
 * blocks JSON", beside a three-column shell that was entirely inert — palette
 * buttons with no handlers, an outline whose selection was hard-coded to
 * `blocks[0]`, and an editor that printed a one-line summary of the selected
 * block. Everything here is the working version of that: the palette adds, the
 * outline selects and reorders, the inspector edits real fields, and the centre
 * shows the actual published components.
 *
 * WHY THE PREVIEW IS THE REAL COMPONENTS.
 *
 * `LandingPageBody` is the same tree `/lp/<slug>` renders, at a fixed frame
 * width, so the mobile preview runs the page's genuine mobile CSS rather than
 * a scaled-down approximation. What the author approves is what publishes.
 *
 * The preview is deliberately inert in three specific ways: no exposure is
 * recorded, the enquiry CTA cannot open the real form (`LandingActionProvider`
 * is given a `null` opener), and no Meta event can fire because none of that
 * code is mounted here at all.
 *
 * WHY SAVING IS EXPLICIT.
 *
 * Versions carry a `lockVersion` and the server rejects a stale one. Autosave
 * against an optimistic lock means a background request can fail while the
 * author is mid-sentence, with nothing sensible to do about it. An explicit
 * Save, a visible dirty marker, and a browser warning on unload are honest
 * about when work is and is not stored.
 */

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: ReadonlyArray<{
  id: Viewport;
  label: string;
  width: string;
  px: number;
}> = [
  { id: "mobile", label: "Mobile", width: "390px", px: 390 },
  { id: "tablet", label: "Tablet", width: "768px", px: 768 },
  { id: "desktop", label: "Desktop", width: "1280px", px: 1280 },
];

export interface LandingPageBuilderProps {
  readonly initialBlocks: readonly LandingBlock[];
  readonly readOnly: boolean;
  readonly onBlocksChange: (blocks: readonly LandingBlock[]) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

/** A short, human line describing what a block currently says. */
function blockNote(block: LandingBlock): string {
  switch (block.type) {
    case "hero":
      return block.headline;
    case "offer_cta":
    case "lead_form_placeholder":
      return block.headline;
    case "footer":
      return block.legalLine;
    default:
      return block.title;
  }
}

export function LandingPageBuilder({
  initialBlocks,
  readOnly,
  onBlocksChange,
  onDirtyChange,
}: LandingPageBuilderProps) {
  const [blocks, setBlocks] = useState<readonly LandingBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialBlocks[0]?.blockId ?? null
  );
  const [viewport, setViewport] = useState<Viewport>("desktop");

  /*
   * The preview renders at its REAL width and is scaled to fit.
   *
   * The alternative — letting the frame shrink to whatever the middle column
   * happens to be — meant the control labelled "Desktop 1280px" was showing a
   * 490px layout, so the author was approving the tablet rules while reading
   * the word Desktop. Here the frame is genuinely 1280px wide, runs the CSS a
   * 1280px browser would run, and is then scaled down visually. The label
   * tells the truth and the layout is the real one.
   */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  /*
   * A scaled element still occupies its UNSCALED height in layout, so the
   * stage would keep a tall empty gap below the preview. The wrapper is given
   * the scaled height instead.
   */
  const [previewHeight, setPreviewHeight] = useState(0);
  const frameWidth = VIEWPORTS.find((item) => item.id === viewport)!.px;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const available = stage.clientWidth - 32; // the stage's own padding
      setScale(available > 0 ? Math.min(1, available / frameWidth) : 1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    if (frameRef.current) observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [frameWidth]);

  // Track the frame's own height so the wrapper can reserve the scaled space.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setPreviewHeight(frame.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [blocks, viewport]);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const baseline = useMemo(() => JSON.stringify(initialBlocks), [initialBlocks]);
  const dirty = JSON.stringify(blocks) !== baseline;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  /*
   * The browser's own "leave site?" prompt.
   *
   * The only reliable protection against closing a tab with unsaved blocks.
   * It is registered only while there is something to lose, so a clean page
   * never nags.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const commit = useCallback(
    (next: readonly LandingBlock[]) => {
      setBlocks(next);
      onBlocksChange(next);
    },
    [onBlocksChange]
  );

  const report = useMemo(() => reportLandingPageBlockValidation(blocks), [blocks]);
  const errorByBlockId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of report.blockErrors) {
      if (!map.has(item.blockId)) map.set(item.blockId, item.message);
    }
    return map;
  }, [report]);

  const selected = blocks.find((block) => block.blockId === selectedId) ?? null;
  const atBlockLimit = blocks.length >= LANDING_MAX_BLOCKS;

  function addBlock(type: LandingBlockType) {
    const block = createLandingBlock(
      type,
      blocks.map((item) => item.blockId)
    );
    commit([...blocks, block]);
    setSelectedId(block.blockId);
  }

  function duplicate(blockId: string) {
    const index = blocks.findIndex((block) => block.blockId === blockId);
    if (index < 0) return;
    const copy = duplicateLandingBlock(
      blocks[index]!,
      blocks.map((block) => block.blockId)
    );
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    commit(next);
    setSelectedId(copy.blockId);
  }

  function remove(blockId: string) {
    const next = blocks.filter((block) => block.blockId !== blockId);
    commit(next);
    setPendingRemoval(null);
    // Selection follows the page rather than disappearing with the block.
    if (selectedId === blockId) setSelectedId(next[0]?.blockId ?? null);
  }

  function move(blockId: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.blockId === blockId);
    const next = moveLandingBlock(blocks, index, direction);
    if (next !== blocks) commit(next);
  }

  return (
    <div className="od-lb__grid" data-testid="landing-page-builder">
      {/* ------------------------------------------------ left: add + outline */}
      <div style={{ display: "grid", gap: 14 }}>
        <section className="od-lb__panel">
          <div className="od-lb__panel-head">
            <h2 className="od-lb__panel-title">Add a section</h2>
          </div>
          <div className="od-lb__panel-body">
            <div className="od-lb__palette" data-testid="block-palette">
              {LANDING_BLOCK_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="od-lb__add"
                  onClick={() => addBlock(type)}
                  disabled={readOnly || atBlockLimit}
                  data-add-block={type}
                >
                  <span className="od-lb__add-name">
                    {LANDING_BLOCK_LABELS[type]}
                  </span>
                  <span className="od-lb__add-desc">
                    {LANDING_BLOCK_DESCRIPTIONS[type]}
                  </span>
                </button>
              ))}
            </div>
            {atBlockLimit ? (
              <p className="od-lb__hint" style={{ marginBlockStart: 8 }}>
                This page has the maximum of {LANDING_MAX_BLOCKS} sections.
              </p>
            ) : null}
          </div>
        </section>

        <section className="od-lb__panel">
          <div className="od-lb__panel-head">
            <h2 className="od-lb__panel-title">Page outline</h2>
            <span className="od-lb__count">{blocks.length} sections</span>
          </div>
          <div className="od-lb__panel-body od-lb__scroll">
            <ol className="od-lb__outline" data-testid="page-outline">
              {blocks.map((block, index) => {
                const blocked = explainBlockRemovalBlocked(blocks, block.blockId);
                const confirming = pendingRemoval === block.blockId;
                return (
                  <li key={block.blockId}>
                    <div
                      className="od-lb__row"
                      data-selected={block.blockId === selectedId ? "true" : "false"}
                      data-invalid={errorByBlockId.has(block.blockId) ? "true" : "false"}
                    >
                      <button
                        type="button"
                        className="od-lb__pick"
                        onClick={() => setSelectedId(block.blockId)}
                        aria-current={block.blockId === selectedId}
                        data-select-block={block.blockId}
                      >
                        <span className="od-lb__pick-name">
                          {index + 1}. {LANDING_BLOCK_LABELS[block.type]}
                        </span>
                        <span className="od-lb__pick-note">{blockNote(block)}</span>
                      </button>
                      <span className="od-lb__row-tools">
                        <button
                          type="button"
                          className="od-lb__icon"
                          onClick={() => move(block.blockId, -1)}
                          disabled={readOnly || index === 0}
                          aria-label={`Move ${LANDING_BLOCK_LABELS[block.type]} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="od-lb__icon"
                          onClick={() => move(block.blockId, 1)}
                          disabled={readOnly || index === blocks.length - 1}
                          aria-label={`Move ${LANDING_BLOCK_LABELS[block.type]} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="od-lb__icon"
                          onClick={() => duplicate(block.blockId)}
                          disabled={readOnly || atBlockLimit}
                          aria-label={`Duplicate ${LANDING_BLOCK_LABELS[block.type]}`}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="od-lb__icon od-lb__icon--danger"
                          onClick={() =>
                            confirming
                              ? remove(block.blockId)
                              : setPendingRemoval(block.blockId)
                          }
                          disabled={readOnly || Boolean(blocked)}
                          title={blocked ?? undefined}
                          aria-label={
                            confirming
                              ? `Confirm removing ${LANDING_BLOCK_LABELS[block.type]}`
                              : `Remove ${LANDING_BLOCK_LABELS[block.type]}`
                          }
                          data-remove-block={block.blockId}
                        >
                          {confirming ? "✓" : "✕"}
                        </button>
                      </span>
                    </div>
                    {confirming ? (
                      <p className="od-lb__notice" style={{ marginBlockStart: 6 }}>
                        Remove this section? Click the tick to confirm.{" "}
                        <button
                          type="button"
                          className="od-lb__btn od-lb__btn--tiny"
                          onClick={() => setPendingRemoval(null)}
                        >
                          Cancel
                        </button>
                      </p>
                    ) : null}
                    {blocked ? (
                      <p className="od-lb__hint" style={{ marginBlockStart: 4 }}>
                        {blocked}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------- centre: preview */}
      <section className="od-lb__panel">
        <div className="od-lb__preview-head">
          <h2 className="od-lb__panel-title">
            Preview
            <span className="od-lb__count" style={{ marginInlineStart: 8 }}>
              {VIEWPORTS.find((item) => item.id === viewport)?.width}
            </span>
          </h2>
          <div className="od-lb__viewports" role="group" aria-label="Preview width">
            {VIEWPORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="od-lb__vp"
                aria-pressed={viewport === item.id}
                onClick={() => setViewport(item.id)}
                data-viewport-button={item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="od-lb__stage" ref={stageRef}>
          <div
            className="od-lb__fit"
            /*
             * `previewHeight > 0` matters: it starts at 0, and applying
             * `height: 0` before the first measurement hid the frame inside an
             * `overflow: hidden` wrapper — after which it could never be
             * measured, so the preview stayed collapsed forever.
             */
            style={{
              height: previewHeight > 0
                ? `${Math.round(previewHeight * scale)}px`
                : undefined,
            }}
          >
          <div
            className="od-lb__frame"
            data-viewport={viewport}
            ref={frameRef}
            style={{
              width: `${frameWidth}px`,
              transform: `translateX(-50%) scale(${scale})`,
            }}
          >
            {/*
              `openForm: null` is the guarantee that the preview cannot create
              a lead. The CTA renders, is visibly present, and does nothing.
            */}
            <LandingActionProvider mode="preview" openForm={null}>
              {/*
                Click-to-select by event delegation, NOT by wrapping each
                section in a button.

                Wrapping would put the page's own links and CTA buttons inside
                a button — invalid HTML and an accessibility fault — and would
                also break the layout, since `.lp-page` is a full-page shell
                and there must be exactly one of it. One handler on the
                container reads `closest('[data-lp-block-id]')` instead, so the
                preview stays the real page with no extra DOM in it.

                This is an enhancement, not the only route: the outline beside
                it is a proper list of buttons and is the keyboard path, which
                is why this div needs no role or tabindex of its own.
              */}
              <div
                data-public-dark-theme=""
                data-preview-surface=""
                onClick={(event) => {
                  const host = (event.target as HTMLElement).closest(
                    "[data-lp-block-id]"
                  );
                  const id = host?.getAttribute("data-lp-block-id");
                  if (id) setSelectedId(id);
                }}
              >
                <LandingPageBody blocks={blocks} selectedBlockId={selectedId} />
              </div>
            </LandingActionProvider>
          </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- right: inspector */}
      <section className="od-lb__panel">
        <div className="od-lb__panel-head">
          <h2 className="od-lb__panel-title">Section settings</h2>
          {dirty ? <span className="od-lb__pill od-lb__pill--dirty">Unsaved</span> : null}
        </div>
        <div className="od-lb__panel-body od-lb__scroll">
          {report.pageErrors.length > 0 ? (
            <div style={{ marginBlockEnd: 12 }}>
              {report.pageErrors.map((message) => (
                <p className="od-lb__error" key={message}>
                  {message}
                </p>
              ))}
            </div>
          ) : null}
          {selected ? (
            <BlockInspector
              block={selected}
              readOnly={readOnly}
              error={errorByBlockId.get(selected.blockId) ?? null}
              onChange={(next) =>
                commit(
                  blocks.map((block) =>
                    block.blockId === next.blockId ? next : block
                  )
                )
              }
            />
          ) : (
            <p className="od-lb__empty">
              Choose a section from the outline, or click one in the preview.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/** The page-level validity used to gate saving, shared with the workspace. */
export function landingBlocksError(blocks: readonly LandingBlock[]): string | null {
  return validateLandingPageBlocks(blocks);
}
