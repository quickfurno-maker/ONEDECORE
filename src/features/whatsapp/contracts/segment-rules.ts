/**
 * WM-3 — WhatsApp audience segment rules.
 *
 * The allowlist mirrors `private.whatsapp_segment_rule_group_valid` exactly:
 * nine lead fields, four operators, 1–20 rules ANDed together, 1–50 values for
 * a list operator. The database is still the authority; this exists so a
 * manager sees which field is wrong before a round trip, and so a rule group
 * the database would reject is never submitted.
 *
 * Matching runs against the contact's most recent live lead, in SQL. Nothing
 * here evaluates a segment.
 */

import type { Json } from "../../../types/database.ts";
import { UUID_PATTERN } from "./control-plane.ts";

export const WHATSAPP_SEGMENT_RULE_FIELDS = [
  "lead_stage",
  "service_interest",
  "property_code",
  "locality",
  "budget_range",
  "assigned_to",
  "sales_temperature",
  "source",
  "received_date",
] as const;

export type WhatsappSegmentRuleField = (typeof WHATSAPP_SEGMENT_RULE_FIELDS)[number];

export const WHATSAPP_SEGMENT_RULE_OPS = ["equals", "not_equals", "in", "not_in"] as const;

export type WhatsappSegmentRuleOp = (typeof WHATSAPP_SEGMENT_RULE_OPS)[number];

export const WHATSAPP_SEGMENT_FIELD_META: Readonly<
  Record<WhatsappSegmentRuleField, { readonly label: string; readonly hint: string }>
> = {
  lead_stage: { label: "Lead stage", hint: "e.g. qualified" },
  service_interest: { label: "Service interest", hint: "service code" },
  property_code: { label: "Property type", hint: "property code" },
  locality: { label: "Locality", hint: "e.g. Whitefield" },
  budget_range: { label: "Budget range", hint: "budget comfort code" },
  assigned_to: { label: "Assigned to", hint: "staff profile id" },
  sales_temperature: { label: "Sales temperature", hint: "e.g. hot" },
  source: { label: "Lead source", hint: "e.g. website" },
  received_date: { label: "Received date (IST)", hint: "YYYY-MM-DD" },
};

export const WHATSAPP_SEGMENT_OP_LABELS: Readonly<Record<WhatsappSegmentRuleOp, string>> = {
  equals: "is",
  not_equals: "is not",
  in: "is one of",
  not_in: "is none of",
};

export const WHATSAPP_SEGMENT_MAX_RULES = 20;
export const WHATSAPP_SEGMENT_MAX_LIST_VALUES = 50;
export const WHATSAPP_SEGMENT_MAX_VALUE_LENGTH = 120;
/** Below the 8192-byte `pg_column_size` check, with room for jsonb overhead. */
export const WHATSAPP_SEGMENT_MAX_RULE_BYTES = 6000;

export interface WhatsappSegmentRuleDraft {
  readonly field: string;
  readonly op: string;
  /** For list operators, comma-separated. */
  readonly value: string;
}

export interface WhatsappSegmentRule {
  readonly field: WhatsappSegmentRuleField;
  readonly op: WhatsappSegmentRuleOp;
  readonly value: string | readonly string[];
}

export interface WhatsappSegmentRuleGroup {
  readonly rules: readonly WhatsappSegmentRule[];
}

export function isWhatsappSegmentRuleField(value: string): value is WhatsappSegmentRuleField {
  return (WHATSAPP_SEGMENT_RULE_FIELDS as readonly string[]).includes(value);
}

