"use client";

import { useActionState, useState } from "react";
import type { WhatsappAutomationPreset } from "../../contracts/automation-presets.ts";
import {
  availableWhatsappAutomationActions,
  WHATSAPP_AUTOMATION_ACTION_LABELS,
  WHATSAPP_AUTOMATION_STAGE_OPTIONS,
  WHATSAPP_AUTOMATION_STOP_STATUSES,
  WHATSAPP_AUTOMATION_TRIGGER_LABELS,
  WHATSAPP_AUTOMATION_TRIGGERS,
  type WhatsappAutomationTrigger,
  type WhatsappAutomationView,
} from "../../contracts/automations.ts";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import {
  resolveWhatsappAutomationReconcileAction,
  saveWhatsappAutomationAction,
  setWhatsappAutomationStatusAction,
} from "../../server/whatsapp-automation-actions.ts";
import { ControlPlaneActionMessage } from "../control-plane/ControlPlaneActionMessage.tsx";

/**
 * WM-6 automation forms. Hints only: every action authorizes first and SQL
 * decides. There is no "send now" control; the internal worker sends each
 * enrollment after its own just-in-time checks.
 */

type Option = { readonly id: string; readonly label: string };

export function AutomationEditorForm({
  automation,
  preset = null,
  campaignVersions,
  flows,
}: {
  readonly automation: WhatsappAutomationView | null;
  readonly preset?: WhatsappAutomationPreset | null;
  readonly campaignVersions: readonly Option[];
  readonly flows: readonly Option[];
}) {
  const [state, action, pending] = useActionState(saveWhatsappAutomationAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [trigger, setTrigger] = useState<WhatsappAutomationTrigger>(
    (automation?.triggerType as WhatsappAutomationTrigger) ?? (preset?.triggerType as WhatsappAutomationTrigger) ?? "lead_created"
  );
  const stops = automation?.stopOnLeadStatuses ?? preset?.stopOnLeadStatuses ?? ["closed_won", "closed_lost"];

  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-automation-editor">
      {automation ? <input type="hidden" name="automationId" value={automation.id} /> : null}
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Name</span>
          <input name="name" defaultValue={automation?.name ?? preset?.title ?? ""} minLength={2} maxLength={120} required />
        </label>
        <label className="od-cp__field">
          <span>Trigger</span>
          <select name="triggerType" value={trigger} onChange={(event) => setTrigger(event.target.value as WhatsappAutomationTrigger)}>
            {WHATSAPP_AUTOMATION_TRIGGERS.map((option) => (
              <option key={option} value={option}>
                {WHATSAPP_AUTOMATION_TRIGGER_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        {trigger === "lead_stage_changed" ? (
          <label className="od-cp__field">
            <span>Stage</span>
            <select name="toStage" defaultValue={automation?.triggerConfig.to_stage ?? preset?.toStage ?? "qualified"}>
              {WHATSAPP_AUTOMATION_STAGE_OPTIONS.map((stage) => (
                <option key={stage} value={stage}>
                  {stage.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {trigger === "campaign_reply" ? (
          <label className="od-cp__field">
            <span>Replies to (optional)</span>
            <select name="triggerCampaignVersionId" defaultValue={automation?.triggerConfig.campaign_version_id ?? ""}>
              <option value="">Any campaign</option>
              {campaignVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {trigger === "flow_completed" ? (
          <label className="od-cp__field">
            <span>Flow</span>
            <select name="flowId" defaultValue={automation?.triggerConfig.flow_id ?? ""} required>
              <option value="" disabled>
                Choose a Flow
              </option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {trigger === "ctwa_referral" ? (
          <label className="od-cp__field">
            <span>Ad id (optional)</span>
            <input name="sourceId" defaultValue={automation?.triggerConfig.source_id ?? ""} maxLength={128} pattern="[A-Za-z0-9_.:\-]{1,128}" />
          </label>
        ) : null}
        <label className="od-cp__field">
          <span>Send (approved WhatsApp campaign)</span>
          <select name="campaignVersionId" defaultValue={automation?.campaignVersionId ?? ""} required>
            <option value="" disabled>
              {campaignVersions.length === 0 ? "No approved WhatsApp campaign" : "Choose an approved campaign"}
            </option>
            {campaignVersions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.label}
              </option>
            ))}
          </select>
        </label>
        <label className="od-cp__field">
          <span>Delay after trigger (minutes)</span>
          <input name="delayMinutes" type="number" min={0} max={43200} step={1} defaultValue={automation?.delayMinutes ?? preset?.delayMinutes ?? 0} />
        </label>
      </div>
      <fieldset className="od-cp__chips" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="od-cp__hint">Stop when the lead is</legend>
        {WHATSAPP_AUTOMATION_STOP_STATUSES.map((status) => (
          <label key={status} className="od-cp__check">
            <input type="checkbox" name="stopOnLeadStatuses" value={status} defaultChecked={stops.includes(status)} />
            <span>{status.replace(/_/g, " ")}</span>
          </label>
        ))}
        <label className="od-cp__check">
          <input type="checkbox" name="stopOnReply" defaultChecked={automation?.stopOnReply ?? preset?.stopOnReply ?? true} />
          <span>Stop if the customer replies first</span>
        </label>
      </fieldset>
      <label className="od-cp__field od-cp__field--wide">
        <span>Description (optional)</span>
        <input name="description" defaultValue={automation?.description ?? preset?.summary ?? ""} maxLength={500} />
      </label>
      <p className="od-cp__hint">
        Opt-outs, do-not-contact, suppression, missing marketing consent, frequency caps and quiet hours always stop or defer a send.
        Each contact enters an automation at most once.
      </p>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--primary" disabled={pending}>
          {pending ? "Saving…" : automation ? "Save draft" : "Create draft"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function AutomationStatusControls({
  automationId,
  status,
  lockVersion,
  canManage,
}: {
  readonly automationId: string;
  readonly status: string;
  readonly lockVersion: number;
  readonly canManage: boolean;
}) {
  const [state, action, pending] = useActionState(setWhatsappAutomationStatusAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const actions = availableWhatsappAutomationActions(status, canManage);
  if (actions.length === 0) return null;
  return (
    <form action={action} className="od-cp__stack" data-testid={`whatsapp-automation-status-${automationId}`}>
      <input type="hidden" name="automationId" value={automationId} />
      <input type="hidden" name="lockVersion" value={lockVersion} />
      <div className="od-cp__chips">
        {actions.map((option) => (
          <button
            key={option}
            type="submit"
            name="action"
            value={option}
            className={`od-cp__btn od-cp__btn--quiet${option === "archive" ? " od-cp__btn--danger" : option === "activate" || option === "resume" ? " od-cp__btn--primary" : ""}`}
            disabled={pending}
          >
            {WHATSAPP_AUTOMATION_ACTION_LABELS[option]}
          </button>
        ))}
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function AutomationReconcileForm({ enrollmentId }: { readonly enrollmentId: string }) {
  const [state, action, pending] = useActionState(resolveWhatsappAutomationReconcileAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [resolution, setResolution] = useState<"not_sent" | "sent">("not_sent");
  return (
    <form action={action} className="od-cp__stack" data-testid={`whatsapp-automation-reconcile-${enrollmentId}`}>
      <input type="hidden" name="jobId" value={enrollmentId} />
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
