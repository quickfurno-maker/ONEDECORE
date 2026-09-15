"use client";

import { useActionState, useState } from "react";
import {
  renderWhatsappTemplatePreview,
  whatsappTemplateParametersProblem,
  type WhatsappTemplateParameters,
} from "../../contracts/template-components.ts";
import {
  INITIAL_WHATSAPP_TEMPLATE_SEND_ACTION_STATE,
  whatsappTemplateParameterFieldName,
  type WhatsappSendableTemplateView,
} from "../../contracts/template-studio.ts";
import type { SendingStatusView } from "../../contracts/sending-status.ts";
import { sendWhatsappUtilityTemplateAction } from "../../server/whatsapp-template-actions.ts";

/**
 * Approved UTILITY template picker for one conversation.
 *
 * A SEPARATE FORM, ON PURPOSE.
 *
 * The text composer below keeps its own form, its own uncontrolled textarea
 * and its own action, so Kriti's "Insert into composer" and Enter-to-send are
 * untouched. Choosing a template never writes into the textarea and never
 * sends: the only way a template leaves is this form's own button, pressed by
 * a person.
 *
 * WHAT IT CAN OFFER.
 *
 * The list arrives from `list_whatsapp_sendable_utility_templates`, which only
 * returns APPROVED UTILITY templates the database will accept for THIS
 * conversation right now. MARKETING never appears. The values are checked here
 * for a helpful message and checked again, authoritatively, by the RPC and at
 * dispatch time.
 */

interface InboxTemplatePickerProps {
  readonly conversationId: string;
  readonly templates: readonly WhatsappSendableTemplateView[];
  readonly sending?: SendingStatusView | null;
}

export function InboxTemplatePicker({ conversationId, templates, sending = null }: InboxTemplatePickerProps) {
  const [state, formAction, pending] = useActionState(
    sendWhatsappUtilityTemplateAction,
    INITIAL_WHATSAPP_TEMPLATE_SEND_ACTION_STATE
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = templates.find((t) => t.snapshotId === selectedId) ?? null;

  /* A fresh key per send, stamped at submit — never during render. */
  const submit = (formData: FormData) => {
    formData.set("idempotencyKey", crypto.randomUUID());
    return formAction(formData);
  };

  return (
    <details className="od-wa__assist od-wa__tpl" data-testid="whatsapp-template-picker">
      <summary className="od-wa__assist-toggle">
        <span>Templates</span>
        <span className="od-wa__assist-hint" aria-hidden="true">
          {templates.length > 0 ? `${templates.length} approved` : "None approved"}
        </span>
      </summary>
      <div className="od-wa__assist-body">
        {templates.length === 0 ? (
          <p className="od-wa__notice" role="status">
            No approved utility templates are available for this conversation. Templates appear here once a
            manager syncs them and WhatsApp approves them.
          </p>
        ) : (
          <form action={submit} aria-label="Send an approved WhatsApp template">
            <input type="hidden" name="conversationId" value={conversationId} />

            <label className="od-wa__tpl-field">
              <span className="od-wa__tpl-label">Approved utility template</span>
              <select
                name="templateSnapshotId"
                className="od-wa__tpl-input"
                value={selectedId}
                onChange={(event) => setSelectedId(event.currentTarget.value)}
                disabled={pending}
                required
              >
                <option value="">Choose a template…</option>
                {templates.map((template) => (
                  <option key={template.snapshotId} value={template.snapshotId}>
                    {template.name} · {template.language}
                  </option>
                ))}
              </select>
            </label>

            {selected ? (
              <TemplateValues
                key={selected.snapshotId}
                template={selected}
                pending={pending}
                sending={sending}
              />
            ) : null}

            {state.message ? (
              <p
                className={state.success ? "od-wa__ok" : "od-wa__error"}
                role={state.success ? "status" : "alert"}
              >
                {state.message}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </details>
  );
}

/**
 * The variables, the preview and the send button for one chosen template.
 * Remounted per template, so values from one template never leak into another.
 */
function TemplateValues({
  template,
  pending,
  sending,
}: {
  readonly template: WhatsappSendableTemplateView;
  readonly pending: boolean;
  readonly sending: SendingStatusView | null;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const parameters: WhatsappTemplateParameters = {};
  const header: Record<string, string> = {};
  const body: Record<string, string> = {};
  for (const variable of template.variables) {
    const value = values[whatsappTemplateParameterFieldName(variable)] ?? "";
    if (variable.component === "header") header[variable.key] = value;
    else body[variable.key] = value;
  }
  if (Object.keys(header).length > 0) Object.assign(parameters, { header });
  if (Object.keys(body).length > 0) Object.assign(parameters, { body });

  const problem = whatsappTemplateParametersProblem(template.components, parameters);
  const preview = renderWhatsappTemplatePreview(template.components, parameters);

  return (
    <>
      {template.variables.map((variable) => {
        const name = whatsappTemplateParameterFieldName(variable);
        return (
          <label className="od-wa__tpl-field" key={name}>
            <span className="od-wa__tpl-label">
              {variable.component === "header" ? "Header" : "Body"} value {`{{${variable.key}}}`}
            </span>
            <input
              name={name}
              className="od-wa__tpl-input"
              maxLength={variable.maxLength}
              required
              disabled={pending}
              autoComplete="off"
              value={values[name] ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setValues((current) => ({ ...current, [name]: next }));
              }}
            />
          </label>
        );
      })}

      <div className="od-wa__tpl-preview" aria-live="polite">
        <span className="od-wa__tpl-label">Preview</span>
        <p className="od-wa__text">{preview}</p>
        {template.text.buttons.length > 0 ? (
          <span className="od-wa__attach-note">Buttons: {template.text.buttons.join(" · ")}</span>
        ) : null}
      </div>

      {problem === "parameters_invalid" ? (
        <p className="od-wa__notice" role="status">
          Values must be a single line, without tabs or long runs of spaces.
        </p>
      ) : null}

      {sending && !sending.reaches ? (
        <p className="od-wa__notice" role="status">
          {sending.detail}
        </p>
      ) : null}

      <div className="od-wa__composer-row">
        <button
          type="submit"
          className="od-wa__btn od-wa__btn--send"
          disabled={pending || problem !== null}
        >
          {pending ? "Sending…" : "Send template"}
        </button>
      </div>
    </>
  );
}
