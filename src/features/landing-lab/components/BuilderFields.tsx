"use client";

import { useId, type ReactNode } from "react";
import { LANDING_TEXT_LIMITS } from "../contracts/blocks.ts";

/**
 * The form primitives the block inspector is built from.
 *
 * WHY THE COUNTER MATTERS MORE THAN IT LOOKS.
 *
 * The contract rejects text over its limit, and the server throws the specific
 * message away — a save that fails returns "Structured blocks failed
 * validation." with no field named. Without a live counter an author would hit
 * a wall with no way to find the offending sentence. The limits come from
 * `LANDING_TEXT_LIMITS`, the same values the validator uses, so the count on
 * screen cannot drift from the rule being enforced.
 *
 * THE `<` AND `>` PROBLEM.
 *
 * `UNSAFE_TEXT_PATTERN` rejects any angle bracket anywhere in any text field —
 * it is a blunt anti-injection rule, and it has a false positive that real
 * marketing copy walks into constantly: "Concept > Design > Handover", or
 * "< 30 days". The raw message ("contains unsafe HTML or script patterns") is
 * baffling for that input, so these controls detect it and say what actually
 * happened.
 */

const UNSAFE_HINT =
  "Angle brackets (< and >) are not allowed in page text. Try an arrow (→) or the word instead.";

function unsafeReason(value: string): string | null {
  if (/[<>]/.test(value)) return UNSAFE_HINT;
  if (/javascript:/i.test(value)) return "The text “javascript:” is not allowed.";
  if (/on\w+\s*=/i.test(value)) {
    return "That reads as an HTML event handler (like onclick=), which is not allowed.";
  }
  return null;
}

export interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly limit?: number;
  readonly multiline?: boolean;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  limit = LANDING_TEXT_LIMITS.short,
  multiline,
  hint,
  placeholder,
  disabled,
  required,
}: TextFieldProps) {
  const id = useId();
  const length = value.trim().length;
  const over = length > limit;
  const unsafe = unsafeReason(value);
  const empty = required && length === 0;

  return (
    <div className="od-lb__field">
      <label className="od-lb__label" htmlFor={id}>
        <span>
          {label}
          {required ? " *" : ""}
        </span>
        <span className="od-lb__count" data-over={over ? "true" : "false"}>
          {length}/{limit}
        </span>
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="od-lb__textarea"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={over || Boolean(unsafe) || empty}
        />
      ) : (
        <input
          id={id}
          className="od-lb__input"
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={over || Boolean(unsafe) || empty}
        />
      )}
      {unsafe ? <p className="od-lb__error">{unsafe}</p> : null}
      {over ? (
        <p className="od-lb__error">
          {length - limit} character{length - limit === 1 ? "" : "s"} too long.
        </p>
      ) : null}
      {empty && !unsafe ? (
        <p className="od-lb__error">This is required and cannot be left empty.</p>
      ) : null}
      {hint && !unsafe && !over ? <p className="od-lb__hint">{hint}</p> : null}
    </div>
  );
}

/**
 * A URL field, with the contract's four accepted shapes explained.
 *
 * The rule is genuinely non-obvious — `mailto:`, `tel:`, `//cdn.example.com`
 * and `./page` are all rejected — so the hint states what IS allowed rather
 * than waiting for the author to guess wrong.
 */
export function UrlField({
  label,
  value,
  onChange,
  disabled,
  emptyBehaviour,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  /** What a blank value does, when blank is meaningful. */
  readonly emptyBehaviour?: string;
}) {
  const id = useId();
  const trimmed = value.trim();
  const shape =
    trimmed === ""
      ? "empty"
      : trimmed.startsWith("#")
        ? "anchor"
        : trimmed.startsWith("/")
          ? "internal"
          : /^https?:\/\/[a-zA-Z0-9]/.test(trimmed)
            ? "external"
            : "invalid";

  const explain: Record<string, string> = {
    empty: emptyBehaviour ?? "Leave blank for no link.",
    anchor: "Scrolls to that section of this page.",
    internal: "Opens this page on the ONEDECORE site.",
    external: "Opens in a new tab.",
    invalid:
      "Use a full https:// address, a path starting with / , or an #anchor. Email and phone links are not accepted here.",
  };

  return (
    <div className="od-lb__field">
      <label className="od-lb__label" htmlFor={id}>
        <span>{label}</span>
      </label>
      <input
        id={id}
        className="od-lb__input"
        type="text"
        value={value}
        disabled={disabled}
        placeholder="/portfolio, #enquiry, or https://…"
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={shape === "invalid"}
      />
      {shape === "invalid" ? (
        <p className="od-lb__error">{explain.invalid}</p>
      ) : (
        <p className="od-lb__hint">{explain[shape]}</p>
      )}
    </div>
  );
}

/** A list of repeatable items, with add / remove / reorder controls. */
export function RepeatableList<T>({
  items,
  onChange,
  create,
  limit,
  itemNoun,
  disabled,
  renderItem,
  note,
}: {
  readonly items: readonly T[];
  readonly onChange: (items: readonly T[]) => void;
  readonly create: () => T;
  readonly limit: number;
  readonly itemNoun: string;
  readonly disabled?: boolean;
  readonly note?: ReactNode;
  readonly renderItem: (item: T, update: (next: T) => void) => ReactNode;
}) {
  const atLimit = items.length >= limit;
  // The contract requires at least one item in every repeatable block.
  const atMinimum = items.length <= 1;

  const replace = (index: number, next: T) =>
    onChange(items.map((item, i) => (i === index ? next : item)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  };

  return (
    <div>
      {note ? <p className="od-lb__section-note">{note}</p> : null}
      <ul className="od-lb__items">
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key -- position IS the identity here
          <li className="od-lb__item" key={index}>
            <div className="od-lb__item-head">
              <span className="od-lb__item-n">
                {itemNoun} {index + 1}
              </span>
              <span className="od-lb__row-tools">
                <button
                  type="button"
                  className="od-lb__icon"
                  onClick={() => move(index, -1)}
                  disabled={disabled || index === 0}
                  aria-label={`Move ${itemNoun} ${index + 1} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="od-lb__icon"
                  onClick={() => move(index, 1)}
                  disabled={disabled || index === items.length - 1}
                  aria-label={`Move ${itemNoun} ${index + 1} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="od-lb__icon od-lb__icon--danger"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  disabled={disabled || atMinimum}
                  aria-label={`Remove ${itemNoun} ${index + 1}`}
                  title={
                    atMinimum
                      ? `A section needs at least one ${itemNoun.toLowerCase()}.`
                      : undefined
                  }
                >
                  ✕
                </button>
              </span>
            </div>
            {renderItem(item, (next) => replace(index, next))}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="od-lb__btn od-lb__btn--tiny"
        onClick={() => onChange([...items, create()])}
        disabled={disabled || atLimit}
        title={atLimit ? `At most ${limit} allowed in this section.` : undefined}
      >
        + Add {itemNoun.toLowerCase()}
      </button>
      {atLimit ? (
        <p className="od-lb__hint" style={{ marginBlockStart: 6 }}>
          {limit} is the maximum for this section.
        </p>
      ) : null}
    </div>
  );
}
