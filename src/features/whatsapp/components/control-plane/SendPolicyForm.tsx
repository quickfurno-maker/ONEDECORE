"use client";

import { useActionState, useState } from "react";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import { WHATSAPP_SEND_POLICY_MAX_RULES, type WhatsappMarketingFrequencyRule } from "../../contracts/send-policy.ts";
import { saveWhatsappSendPolicyAction } from "../../server/whatsapp-settings-actions.ts";
import { ControlPlaneActionMessage } from "./ControlPlaneActionMessage.tsx";

/**
 * Super Admin editor for a NEW policy version. Prefilled from the current
 * version when there is one; blank otherwise, because there are no default
 * caps or quiet hours in code.
 */

type Rule = { readonly key: number; readonly windowHours: string; readonly maxMessages: string };

export function SendPolicyForm({
  frequencyRules,
  startLocal,
  endLocal,
  timezone,
  executionEnabled,
}: {
  readonly frequencyRules: readonly WhatsappMarketingFrequencyRule[];
  readonly startLocal: string;
  readonly endLocal: string;
  readonly timezone: string;
  readonly executionEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveWhatsappSendPolicyAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  const [rules, setRules] = useState<Rule[]>(() =>
    frequencyRules.length > 0
      ? frequencyRules.map((rule, key) => ({ key, windowHours: String(rule.windowHours), maxMessages: String(rule.maxMessages) }))
      : [{ key: 0, windowHours: "", maxMessages: "" }]
  );
  const [nextKey, setNextKey] = useState(Math.max(rules.length, 1));
  const [gateOn, setGateOn] = useState(executionEnabled);

  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-send-policy-form">
      <fieldset className="od-cp__rules" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="od-cp__panel-title">Frequency caps (per contact)</legend>
        {rules.map((rule, index) => (
          <div key={rule.key} className="od-cp__rule" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
            <label className="od-cp__field">
              <span>Max messages</span>
              <input
                name="maxMessages"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={rule.maxMessages}
                required
              />
            </label>
            <label className="od-cp__field">
              <span>Within hours (1–2160)</span>
              <input
                name="windowHours"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={rule.windowHours}
                required
              />
            </label>
            <button
              type="button"
              className="od-cp__btn od-cp__btn--quiet"
              disabled={rules.length <= 1}
              onClick={() => setRules((current) => current.filter((r) => r.key !== rule.key))}
              aria-label={`Remove frequency rule ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="od-cp__btn od-cp__btn--quiet"
            disabled={rules.length >= WHATSAPP_SEND_POLICY_MAX_RULES}
            onClick={() => {
              setRules((current) => [...current, { key: nextKey, windowHours: "", maxMessages: "" }]);
              setNextKey((key) => key + 1);
            }}
          >
            Add cap
          </button>
        </div>
      </fieldset>

      <fieldset className="od-cp__stack" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="od-cp__panel-title">Quiet hours</legend>
        <div className="od-cp__grid">
          <label className="od-cp__field">
            <span>Start</span>
            <input type="time" name="startLocal" defaultValue={startLocal} required />
          </label>
          <label className="od-cp__field">
            <span>End</span>
            <input type="time" name="endLocal" defaultValue={endLocal} required />
          </label>
          <label className="od-cp__field">
            <span>Timezone (IANA)</span>
            <input name="timezone" defaultValue={timezone} maxLength={80} required />
          </label>
        </div>
        <p className="od-cp__hint">No marketing message is sent between start and end. Start after end spans midnight.</p>
      </fieldset>

      <fieldset className="od-cp__stack" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="od-cp__panel-title">Execution gate</legend>
        <label className="od-cp__check">
          <input
            type="checkbox"
            name="executionEnabled"
            checked={gateOn}
            onChange={(event) => setGateOn(event.target.checked)}
          />
          <span>Allow approved WhatsApp marketing campaigns to execute</span>
        </label>
        {gateOn ? (
          <label className="od-cp__check">
            <input type="checkbox" name="confirmExecution" required />
            <span>
              I confirm campaigns may start sending under this policy. Consent, opt-outs, caps and quiet hours still apply
              to every recipient.
            </span>
          </label>
        ) : null}
      </fieldset>

      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Publish new version"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}
