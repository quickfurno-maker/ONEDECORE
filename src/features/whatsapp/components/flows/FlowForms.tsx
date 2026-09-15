"use client";

import { useActionState, useState } from "react";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import {
  availableWhatsappFlowActions,
  WHATSAPP_FLOW_ACTION_LABELS,
  WHATSAPP_FLOW_CATEGORIES,
  WHATSAPP_FLOW_FIELD_TARGETS,
  WHATSAPP_FLOW_PURPOSES,
  type WhatsappFlowDetail,
} from "../../contracts/flows.ts";
import { requestWhatsappFlowProviderActionAction, saveWhatsappFlowDraftAction } from "../../server/whatsapp-flow-actions.ts";
import { ControlPlaneActionMessage } from "../control-plane/ControlPlaneActionMessage.tsx";

/** WM-6 Flow forms. Local drafts never reach Meta until a provider action is explicitly requested. */

export function FlowDraftForm({ flow }: { readonly flow: WhatsappFlowDetail | null }) {
  const [state, action, pending] = useActionState(saveWhatsappFlowDraftAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const initialMappings = Object.entries(flow?.fieldMappings ?? {});
  const [rows, setRows] = useState(Math.max(initialMappings.length, 1));
  const atMeta = Boolean(flow?.providerFlowId);

  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-flow-draft-form">
      {flow ? <input type="hidden" name="flowId" value={flow.id} /> : null}
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Flow name</span>
          <input name="name" defaultValue={flow?.name ?? ""} maxLength={200} required readOnly={atMeta} />
        </label>
        <label className="od-cp__field">
          <span>Purpose</span>
          <select name="purpose" defaultValue={flow?.purpose ?? "lead_qualification"}>
            {WHATSAPP_FLOW_PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {purpose.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="od-cp__chips" style={{ border: 0, padding: 0, margin: 0 }} disabled={atMeta}>
        <legend className="od-cp__hint">Meta Flow categories</legend>
        {WHATSAPP_FLOW_CATEGORIES.map((category) => (
          <label key={category} className="od-cp__check">
            <input type="checkbox" name="categories" value={category} defaultChecked={flow?.categories.includes(category) ?? category === "LEAD_GENERATION"} />
            <span>{category.replace(/_/g, " ").toLowerCase()}</span>
          </label>
        ))}
      </fieldset>
      {atMeta ? flow!.categories.map((category) => <input key={category} type="hidden" name="categories" value={category} />) : null}

      <div className="od-cp__stack">
        <span className="od-cp__hint">Answer mapping (Flow field name → CRM field)</span>
        {Array.from({ length: rows }, (_, index) => {
          const [key, target] = initialMappings[index] ?? ["", ""];
          return (
            <div key={index} className="od-cp__grid">
              <label className="od-cp__field">
                <span>Flow field</span>
                <input name="mappingKey" defaultValue={key} maxLength={64} pattern="[a-z][a-z0-9_]{0,63}" />
              </label>
              <label className="od-cp__field">
                <span>CRM field</span>
                <select name="mappingTarget" defaultValue={target}>
                  <option value="">Not mapped</option>
                  {WHATSAPP_FLOW_FIELD_TARGETS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
        {rows < 30 ? (
          <div>
            <button type="button" className="od-cp__btn od-cp__btn--quiet" onClick={() => setRows(rows + 1)}>
              Add field
            </button>
          </div>
        ) : null}
      </div>

      <label className="od-cp__field od-cp__field--wide">
        <span>Flow JSON (official Flow document)</span>
        <textarea name="flowJson" rows={10} spellCheck={false} defaultValue={flow?.flowJson ? JSON.stringify(flow.flowJson, null, 2) : ""} />
      </label>
      <p className="od-cp__hint">
        Answers are stored as evidence. Only an empty locality or budget band on a live lead is filled; nothing in the CRM is overwritten.
      </p>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--primary" disabled={pending}>
          {pending ? "Saving…" : flow ? "Save draft" : "Create local draft"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function FlowProviderActions({ flow, providerMode }: { readonly flow: WhatsappFlowDetail; readonly providerMode: string }) {
  const [state, action, pending] = useActionState(requestWhatsappFlowProviderActionAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const actions = availableWhatsappFlowActions(flow);
  return (
    <form
      action={(formData) => {
        action(formData);
        // Each explicit click is a new decision; a double-submit of the same render reuses its key.
        setKey(crypto.randomUUID());
      }}
      className="od-cp__stack"
      data-testid="whatsapp-flow-provider-actions"
    >
      <input type="hidden" name="flowId" value={flow.id} />
      <input type="hidden" name="idempotencyKey" value={key} />
      {providerMode === "disabled" ? (
        <p className="od-cp__hint">Provider calls are turned off in this environment; requests are refused without contacting Meta.</p>
      ) : providerMode === "local-test" ? (
        <p className="od-cp__hint">local-test: a fake provider creates DRAFT Flows and never publishes.</p>
      ) : null}
      <div className="od-cp__chips">
        {actions.map((option) => (
          <button
            key={option}
            type="submit"
            name="action"
            value={option}
            className={`od-cp__btn od-cp__btn--quiet${option === "publish" ? " od-cp__btn--primary" : option === "deprecate" ? " od-cp__btn--danger" : ""}`}
            disabled={pending}
          >
            {WHATSAPP_FLOW_ACTION_LABELS[option]}
          </button>
        ))}
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}
