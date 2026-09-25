"use client";

import { useActionState, useMemo, useState } from "react";
import {
  WHATSAPP_CAMPAIGN_BINDING_LABELS,
  WHATSAPP_CAMPAIGN_BINDING_SOURCES,
  WHATSAPP_CAMPAIGN_RUN_OPERATION_LABEL,
  whatsappCampaignParameterFieldName,
  whatsappTemplateButtonSlots,
  type WhatsappCampaignRunOperation,
  type WhatsappCampaignTemplateOption,
  type WhatsappCampaignTemplateParameters,
  type WhatsappCampaignTestDestination,
} from "../../contracts/campaign-execution.ts";
import { WHATSAPP_MARKETING_PREFERENCE_CATEGORIES } from "../../contracts/contacts-compliance.ts";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import {
  extractWhatsappTemplateVariables,
  readWhatsappTemplateTextParts,
} from "../../contracts/template-components.ts";
import {
  createWhatsappCampaignRunAction,
  createWhatsappCampaignTestSendAction,
  resolveWhatsappCampaignReconcileAction,
  saveWhatsappCampaignButtonBindingsAction,
  saveWhatsappCampaignSpecAction,
  transitionWhatsappCampaignRunAction,
} from "../../server/whatsapp-campaign-actions.ts";
import { ControlPlaneActionMessage } from "../control-plane/ControlPlaneActionMessage.tsx";

/**
 * WM-4 campaign forms. Each posts to a caller-session server action that
 * authorizes first and lets SQL decide; these controls are hints, not gates.
 */

