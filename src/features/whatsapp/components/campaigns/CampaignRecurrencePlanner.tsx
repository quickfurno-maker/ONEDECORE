"use client";

import { useMemo, useState } from "react";
import {
  buildWhatsappRecurrenceOccurrences,
  whatsappRecurrenceCadenceLabel,
  whatsappRecurrenceWarnings,
  WHATSAPP_RECURRENCE_CADENCES,
  type WhatsappRecurrenceCadence,
} from "../../contracts/campaign-recurrence";
import type { WhatsappMarketingFrequencyRule } from "../../contracts/send-policy";
import { schedulerDateKey, schedulerTimeLabel } from "../../contracts/campaign-scheduler";

export function CampaignRecurrencePlanner({
  frequencyRules,
}: {
  readonly frequencyRules: readonly WhatsappMarketingFrequencyRule[];
}) {
  const [firstLocal, setFirstLocal] = useState("");
  const [cadence, setCadence] = useState<WhatsappRecurrenceCadence>("monthly");
  const [count, setCount] = useState(6);

  const firstIso = firstLocal
    ? new Date(firstLocal + ":00+05:30").toISOString()
    : "";

  const occurrences = useMemo(
    () =>
      firstIso
        ? buildWhatsappRecurrenceOccurrences({
            firstScheduledFor: firstIso,
            cadence,
            count,
          })
        : [],
    [firstIso, cadence, count]
  );
  const warnings = useMemo(
    () =>
      whatsappRecurrenceWarnings({
        occurrences,
        frequencyRules,
      }),
    [occurrences, frequencyRules]
  );

  return (
    <section className="od-cp__panel" aria-labelledby="whatsapp-recurrence-planner" data-testid="whatsapp-recurrence-planner">
      <div className="od-scheduler__section-head">
        <div>
          <p className="od-growth__eyebrow">Scheduler V2</p>
          <h2 id="whatsapp-recurrence-planner">Recurring campaign plan</h2>
          <p>
            Plan the series here. Every occurrence remains a separate campaign
            version with independent review and approval before it can be scheduled.
          </p>
        </div>
        <span className="od-cp__badge">One approval = one delivery</span>
      </div>

      <div className="od-cp__grid" style={{ marginBlockStart: 12 }}>
        <label className="od-cp__field">
          <span>First delivery · IST</span>
          <input
            type="datetime-local"
            value={firstLocal}
            onChange={(event) => setFirstLocal(event.target.value)}
          />
        </label>
        <label className="od-cp__field">
          <span>Repeat</span>
          <select
            value={cadence}
            onChange={(event) => setCadence(event.target.value as WhatsappRecurrenceCadence)}
          >
            {WHATSAPP_RECURRENCE_CADENCES.map((option) => (
              <option key={option} value={option}>
                {whatsappRecurrenceCadenceLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="od-cp__field">
          <span>Occurrences</span>
          <input
            type="number"
            min={2}
            max={24}
            value={count}
            onChange={(event) => setCount(Math.min(24, Math.max(2, Number(event.target.value) || 2)))}
          />
        </label>
      </div>

      {warnings.length > 0 ? (
        <div className="od-cp__stack" style={{ marginBlockStart: 12 }}>
          {warnings.map((warning) => (
            <p key={warning.code + warning.message} className="od-cp__notice" data-tone="warning">
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}

      {occurrences.length > 0 ? (
        <ol className="od-cp__list" style={{ marginBlockStart: 12 }}>
          {occurrences.map((iso, index) => (
            <li key={iso}>
              <div className="od-cp__list-item">
                <span className="od-cp__list-row">
                  <strong>Occurrence {index + 1}</strong>
                  <span className="od-cp__badge">
                    {schedulerDateKey(iso)} · {schedulerTimeLabel(iso)}
                  </span>
                </span>
                <span className="od-cp__sub">
                  Prepare/approve its campaign version before placing this date on the live calendar.
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="od-cp__hint" style={{ marginBlockStart: 12 }}>
          Choose the first IST delivery time to preview the recurrence plan and frequency-cap warnings.
        </p>
      )}

      <p className="od-cp__hint" style={{ marginBlockStart: 10 }}>
        Frequency caps are still enforced again per recipient at send time. This planner only warns in advance;
        it never overrides consent, DNC, quiet hours, template approval or final CRM eligibility.
      </p>
    </section>
  );
}
