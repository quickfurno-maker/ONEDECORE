"use client";

import {
  LANDING_ITEM_LIMITS,
  LANDING_TEXT_LIMITS,
  type LandingBlock,
} from "../contracts/blocks.ts";
import { LANDING_BLOCK_LABELS } from "../domain/block-factory.ts";
import { RepeatableList, TextField, UrlField } from "./BuilderFields.tsx";

/**
 * Real controls for every field of every block type.
 *
 * This replaces the "Structured blocks JSON" textarea. The owner is never
 * required to know the schema, the block ids, or that the blocks are JSON at
 * all — which was the single largest gap between the Landing Lab engine and a
 * product someone could actually use.
 *
 * WHY EVERY EDIT REPLACES THE WHOLE BLOCK.
 *
 * The contract types every field `readonly`, so there is no in-place mutation
 * to make. Each change spreads the previous block into a new one. That is also
 * what makes undo-by-discard and the dirty check trivial: two blocks are
 * different if and only if their serialisations differ.
 *
 * WHY EMPTY OPTIONAL FIELDS BECOME `null`, NOT `""`.
 *
 * The contract types optional fields `string | null` and treats an empty
 * string as absent. Writing `""` into the saved JSON would persist a field
 * that means nothing, and `""` and `null` would render identically while
 * comparing as different — a dirty indicator that lights up when an author
 * clicks into a field and back out again.
 */

/** Empty input means the field is absent. */
const orNull = (value: string): string | null =>
  value.trim().length === 0 ? null : value;