export function CampaignSpecForm({
  campaignVersionId,
  templates,
  segments,
  templateSnapshotId,
  preferenceCategory,
  segmentId,
  defaultParameters,
  parameterBindings,
}: {
  readonly campaignVersionId: string;
  readonly templates: readonly WhatsappCampaignTemplateOption[];
  readonly segments: readonly { readonly id: string; readonly name: string }[];
  readonly templateSnapshotId: string;
  readonly preferenceCategory: string;
  readonly segmentId: string;
  readonly defaultParameters: WhatsappCampaignTemplateParameters;
  readonly parameterBindings: WhatsappCampaignTemplateParameters;
}) {
  const [state, action, pending] = useActionState(saveWhatsappCampaignSpecAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [snapshotId, setSnapshotId] = useState(templateSnapshotId);
  const template = templates.find((option) => option.snapshotId === snapshotId) ?? null;
  const variables = useMemo(() => extractWhatsappTemplateVariables(template?.components ?? []), [template]);
  const preview = useMemo(() => readWhatsappTemplateTextParts(template?.components ?? []), [template]);

  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-campaign-spec-form">
      <input type="hidden" name="campaignVersionId" value={campaignVersionId} />
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Approved MARKETING template</span>
          <select name="templateSnapshotId" value={snapshotId} onChange={(event) => setSnapshotId(event.target.value)} required>
            <option value="" disabled>
              {templates.length === 0 ? "No sendable MARKETING template yet" : "Choose a template"}
            </option>
            {templates.map((option) => (
              <option key={option.snapshotId} value={option.snapshotId}>
                {option.name} · {option.language}
                {option.qualityRating ? ` · quality ${option.qualityRating}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="od-cp__field">
          <span>Preference category</span>
          <select name="preferenceCategory" defaultValue={preferenceCategory} required>
            <option value="" disabled>
              Choose a category
            </option>
            {WHATSAPP_MARKETING_PREFERENCE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="od-cp__field">
          <span>Narrow with a saved segment (optional)</span>
          <select name="segmentId" defaultValue={segmentId}>
            <option value="">No segment</option>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {template ? (
        <div className="od-growth__builder">
          <div className="od-growth__phone">
            <div className="od-growth__phone-bar">ONEDECORE campaign preview</div>
            <div className="od-growth__bubble">
              {preview.header ? <div className="od-growth__bubble-header">{preview.header}</div> : null}
              <div>{preview.body ?? "Template body unavailable."}</div>
              {preview.footer ? <div className="od-growth__bubble-footer">{preview.footer}</div> : null}
              {preview.buttons.length > 0 ? (
                <div className="od-growth__template-meta">
                  {preview.buttons.map((button) => (
                    <span key={button} className="od-cp__badge">{button}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="od-cp__notice">
            <strong>{template.name}</strong> · {template.language}
            {template.qualityRating ? ` · quality ${template.qualityRating}` : ""}
            <br />
            This preview uses the approved template snapshot. Variable values are mapped below and revalidated before send.
          </div>
        </div>
      ) : null}

      {variables.length > 0 ? (
        <table className="od-cp__table" data-testid="whatsapp-campaign-variable-map">
          <thead>
            <tr>
              <th scope="col">Variable</th>
              <th scope="col">Fill from</th>
              <th scope="col">Static value</th>
            </tr>
          </thead>
          <tbody>
            {variables.map((variable) => {
              const bound = parameterBindings[variable.component]?.[variable.key] ?? "";
              const fixed = defaultParameters[variable.component]?.[variable.key] ?? "";
              return (
                <tr key={`${variable.component}:${variable.key}`}>
                  <td>
                    {variable.component} {`{{${variable.key}}}`}
                  </td>
                  <td>
                    <select name={whatsappCampaignParameterFieldName(variable.component, variable.key, "source")} defaultValue={bound}>
                      <option value="">Static value</option>
                      {WHATSAPP_CAMPAIGN_BINDING_SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {WHATSAPP_CAMPAIGN_BINDING_LABELS[source]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      name={whatsappCampaignParameterFieldName(variable.component, variable.key, "value")}
                      defaultValue={fixed}
                      maxLength={variable.maxLength}
                      aria-label={`Static value for ${variable.component} ${variable.key}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : template ? (
        <p className="od-cp__hint">This template has no variables.</p>
      ) : null}

      <p className="od-cp__hint">
        A contact whose bound value is empty is excluded rather than sent a blank. Customer phone numbers are never a template value.
      </p>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--primary" disabled={pending || !snapshotId}>
          {pending ? "Saving…" : "Save spec"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function CampaignButtonBindingsForm({
  campaignVersionId,
  components,
  bindings,
  destinations,
  flows,
  locked,
}: {
  readonly campaignVersionId: string;
  readonly components: unknown;
  readonly bindings: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly destinations: readonly { readonly id: string; readonly label: string; readonly isActive: boolean }[];
  readonly flows: readonly { readonly id: string; readonly name: string; readonly providerFlowId: string | null }[];
  readonly locked: boolean;
}) {
  const [state, action, pending] = useActionState(saveWhatsappCampaignButtonBindingsAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const slots = whatsappTemplateButtonSlots(components);
  if (slots.length === 0) return null;
  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-campaign-button-bindings-form">
      <input type="hidden" name="campaignVersionId" value={campaignVersionId} />
      {slots.map((slot) => {
        const current = bindings[String(slot.index)];
        const value = current?.destination_id ?? current?.flow_id ?? "";
        return (
          <label key={slot.index} className="od-cp__field">
            <span>
              Button {slot.index + 1} · {slot.text} · {slot.kind === "url" ? "tracked link" : "WhatsApp Flow"}
            </span>
            <select name={`button:${slot.index}`} defaultValue={value} disabled={locked}>
              <option value="">Not mapped</option>
              {slot.kind === "url"
                ? destinations
                    .filter((destination) => destination.isActive || destination.id === value)
                    .map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.label}
                      </option>
                    ))
                : flows
                    .filter((flow) => flow.providerFlowId === slot.providerFlowId)
                    .map((flow) => (
                      <option key={flow.id} value={flow.id}>
                        {flow.name}
                      </option>
                    ))}
            </select>
          </label>
        );
      })}
      <p className="od-cp__hint">
        Each recipient gets an opaque token in the button. The link carries no name, number or campaign id.
      </p>
      {locked ? null : (
        <div>
          <button type="submit" className="od-cp__btn" disabled={pending}>
            {pending ? "Saving…" : "Save button mapping"}
          </button>
        </div>
      )}
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function CampaignTestSendForm({
  campaignVersionId,
  destinations,
}: {
  readonly campaignVersionId: string;
  readonly destinations: readonly WhatsappCampaignTestDestination[];
}) {
  const [state, action, pending] = useActionState(createWhatsappCampaignTestSendAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  if (destinations.length === 0) {
    return <p className="od-cp__hint">No internal test number is registered. A Super Admin or Sales Manager profile needs a phone.</p>;
  }
  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-campaign-test-send-form">
      <input type="hidden" name="campaignVersionId" value={campaignVersionId} />
      <label className="od-cp__field">
        <span>Internal test recipient</span>
        <select name="destinationProfileId" defaultValue={destinations.find((d) => d.isSelf)?.profileId ?? destinations[0]!.profileId}>
          {destinations.map((destination) => (
            <option key={destination.profileId} value={destination.profileId}>
              {destination.label}
              {destination.phoneLast4 ? ` · ••${destination.phoneLast4}` : ""}
              {destination.isSelf ? " (you)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="od-cp__hint">Tests go only to registered staff numbers, filled with the staff member&apos;s own name.</p>
      <div>
        <button type="submit" className="od-cp__btn" disabled={pending}>
          {pending ? "Queuing…" : "Send test"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function CampaignCreateRunForm({ campaignVersionId }: { readonly campaignVersionId: string }) {
  const [state, action, pending] = useActionState(createWhatsappCampaignRunAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [local, setLocal] = useState("");
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-campaign-create-run-form">
      <input type="hidden" name="campaignVersionId" value={campaignVersionId} />
      <input type="hidden" name="scheduledFor" value={iso} />
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Schedule for (blank = now)</span>
          <input type="datetime-local" value={local} onChange={(event) => setLocal(event.target.value)} />
        </label>
        <label className="od-cp__check">
          <input type="checkbox" name="autoStart" value="off" />
          <span>Materialise only; I will start it myself</span>
        </label>
      </div>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--primary" disabled={pending}>
          {pending ? "Creating…" : local ? "Schedule run" : "Create run"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function CampaignRunControls({
  runId,
  operations,
}: {
  readonly runId: string;
  readonly operations: readonly WhatsappCampaignRunOperation[];
}) {
  const [state, action, pending] = useActionState(transitionWhatsappCampaignRunAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (operations.length === 0) return null;
  return (
    <form action={action} className="od-cp__stack" data-testid={`whatsapp-campaign-run-controls-${runId}`}>
      <input type="hidden" name="runId" value={runId} />
      <div className="od-cp__chips">
        {operations.map((operation) =>
          operation === "cancel" && !confirmCancel ? (
            <button
              key={operation}
              type="button"
              className="od-cp__btn od-cp__btn--danger od-cp__btn--quiet"
              onClick={() => setConfirmCancel(true)}
            >
              {WHATSAPP_CAMPAIGN_RUN_OPERATION_LABEL.cancel}
            </button>
          ) : (
            <button
              key={operation}
              type="submit"
              name="operation"
              value={operation}
              className={`od-cp__btn od-cp__btn--quiet${operation === "cancel" ? " od-cp__btn--danger" : ""}`}
              disabled={pending}
            >
              {operation === "cancel" ? "Confirm cancel" : WHATSAPP_CAMPAIGN_RUN_OPERATION_LABEL[operation]}
            </button>
          )
        )}
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function CampaignReconcileForm({ jobId }: { readonly jobId: string }) {
  const [state, action, pending] = useActionState(resolveWhatsappCampaignReconcileAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [resolution, setResolution] = useState<"not_sent" | "sent">("not_sent");
  return (
    <form action={action} className="od-cp__stack" data-testid={`whatsapp-campaign-reconcile-${jobId}`}>
      <input type="hidden" name="jobId" value={jobId} />
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Evidence shows</span>
          <select name="resolution" value={resolution} onChange={(event) => setResolution(event.target.value === "sent" ? "sent" : "not_sent")}>
            <option value="not_sent">Not delivered by Meta</option>
            <option value="sent">Sent (provider id known)</option>
          </select>
        </label>
        {resolution === "sent" ? (
          <label className="od-cp__field">
            <span>Provider message id</span>
            <input name="providerMessageId" maxLength={128} required autoComplete="off" />
          </label>
        ) : null}
      </div>
      <label className="od-cp__field od-cp__field--wide">
        <span>Note (required)</span>
        <input name="note" minLength={8} maxLength={500} required />
      </label>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--quiet" disabled={pending}>
          {pending ? "Recording…" : "Record decision"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}
