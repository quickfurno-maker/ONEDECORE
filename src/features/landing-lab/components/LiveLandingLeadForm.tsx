"use client";

import { useMemo, useState } from "react";
import type { LeadFormPlaceholderBlock } from "../contracts/blocks.ts";
import type { SignedPublicationContext } from "../contracts/publication-context.ts";
import { collectLeadFormAttribution } from "@/features/lead-intake/public/lead-form-attribution.ts";
import {
  getServiceCommunicationConsentCopy,
  getServiceEnquiryConsentCopy,
  LEAD_INTAKE_NOTICE_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
} from "@/features/lead-intake/public/lead-form-contract.ts";
import {
  LEAD_INTAKE_PLANNER_VERSION,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
} from "@/features/lead-intake/contracts.ts";

interface LiveLandingLeadFormProps {
  readonly block: LeadFormPlaceholderBlock;
  readonly signedContext: SignedPublicationContext;
  readonly campaignExecutionContext?: unknown;
}

export function LiveLandingLeadForm({
  block,
  signedContext,
  campaignExecutionContext,
}: LiveLandingLeadFormProps) {
  const startedAt = useMemo(() => new Date().toISOString(), []);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const enquiryCopy = getServiceEnquiryConsentCopy();
  const communicationCopy = getServiceCommunicationConsentCopy();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rooms = form.getAll("rooms").map(String);
    const body = {
      idempotencyKey: crypto.randomUUID(),
      plannerVersion: LEAD_INTAKE_PLANNER_VERSION,
      contact: {
        name: String(form.get("name") ?? ""),
        mobile: String(form.get("mobile") ?? ""),
      },
      requirements: {
        service: String(form.get("service") ?? ""),
        property: String(form.get("property") ?? ""),
        timeline: String(form.get("timeline") ?? ""),
        rooms,
        locality: String(form.get("locality") ?? "") || undefined,
        message: String(form.get("message") ?? "") || undefined,
      },
      consent: {
        serviceEnquiry: true,
        serviceChannels: { phone: true },
        serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
        serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
        noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
      },
      attribution: collectLeadFormAttribution(),
      antiBot: {
        website: String(form.get("website") ?? ""),
        formStartedAt: startedAt,
      },
      landingPublicationContext: signedContext,
      campaignExecutionContext: campaignExecutionContext ?? undefined,
    };
    setStatus("submitting");
    try {
      const response = await fetch("/api/public/lead-intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || json.ok === false) {
        setStatus("error");
        setMessage(json.message || "Enquiry could not be submitted.");
        return;
      }
      setStatus("success");
      setMessage("Thank you. Your enquiry has been received.");
    } catch {
      setStatus("error");
      setMessage("Enquiry could not be submitted.");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-100" role="status">
        {message}
      </p>
    );
  }

  return (
    <form className="space-y-4 rounded border border-neutral-800 p-4" onSubmit={onSubmit}>
      <h2 className="text-lg font-medium text-neutral-100">{block.headline}</h2>
      {block.helperText ? <p className="text-sm text-neutral-400">{block.helperText}</p> : null}
      <label className="block text-sm text-neutral-300">
        Name
        <input required name="name" minLength={2} maxLength={120} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" />
      </label>
      <label className="block text-sm text-neutral-300">
        Mobile
        <input required name="mobile" maxLength={20} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" />
      </label>
      <label className="block text-sm text-neutral-300">
        Service
        <select required name="service" defaultValue="" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2">
          <option value="" disabled>
            Select service
          </option>
          {LEAD_SERVICE_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-neutral-300">
        Property
        <select required name="property" defaultValue="" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2">
          <option value="" disabled>
            Select property
          </option>
          {LEAD_PROPERTY_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-neutral-300">
        Timeline
        <select required name="timeline" defaultValue="" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2">
          <option value="" disabled>
            Select timeline
          </option>
          {LEAD_TIMELINE_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="text-sm text-neutral-300">
        <legend>Rooms (optional)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LEAD_ROOM_CODES.map((code) => (
            <label key={code} className="flex items-center gap-2">
              <input type="checkbox" name="rooms" value={code} />
              {code}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm text-neutral-300">
        Locality
        <input name="locality" maxLength={120} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" />
      </label>
      <label className="block text-sm text-neutral-300">
        Message
        <textarea name="message" maxLength={2000} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-2 text-xs text-neutral-400">
        <input type="checkbox" required name="serviceEnquiry" value="true" />
        <span>{enquiryCopy}</span>
      </label>
      <p className="text-xs text-neutral-500">{communicationCopy}</p>
      <p className="text-xs text-neutral-600">Notice {LEAD_INTAKE_NOTICE_VERSION}. This form does not grant MARKETING consent.</p>
      {status === "error" ? (
        <p className="text-sm text-red-300" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950"
      >
        {status === "submitting" ? "Submitting…" : block.submitLabel}
      </button>
    </form>
  );
}