export function BlockInspector({
  block,
  onChange,
  readOnly,
  error,
}: {
  readonly block: LandingBlock;
  readonly onChange: (block: LandingBlock) => void;
  readonly readOnly?: boolean;
  readonly error?: string | null;
}) {
  const disabled = Boolean(readOnly);
  const heading = LANDING_BLOCK_LABELS[block.type];

  function renderFields() {
    switch (block.type) {
      case "hero":
        return (
          <>
            <TextField
              label="Headline"
              value={block.headline}
              limit={LANDING_TEXT_LIMITS.medium}
              required
              disabled={disabled}
              hint="The first thing a visitor reads. Say what this page is about."
              onChange={(headline) => onChange({ ...block, headline })}
            />
            <TextField
              label="Supporting line"
              value={block.subheadline ?? ""}
              limit={LANDING_TEXT_LIMITS.medium}
              multiline
              disabled={disabled}
              onChange={(value) => onChange({ ...block, subheadline: orNull(value) })}
            />
            <TextField
              label="Button label"
              value={block.primaryCtaLabel}
              required
              disabled={disabled}
              onChange={(primaryCtaLabel) => onChange({ ...block, primaryCtaLabel })}
            />
            <UrlField
              label="Button goes to"
              value={block.primaryCtaUrl ?? ""}
              disabled={disabled}
              emptyBehaviour="Leave blank to open the ONEDECORE enquiry form. That is usually what you want."
              onChange={(value) => onChange({ ...block, primaryCtaUrl: orNull(value) })}
            />
            <UrlField
              label="Background image"
              value={block.imageUrl ?? ""}
              disabled={disabled}
              emptyBehaviour="No image — the hero uses a plain dark background."
              onChange={(value) => onChange({ ...block, imageUrl: orNull(value) })}
            />
          </>
        );

      case "trust_proof":
        return (
          <>
            <TextField
              label="Section title"
              value={block.title}
              required
              disabled={disabled}
              onChange={(title) => onChange({ ...block, title })}
            />
            <RepeatableList
              items={block.items}
              limit={LANDING_ITEM_LIMITS.default}
              itemNoun="Point"
              disabled={disabled}
              note="Only state things you can stand behind. Ratings, client counts and warranty lengths are not currently approved for publication."
              create={() => ({ label: "Label", value: "Add a short, factual point" })}
              onChange={(items) => onChange({ ...block, items })}
              renderItem={(item, update) => (
                <>
                  <TextField
                    label="Label"
                    value={item.label}
                    required
                    disabled={disabled}
                    onChange={(label) => update({ ...item, label })}
                  />
                  <TextField
                    label="Value"
                    value={item.value}
                    required
                    disabled={disabled}
                    onChange={(value) => update({ ...item, value })}
                  />
                </>
              )}
            />
          </>
        );

      case "service_highlights":
        return (
          <>
            <TextField
              label="Section title"
              value={block.title}
              required
              disabled={disabled}
              onChange={(title) => onChange({ ...block, title })}
            />
            <RepeatableList
              items={block.items}
              limit={LANDING_ITEM_LIMITS.default}
              itemNoun="Service"
              disabled={disabled}
              create={() => ({
                title: "Add a service",
                description: "Describe what this covers, in one or two lines.",
                iconLabel: null,
              })}
              onChange={(items) => onChange({ ...block, items })}
              renderItem={(item, update) => (
                <>
                  <TextField
                    label="Title"
                    value={item.title}
                    required
                    disabled={disabled}
                    onChange={(title) => update({ ...item, title })}
                  />
                  <TextField
                    label="Description"
                    value={item.description}
                    limit={LANDING_TEXT_LIMITS.medium}
                    multiline
                    required
                    disabled={disabled}
                    onChange={(description) => update({ ...item, description })}
                  />
                  <TextField
                    label="Small tag"
                    value={item.iconLabel ?? ""}
                    disabled={disabled}
                    hint="A short word shown above the title, like “Design”. Optional."
                    onChange={(value) => update({ ...item, iconLabel: orNull(value) })}
                  />
                </>
              )}
            />
          </>
        );

      case "process":
        return (
          <>
            <TextField
              label="Section title"
              value={block.title}
              required
              disabled={disabled}
              onChange={(title) => onChange({ ...block, title })}
            />
            <RepeatableList
              items={block.steps}
              limit={LANDING_ITEM_LIMITS.default}
              itemNoun="Step"
              disabled={disabled}
              note="Steps are numbered automatically in the order shown here."
              create={() => ({
                title: "Add a step",
                description: "Describe what happens at this stage.",
              })}
              onChange={(steps) => onChange({ ...block, steps })}
              renderItem={(step, update) => (
                <>
                  <TextField
                    label="Step title"
                    value={step.title}
                    required
                    disabled={disabled}
                    onChange={(title) => update({ ...step, title })}
                  />
                  <TextField
                    label="What happens"
                    value={step.description}
                    limit={LANDING_TEXT_LIMITS.medium}
                    multiline
                    required
                    disabled={disabled}
                    onChange={(description) => update({ ...step, description })}
                  />
                </>
              )}
            />
          </>
        );

      case "portfolio_preview":
        return (
          <>
            <TextField
              label="Section title"
              value={block.title}
              required
              disabled={disabled}
              onChange={(title) => onChange({ ...block, title })}
            />
            <RepeatableList
              items={block.projectSlugs}
              limit={LANDING_ITEM_LIMITS.default}
              itemNoun="Project"
              disabled={disabled}
              note="Use the web address of a published project — the part of /portfolio/… after the last slash. Projects that are no longer published are quietly left out rather than shown as broken."
              create={() => "replace-with-a-published-project"}
              onChange={(projectSlugs) => onChange({ ...block, projectSlugs })}
              renderItem={(slug, update) => (
                <TextField
                  label="Project address"
                  value={slug}
                  required
                  disabled={disabled}
                  hint="Lowercase letters, numbers and hyphens only."
                  onChange={update}
                />
              )}
            />
            <TextField
              label="Link label"
              value={block.ctaLabel ?? ""}
              disabled={disabled}
              hint="Leave blank for no link under the projects."
              onChange={(value) => onChange({ ...block, ctaLabel: orNull(value) })}
            />
            <UrlField
              label="Link goes to"
              value={block.ctaUrl ?? ""}
              disabled={disabled}
              emptyBehaviour="Opens the ONEDECORE enquiry form."
              onChange={(value) => onChange({ ...block, ctaUrl: orNull(value) })}
            />
          </>
        );

      case "testimonials":
        return (
          <>
            <TextField
              label="Section title"
              value={block.title}
              required
              disabled={disabled}
              onChange={(title) => onChange({ ...block, title })}
            />
            <RepeatableList
              items={block.items}
              limit={LANDING_ITEM_LIMITS.default}
              itemNoun="Quote"
              disabled={disabled}
              note="Publish only quotes you actually received and have permission to use. No star ratings or scores are shown — those are not currently approved for publication."
              create={() => ({
                quote: "Replace this with a real quote you have permission to use.",
                author: "Client name",
                role: null,
              })}
              onChange={(items) => onChange({ ...block, items })}
              renderItem={(item, update) => (
                <>
                  <TextField
                    label="Quote"
                    value={item.quote}
                    limit={LANDING_TEXT_LIMITS.long}
                    multiline
                    required
                    disabled={disabled}
                    onChange={(quote) => update({ ...item, quote })}
                  />
                  <TextField
                    label="Who said it"
                    value={item.author}
                    required
                    disabled={disabled}
                    onChange={(author) => update({ ...item, author })}
                  />
                  <TextField
                    label="Their role or location"
                    value={item.role ?? ""}
                    disabled={disabled}
                    onChange={(value) => update({ ...item, role: orNull(value) })}
                  />
                </>
              )}
            />
          </>
        );

      case "faq":
        return (
          <>
            <TextField
              label="Section title"
              value={block.title}
              required
              disabled={disabled}
              onChange={(title) => onChange({ ...block, title })}
            />
            <RepeatableList
              items={block.items}
              limit={LANDING_ITEM_LIMITS.faq}
              itemNoun="Question"
              disabled={disabled}
              create={() => ({
                question: "Add a question people actually ask",
                answer: "Answer it plainly, in a sentence or two.",
              })}
              onChange={(items) => onChange({ ...block, items })}
              renderItem={(item, update) => (
                <>
                  <TextField
                    label="Question"
                    value={item.question}
                    limit={LANDING_TEXT_LIMITS.medium}
                    required
                    disabled={disabled}
                    onChange={(question) => update({ ...item, question })}
                  />
                  <TextField
                    label="Answer"
                    value={item.answer}
                    limit={LANDING_TEXT_LIMITS.long}
                    multiline
                    required
                    disabled={disabled}
                    onChange={(answer) => update({ ...item, answer })}
                  />
                </>
              )}
            />
          </>
        );

      case "offer_cta":
        return (
          <>
            <TextField
              label="Headline"
              value={block.headline}
              limit={LANDING_TEXT_LIMITS.medium}
              required
              disabled={disabled}
              onChange={(headline) => onChange({ ...block, headline })}
            />
            <TextField
              label="Body"
              value={block.body}
              limit={LANDING_TEXT_LIMITS.long}
              multiline
              required
              disabled={disabled}
              onChange={(body) => onChange({ ...block, body })}
            />
            <TextField
              label="Button label"
              value={block.ctaLabel}
              required
              disabled={disabled}
              onChange={(ctaLabel) => onChange({ ...block, ctaLabel })}
            />
            <UrlField
              label="Button goes to"
              value={block.ctaUrl ?? ""}
              disabled={disabled}
              emptyBehaviour="Leave blank to open the ONEDECORE enquiry form."
              onChange={(value) => onChange({ ...block, ctaUrl: orNull(value) })}
            />
          </>
        );

      case "lead_form_placeholder":
        return (
          <>
            <p className="od-lb__notice">
              This section opens the standard ONEDECORE enquiry form. The
              questions it asks are the same everywhere on the site and cannot
              be changed per page — that is what keeps every lead comparable in
              the CRM.
            </p>
            <TextField
              label="Headline"
              value={block.headline}
              limit={LANDING_TEXT_LIMITS.medium}
              required
              disabled={disabled}
              onChange={(headline) => onChange({ ...block, headline })}
            />
            <TextField
              label="Supporting line"
              value={block.helperText ?? ""}
              limit={LANDING_TEXT_LIMITS.medium}
              multiline
              disabled={disabled}
              onChange={(value) => onChange({ ...block, helperText: orNull(value) })}
            />
            <TextField
              label="Button label"
              value={block.submitLabel}
              required
              disabled={disabled}
              hint="Also used for the button that follows the visitor down the page on phones."
              onChange={(submitLabel) => onChange({ ...block, submitLabel })}
            />
          </>
        );

      case "footer":
        return (
          <>
            <TextField
              label="Legal line"
              value={block.legalLine}
              limit={LANDING_TEXT_LIMITS.medium}
              multiline
              required
              disabled={disabled}
              onChange={(legalLine) => onChange({ ...block, legalLine })}
            />
            <TextField
              label="Email"
              value={block.contactEmail ?? ""}
              disabled={disabled}
              hint="Shown as a link people can tap to write to you."
              onChange={(value) => onChange({ ...block, contactEmail: orNull(value) })}
            />
            <TextField
              label="Phone"
              value={block.contactPhone ?? ""}
              disabled={disabled}
              hint="Shown as a link people can tap to call."
              onChange={(value) => onChange({ ...block, contactPhone: orNull(value) })}
            />
          </>
        );

      default: {
        const never: never = block;
        void never;
        return null;
      }
    }
  }

  return (
    <div data-testid="block-inspector" data-block-type={block.type}>
      <p className="od-lb__section-note">
        <strong>{heading}</strong>
      </p>
      {error ? <p className="od-lb__error">{error}</p> : null}
      {disabled ? (
        <p className="od-lb__notice">
          This version is frozen, so it cannot be edited. Use “Create next
          version” to continue working.
        </p>
      ) : null}
      {renderFields()}
    </div>
  );
}