export function isWhatsappSegmentRuleOp(value: string): value is WhatsappSegmentRuleOp {
  return (WHATSAPP_SEGMENT_RULE_OPS as readonly string[]).includes(value);
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function valueProblem(field: WhatsappSegmentRuleField, value: string): string | null {
  if (value.length === 0) return "a value is required";
  if (value.length > WHATSAPP_SEGMENT_MAX_VALUE_LENGTH) return `values are limited to ${WHATSAPP_SEGMENT_MAX_VALUE_LENGTH} characters`;
  if (field === "assigned_to" && !UUID_PATTERN.test(value)) return "use a staff profile id";
  if (field === "received_date" && !ISO_DATE.test(value)) return "use a date as YYYY-MM-DD";
  return null;
}

export type WhatsappSegmentRuleGroupResult =
  | { readonly ok: true; readonly ruleGroup: WhatsappSegmentRuleGroup }
  | { readonly ok: false; readonly field: string; readonly message: string };

export function buildWhatsappSegmentRuleGroup(drafts: readonly WhatsappSegmentRuleDraft[]): WhatsappSegmentRuleGroupResult {
  if (drafts.length < 1) return { ok: false, field: "rules", message: "Add at least one rule." };
  if (drafts.length > WHATSAPP_SEGMENT_MAX_RULES) {
    return { ok: false, field: "rules", message: `A segment can have at most ${WHATSAPP_SEGMENT_MAX_RULES} rules.` };
  }
  const rules: WhatsappSegmentRule[] = [];
  for (const [index, draft] of drafts.entries()) {
    const position = `Rule ${index + 1}`;
    const fieldKey = `rule.${index}`;
    if (!isWhatsappSegmentRuleField(draft.field)) return { ok: false, field: fieldKey, message: `${position}: choose a field.` };
    if (!isWhatsappSegmentRuleOp(draft.op)) return { ok: false, field: fieldKey, message: `${position}: choose a condition.` };
    if (draft.op === "in" || draft.op === "not_in") {
      const values = [...new Set(draft.value.split(",").map((v) => v.trim()).filter((v) => v.length > 0))];
      if (values.length < 1) return { ok: false, field: fieldKey, message: `${position}: add at least one value.` };
      if (values.length > WHATSAPP_SEGMENT_MAX_LIST_VALUES) {
        return { ok: false, field: fieldKey, message: `${position}: at most ${WHATSAPP_SEGMENT_MAX_LIST_VALUES} values.` };
      }
      for (const value of values) {
        const problem = valueProblem(draft.field, value);
        if (problem) return { ok: false, field: fieldKey, message: `${position}: ${problem}.` };
      }
      rules.push({ field: draft.field, op: draft.op, value: values });
    } else {
      const value = draft.value.trim();
      const problem = valueProblem(draft.field, value);
      if (problem) return { ok: false, field: fieldKey, message: `${position}: ${problem}.` };
      rules.push({ field: draft.field, op: draft.op, value });
    }
  }
  const ruleGroup: WhatsappSegmentRuleGroup = { rules };
  if (new TextEncoder().encode(JSON.stringify(ruleGroup)).length > WHATSAPP_SEGMENT_MAX_RULE_BYTES) {
    return { ok: false, field: "rules", message: "These rules are too large. Use fewer values." };
  }
  return { ok: true, ruleGroup };
}

export function ruleGroupToJson(ruleGroup: WhatsappSegmentRuleGroup): Json {
  return {
    rules: ruleGroup.rules.map((rule) => ({
      field: rule.field,
      op: rule.op,
      value: typeof rule.value === "string" ? rule.value : [...rule.value],
    })),
  };
}

/** Reads a stored rule group back. Anything outside the allowlist yields null. */
export function parseWhatsappSegmentRuleGroup(raw: unknown): WhatsappSegmentRuleGroup | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rules = (raw as { rules?: unknown }).rules;
  if (!Array.isArray(rules) || rules.length < 1 || rules.length > WHATSAPP_SEGMENT_MAX_RULES) return null;
  const out: WhatsappSegmentRule[] = [];
  for (const rule of rules) {
    if (!rule || typeof rule !== "object") return null;
    const { field, op, value } = rule as { field?: unknown; op?: unknown; value?: unknown };
    if (typeof field !== "string" || !isWhatsappSegmentRuleField(field)) return null;
    if (typeof op !== "string" || !isWhatsappSegmentRuleOp(op)) return null;
    if (op === "in" || op === "not_in") {
      if (!Array.isArray(value) || value.length < 1) return null;
      out.push({ field, op, value: value.map((v) => String(v)) });
    } else {
      if (!["string", "number", "boolean"].includes(typeof value)) return null;
      out.push({ field, op, value: String(value) });
    }
  }
  return { rules: out };
}

