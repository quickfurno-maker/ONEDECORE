"use client";

import { useMemo, useState } from "react";
import type { LandingPageWorkspace } from "../server/landing-queries.ts";

/**
 * The A/B experiment editor.
 *
 * WHAT IT REPLACED.
 *
 * The second raw-JSON textarea in this workspace: an eight-row box in which
 * the owner was expected to hand-write `landing_page_version_id` UUIDs and
 * snake_case keys, with allocations that had to total exactly 100 and versions
 * that had to already be frozen — none of which the box said, and all of which
 * the database enforces by rejecting the save.
 *
 * WHY IT VALIDATES IN THE BROWSER AS WELL AS THE DATABASE.
 *
 * The rules live in Postgres and stay there; this is not a second enforcement
 * point and deliberately does not re-implement them. It surfaces the same
 * constraints BEFORE the round trip, because a rejection that arrives as
 * "LANDING_EXPERIMENT_INVALID" cannot tell an owner that their split came to
 * 90. The server still decides; this only makes the decision predictable.
 */

export interface ExperimentEditorProps {
  readonly workspace: LandingPageWorkspace;
  readonly publicationId: string;
  readonly experimentId: string;
  readonly disabled?: boolean;
}

interface VariantRow {
  variant_key: string;
  landing_page_version_id: string;
  allocation_percent: number;
  label: string;
}

export function ExperimentEditor({
  workspace,
  publicationId,
  experimentId,
  disabled,
}: ExperimentEditorProps) {
  /*
   * Only frozen versions may be bound to a variant.
   *
   * `validateLandingPublicationBinding` requires it, and for a good reason: a
   * draft can still change under a running experiment, which would silently
   * alter what half the visitors saw partway through.
   */
  const frozen = useMemo(
    () => workspace.versions.filter((version) => version.frozenAt != null),
    [workspace.versions]
  );

  const existing = workspace.experiments.find((item) => item.id === experimentId);

  const [variants, setVariants] = useState<VariantRow[]>(() => {
    if (existing) {
      return existing.variants.map((variant) => ({
        variant_key: variant.variantKey,
        landing_page_version_id: variant.versionId,
        allocation_percent: variant.allocationPercent,
        label: variant.label,
      }));
    }
    const publication = workspace.publications.find((item) => item.id === publicationId);
    const control = publication?.versionId ?? frozen[0]?.id ?? "";
    const other = frozen.find((version) => version.id !== control)?.id ?? "";
    return [
      {
        variant_key: "control",
        landing_page_version_id: control,
        allocation_percent: 50,
        label: "Control",
      },
      {
        variant_key: "variant-b",
        landing_page_version_id: other,
        allocation_percent: 50,
        label: "B",
      },
    ];
  });

  const total = variants.reduce(
    (sum, variant) => sum + (Number(variant.allocation_percent) || 0),
    0
  );
  const missingVersion = variants.some((variant) => !variant.landing_page_version_id);
  const duplicateVersion =
    new Set(variants.map((variant) => variant.landing_page_version_id)).size !==
    variants.length;

  const problems: string[] = [];
  if (frozen.length < 2) {
    problems.push(
      "An A/B test needs two frozen versions. Freeze the current draft, create the next version, change something, and freeze that too."
    );
  }
  if (total !== 100) {
    problems.push(`The split must total 100%. It currently totals ${total}%.`);
  }
  if (missingVersion) problems.push("Every variant needs a version.");
  if (duplicateVersion) {
    problems.push(
      "Two variants point at the same version, so the test could not tell them apart."
    );
  }

  const update = (index: number, patch: Partial<VariantRow>) =>
    setVariants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );

  return (
    <div data-testid="experiment-editor">
      {/* The action posts this; the owner never sees or edits it. */}
      <input type="hidden" name="publicationId" value={publicationId} />
      <input type="hidden" name="experimentId" value={experimentId} />
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />

      <p className="od-lb__section-note">
        Visitors are split between versions and stay on whichever they were
        first shown. The winner is always chosen by a person — nothing is
        promoted automatically.
      </p>

      <ul className="od-lb__items">
        {variants.map((variant, index) => (
          // eslint-disable-next-line react/no-array-index-key -- position is identity
          <li className="od-lb__item" key={index}>
            <div className="od-lb__item-head">
              <span className="od-lb__item-n">
                {index === 0 ? "Control" : `Variant ${index + 1}`}
              </span>
              {variants.length > 2 ? (
                <button
                  type="button"
                  className="od-lb__icon od-lb__icon--danger"
                  disabled={disabled}
                  onClick={() =>
                    setVariants((rows) => rows.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove variant ${index + 1}`}
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div className="od-lb__field">
              <label className="od-lb__label">
                <span>Name</span>
              </label>
              <input
                className="od-lb__input"
                value={variant.label}
                disabled={disabled}
                onChange={(event) => update(index, { label: event.target.value })}
              />
            </div>

            <div className="od-lb__field">
              <label className="od-lb__label">
                <span>Shows this version</span>
              </label>
              <select
                className="od-lb__select"
                value={variant.landing_page_version_id}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { landing_page_version_id: event.target.value })
                }
              >
                <option value="">Choose a frozen version…</option>
                {frozen.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber} — {version.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="od-lb__field">
              <label className="od-lb__label">
                <span>Share of visitors</span>
                <span className="od-lb__count">{variant.allocation_percent}%</span>
              </label>
              <input
                className="od-lb__input"
                type="number"
                min={1}
                max={99}
                step={1}
                value={variant.allocation_percent}
                disabled={disabled}
                onChange={(event) =>
                  update(index, {
                    allocation_percent: Number(event.target.value) || 0,
                  })
                }
              />
            </div>
          </li>
        ))}
      </ul>

      {variants.length < 3 ? (
        <button
          type="button"
          className="od-lb__btn od-lb__btn--tiny"
          disabled={disabled}
          onClick={() =>
            setVariants((rows) => [
              ...rows,
              {
                variant_key: `variant-${String.fromCharCode(98 + rows.length)}`,
                landing_page_version_id: "",
                allocation_percent: 0,
                label: `Variant ${rows.length + 1}`,
              },
            ])
          }
        >
          + Add a third variant
        </button>
      ) : null}

      {problems.map((problem) => (
        <p className="od-lb__error" key={problem} style={{ marginBlockStart: 8 }}>
          {problem}
        </p>
      ))}

      <button
        className="od-lb__btn od-lb__btn--primary"
        style={{ marginBlockStart: 10 }}
        disabled={disabled || problems.length > 0}
        data-testid="save-experiment"
      >
        Save test
      </button>
    </div>
  );
}
