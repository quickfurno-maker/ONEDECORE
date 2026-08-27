"use client";

import { useState } from "react";
import { recordMarketingConsentAction } from "../server/campaign-actions";
import type { MarketingConsentState } from "../server/campaign-queries";
import { PrebuildBanner } from "./PrebuildBanner";

interface MarketingConsentPanelProps {
  readonly leadId: string;
  readonly contactId: string;
  readonly canManage: boolean;
  readonly state: MarketingConsentState | null;
}

const fieldClass =
  "crm-input mt-1 w-full text-base sm:text-sm";

export function MarketingConsentPanel({
  leadId,
  contactId,
  canManage,
  state,
}: MarketingConsentPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  if (!canManage) return null;

  const currentLabel = state?.currentGranted ? "granted" : state?.latestEventType ?? "not granted";

  return (
    <section className="crm-surface p-4 sm:p-5" aria-live="polite">
      <PrebuildBanner />
      <h2 className="mt-3 text-sm font-semibold text-[var(--crm-text)] sm:text-[15px]">
        Marketing consent
      </h2>
      <p className="mt-2 text-sm text-[var(--crm-text-secondary)]">
        Current MARKETING state: {currentLabel}
      </p>
      {state?.latestOccurredAt ? (
        <p className="text-[12px] text-[var(--crm-muted)]">Last event {state.latestOccurredAt}</p>
      ) : null}
      {state?.dnc ? (
        <p
          role="status"
          className="mt-2 rounded-md border border-[var(--crm-warning)]/25 bg-[var(--crm-warning-soft)] px-3 py-2 text-sm text-[var(--crm-warning)]"
        >
          DNC is active. A MARKETING grant does not authorize outreach.
        </p>
      ) : null}
      {state?.emailSuppressed || state?.whatsappSuppressed ? (
        <p
          role="status"
          className="mt-2 rounded-md border border-[var(--crm-warning)]/25 bg-[var(--crm-warning-soft)] px-3 py-2 text-sm text-[var(--crm-warning)]"
        >
          Channel suppression is active and remains independent of MARKETING consent.
        </p>
      ) : null}
      <p className="mt-3 text-[12px] leading-5 text-[var(--crm-muted)]">
        This records evidence of an actual customer instruction. It does not bypass DNC and does not send marketing.
      </p>
      <form
        className="mt-4 space-y-3"
        action={async (formData) => {
          const result = await recordMarketingConsentAction(formData);
          setMessage(result.message);
        }}
      >
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="contactId" value={contactId} />
        <label className="block text-[13px] font-medium text-[var(--crm-text-secondary)]">
          Event
          <select name="eventType" className={fieldClass}>
            <option value="granted">granted</option>
            <option value="withdrawn">withdrawn</option>
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[var(--crm-text-secondary)]">
          Capture channel
          <select name="channel" className={fieldClass}>
            <option value="phone">phone</option>
            <option value="email">email</option>
            <option value="whatsapp">whatsapp</option>
            <option value="in-person">in-person</option>
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[var(--crm-text-secondary)]">
          Instruction source
          <select name="instructionSource" className={fieldClass}>
            <option value="phone_call">phone_call</option>
            <option value="email">email</option>
            <option value="whatsapp_message">whatsapp_message</option>
            <option value="in_person">in_person</option>
            <option value="other">other</option>
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[var(--crm-text-secondary)]">
          Copy version
          <input
            name="copyVersion"
            required
            maxLength={120}
            defaultValue="marketing-copy-v1"
            className={fieldClass}
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--crm-text-secondary)]">
          Notice version
          <input
            name="noticeVersion"
            required
            maxLength={120}
            defaultValue="marketing-notice-v1"
            className={fieldClass}
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--crm-text-secondary)]">
          Note
          <textarea name="note" maxLength={500} rows={3} className={fieldClass} />
        </label>
        {message ? (
          <p className="text-sm text-[var(--crm-warning)]" role="status">
            {message}
          </p>
        ) : null}
        <button type="submit" className="crm-btn crm-btn-primary min-h-11 w-full sm:w-auto">
          Record instruction evidence
        </button>
      </form>
    </section>
  );
}