export function ruleGroupToDrafts(ruleGroup: WhatsappSegmentRuleGroup | null): WhatsappSegmentRuleDraft[] {
  if (!ruleGroup) return [{ field: "lead_stage", op: "equals", value: "" }];
  return ruleGroup.rules.map((rule) => ({
    field: rule.field,
    op: rule.op,
    value: typeof rule.value === "string" ? rule.value : rule.value.join(", "),
  }));
}

export function describeWhatsappSegmentRule(rule: WhatsappSegmentRule): string {
  const value = typeof rule.value === "string" ? rule.value : rule.value.join(", ");
  return `${WHATSAPP_SEGMENT_FIELD_META[rule.field].label} ${WHATSAPP_SEGMENT_OP_LABELS[rule.op]} ${value}`;
}

/** Form field names for rule rows, shared by the editor and the action. */
export function segmentRuleFieldName(index: number, part: "field" | "op" | "value"): string {
  return `rule.${index}.${part}`;
}

export function readWhatsappSegmentRuleDrafts(formData: { get(name: string): unknown }): WhatsappSegmentRuleDraft[] {
  const drafts: WhatsappSegmentRuleDraft[] = [];
  for (let index = 0; index <= WHATSAPP_SEGMENT_MAX_RULES; index += 1) {
    const field = formData.get(segmentRuleFieldName(index, "field"));
    if (field === null || field === undefined) break;
    drafts.push({
      field: String(field),
      op: String(formData.get(segmentRuleFieldName(index, "op")) ?? ""),
      value: String(formData.get(segmentRuleFieldName(index, "value")) ?? ""),
    });
  }
  return drafts;
}

export interface WhatsappSegmentSubmission {
  readonly name: string;
  readonly description: string;
  readonly active: boolean;
  readonly ruleGroup: WhatsappSegmentRuleGroup;
}

export function buildWhatsappSegmentSubmission(input: {
  readonly name: string;
  readonly description: string;
  readonly active: boolean;
  readonly rules: readonly WhatsappSegmentRuleDraft[];
}):
  | { readonly ok: true; readonly submission: WhatsappSegmentSubmission }
  | { readonly ok: false; readonly field: string; readonly message: string } {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) return { ok: false, field: "name", message: "Name must be 2–120 characters." };
  const description = input.description.trim();
  if (description.length > 500) return { ok: false, field: "description", message: "Description is limited to 500 characters." };
  const rules = buildWhatsappSegmentRuleGroup(input.rules);
  if (!rules.ok) return rules;
  return { ok: true, submission: { name, description, active: input.active, ruleGroup: rules.ruleGroup } };
}

export interface WhatsappSegmentPreview {
  readonly totalMatched: number;
  readonly eligible: number;
  readonly doNotContact: number;
  readonly noMarketingConsent: number;
  readonly missingWhatsapp: number;
}

function count(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

export function parseWhatsappSegmentPreviewPayload(payload: unknown): WhatsappSegmentPreview | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const values = [p.total_matched, p.eligible, p.do_not_contact, p.no_marketing_consent, p.missing_whatsapp].map(count);
  if (values.some((v) => v === null)) return null;
  const [totalMatched, eligible, doNotContact, noMarketingConsent, missingWhatsapp] = values as number[];
  return {
    totalMatched: totalMatched!,
    eligible: eligible!,
    doNotContact: doNotContact!,
    noMarketingConsent: noMarketingConsent!,
    missingWhatsapp: missingWhatsapp!,
  };
}
