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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5" aria-live="polite">
      <PrebuildBanner />
      <h2 className="mt-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        MARKETING consent
      </h2>
      <p className="mt-2 text-sm text-neutral-200">Current MARKETING state: {currentLabel}</p>
      {state?.latestOccurredAt ? (
        <p className="text-xs text-neutral-500">Last event {state.latestOccurredAt}</p>
      ) : null}
      {state?.dnc ? (
        <p role="status" className="mt-2 text-sm text-amber-200">
          DNC is active. A MARKETING grant does not authorize outreach.
        </p>
      ) : null}
      {state?.emailSuppressed || state?.whatsappSuppressed ? (
        <p role="status" className="mt-2 text-sm text-amber-200">
          Channel suppression is active and remains independent of MARKETING consent.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-neutral-500">
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
        <label className="block text-xs text-neutral-400">
          Event
          <select name="eventType" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100">
            <option value="granted">granted</option>
            <option value="withdrawn">withdrawn</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Capture channel
          <select name="channel" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100">
            <option value="phone">phone</option>
            <option value="email">email</option>
            <option value="whatsapp">whatsapp</option>
            <option value="in-person">in-person</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Instruction source
          <select name="instructionSource" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100">
            <option value="phone_call">phone_call</option>
            <option value="email">email</option>
            <option value="whatsapp_message">whatsapp_message</option>
            <option value="in_person">in_person</option>
            <option value="other">other</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Copy version
          <input name="copyVersion" required maxLength={120} defaultValue="marketing-copy-v1" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
        </label>
        <label className="block text-xs text-neutral-400">
          Notice version
          <input name="noticeVersion" required maxLength={120} defaultValue="marketing-notice-v1" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
        </label>
        <label className="block text-xs text-neutral-400">
          Note
          <textarea name="note" maxLength={500} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
        </label>
        {message ? <p className="text-sm text-amber-200">{message}</p> : null}
        <button type="submit" className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">
          Record instruction evidence
        </button>
      </form>
    </section>
  );
}
