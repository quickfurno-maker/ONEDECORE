"use client";

import { useActionState } from "react";
import {
  WHATSAPP_MARKETING_CONSENT_CHANNELS,
  WHATSAPP_MARKETING_CONSENT_CHANNEL_LABELS,
  WHATSAPP_MARKETING_CONSENT_INSTRUCTION_LABELS,
  WHATSAPP_MARKETING_CONSENT_INSTRUCTION_SOURCES,
  WHATSAPP_MARKETING_PREFERENCE_CATEGORIES,
  WHATSAPP_MARKETING_PREFERENCE_LABELS,
} from "../../contracts/contacts-compliance.ts";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import {
  recordWhatsappMarketingConsentGrantAction,
  recordWhatsappMarketingOptOutAction,
  recordWhatsappMarketingPreferenceAction,
} from "../../server/whatsapp-contacts-actions.ts";
import { ControlPlaneActionMessage } from "./ControlPlaneActionMessage.tsx";
import "./control-plane.css";

/**
 * Compliance controls. Opt-out/preferences are restrictive. P5 adds an
 * evidence recorder for an explicit customer MARKETING instruction: the staff
 * member must identify how the instruction arrived, provide a bounded note and
 * confirm that consent was not inferred from service activity.
 */

export function MarketingOptOutForm({
  contactId,
  conversationId = null,
  compact = false,
}: {
  readonly contactId: string;
  readonly conversationId?: string | null;
  readonly compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    recordWhatsappMarketingOptOutAction,
    INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE
  );
  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-opt-out-form">
      <input type="hidden" name="contactId" value={contactId} />
      {conversationId ? <input type="hidden" name="conversationId" value={conversationId} /> : null}
      {compact ? null : (
        <p className="od-cp__hint">
          Records that the customer asked to stop marketing messages. Service replies in the inbox are not affected.
        </p>
      )}
      <label className="od-cp__check">
        <input type="checkbox" name="confirm" value="yes" required />
        <span>The customer asked to stop marketing on WhatsApp</span>
      </label>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--danger" disabled={pending || state.success}>
          {pending ? "Recording…" : "Record marketing opt-out"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function MarketingConsentEvidenceForm({ contactId }: { readonly contactId: string }) {
  const [state, action, pending] = useActionState(
    recordWhatsappMarketingConsentGrantAction,
    INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE
  );
  return (
    <form action={action} className="od-cp__stack" data-testid="marketing-consent-evidence-form">
      <input type="hidden" name="contactId" value={contactId} />
      <p className="od-cp__hint">
        Use only when the customer explicitly opted in to optional ONEDECORE marketing.
        A website enquiry, service consent or an existing WhatsApp conversation is never enough.
      </p>
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Permission channel</span>
          <select name="channel" defaultValue="whatsapp" required>
            {WHATSAPP_MARKETING_CONSENT_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {WHATSAPP_MARKETING_CONSENT_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
        </label>
        <label className="od-cp__field">
          <span>Evidence source</span>
          <select name="instructionSource" defaultValue="whatsapp_message" required>
            {WHATSAPP_MARKETING_CONSENT_INSTRUCTION_SOURCES.map((source) => (
              <option key={source} value={source}>
                {WHATSAPP_MARKETING_CONSENT_INSTRUCTION_LABELS[source]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="od-cp__field od-cp__field--wide">
        <span>Evidence note</span>
        <textarea
          name="note"
          minLength={8}
          maxLength={500}
          required
          rows={3}
          placeholder="Example: Customer replied YES to optional offers and design inspiration."
        />
      </label>
      <label className="od-cp__check">
        <input type="checkbox" name="confirmExplicit" value="yes" required />
        <span>I am recording an explicit customer opt-in, not inferring consent from service activity.</span>
      </label>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--primary" disabled={pending || state.success}>
          {pending ? "Recording…" : "Record explicit marketing consent"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}

export function MarketingPreferenceForm({ contactId }: { readonly contactId: string }) {
  const [state, action, pending] = useActionState(
    recordWhatsappMarketingPreferenceAction,
    INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE
  );
  return (
    <form action={action} className="od-cp__stack" data-testid="whatsapp-preference-form">
      <input type="hidden" name="contactId" value={contactId} />
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Category</span>
          <select name="category" defaultValue="" required>
            <option value="" disabled>
              Choose…
            </option>
            {WHATSAPP_MARKETING_PREFERENCE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {WHATSAPP_MARKETING_PREFERENCE_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="od-cp__field">
          <span>Preference</span>
          <select name="eventType" defaultValue="opted_out">
            <option value="opted_out">Stop this category</option>
            <option value="allowed">Resume this category</option>
          </select>
        </label>
      </div>
      <p className="od-cp__hint">Resuming a category never grants MARKETING consent.</p>
      <div>
        <button type="submit" className="od-cp__btn" disabled={pending}>
          {pending ? "Saving…" : "Save preference"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}
