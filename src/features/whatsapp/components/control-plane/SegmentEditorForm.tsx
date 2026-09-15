"use client";

import { useActionState, useState } from "react";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import {
  segmentRuleFieldName,
  WHATSAPP_SEGMENT_FIELD_META,
  WHATSAPP_SEGMENT_MAX_RULES,
  WHATSAPP_SEGMENT_OP_LABELS,
  WHATSAPP_SEGMENT_RULE_FIELDS,
  WHATSAPP_SEGMENT_RULE_OPS,
  type WhatsappSegmentRuleDraft,
} from "../../contracts/segment-rules.ts";
import { saveWhatsappSegmentAction } from "../../server/whatsapp-segments-actions.ts";
import { ControlPlaneActionMessage } from "./ControlPlaneActionMessage.tsx";

/**
 * Create or edit one segment. Rules are chosen from the database allowlist
 * and ANDed together; the server rebuilds the rule group from these fields
 * and the database validates it again.
 */

type Row = WhatsappSegmentRuleDraft & { readonly key: number };

export function SegmentEditorForm({
  segmentId = null,
  name = "",
  description = "",
  active = true,
  rules,
}: {
  readonly segmentId?: string | null;
  readonly name?: string;
  readonly description?: string;
  readonly active?: boolean;
  readonly rules: readonly WhatsappSegmentRuleDraft[];
}) {
  const [state, action, pending] = useActionState(saveWhatsappSegmentAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [rows, setRows] = useState<Row[]>(() => rules.map((rule, key) => ({ ...rule, key })));
  const [nextKey, setNextKey] = useState(rules.length);

  const update = (key: number, patch: Partial<WhatsappSegmentRuleDraft>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-segment-editor">
      {segmentId ? <input type="hidden" name="segmentId" value={segmentId} /> : null}
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Name</span>
          <input name="name" defaultValue={name} minLength={2} maxLength={120} required />
        </label>
        <label className="od-cp__field">
          <span>Description (optional)</span>
          <input name="description" defaultValue={description} maxLength={500} />
        </label>
      </div>

      <fieldset className="od-cp__rules" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="od-cp__panel-title">Contacts whose latest lead matches every rule</legend>
        {rows.map((row, index) => {
          const isList = row.op === "in" || row.op === "not_in";
          const meta = WHATSAPP_SEGMENT_FIELD_META[row.field as keyof typeof WHATSAPP_SEGMENT_FIELD_META];
          return (
            <div key={row.key} className="od-cp__rule">
              <label className="od-cp__field">
                <span>Field</span>
                <select
                  name={segmentRuleFieldName(index, "field")}
                  value={row.field}
                  onChange={(event) => update(row.key, { field: event.target.value })}
                >
                  {WHATSAPP_SEGMENT_RULE_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {WHATSAPP_SEGMENT_FIELD_META[field].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="od-cp__field">
                <span>Condition</span>
                <select
                  name={segmentRuleFieldName(index, "op")}
                  value={row.op}
                  onChange={(event) => update(row.key, { op: event.target.value })}
                >
                  {WHATSAPP_SEGMENT_RULE_OPS.map((op) => (
                    <option key={op} value={op}>
                      {WHATSAPP_SEGMENT_OP_LABELS[op]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="od-cp__field">
                <span>{isList ? "Values (comma separated)" : "Value"}</span>
                <input
                  name={segmentRuleFieldName(index, "value")}
                  value={row.value}
                  placeholder={meta?.hint}
                  maxLength={isList ? 2000 : 120}
                  onChange={(event) => update(row.key, { value: event.target.value })}
                  required
                />
              </label>
              <button
                type="button"
                className="od-cp__btn od-cp__btn--quiet"
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                disabled={rows.length <= 1}
                aria-label={`Remove rule ${index + 1}`}
              >
                Remove
              </button>
            </div>
          );
        })}
        <div>
          <button
            type="button"
            className="od-cp__btn od-cp__btn--quiet"
            disabled={rows.length >= WHATSAPP_SEGMENT_MAX_RULES}
            onClick={() => {
              setRows((current) => [...current, { key: nextKey, field: "lead_stage", op: "equals", value: "" }]);
              setNextKey((key) => key + 1);
            }}
          >
            Add rule
          </button>
        </div>
      </fieldset>

      <label className="od-cp__check">
        <input type="checkbox" name="active" defaultChecked={active} />
        <span>Active — inactive segments cannot be previewed or used by campaigns</span>
      </label>

      <div className="od-cp__row-actions" style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="od-cp__btn od-cp__btn--primary" disabled={pending}>
          {pending ? "Saving…" : segmentId ? "Save changes" : "Create segment"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}
