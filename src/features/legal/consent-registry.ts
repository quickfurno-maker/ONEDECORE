/**
 * Consent purpose registry and versioning.
 * Lead-path v1.0 copies are owner-approved and effective from 2026-08-25.
 */

export type ConsentPurposeCode =
  | "SERVICE_ENQUIRY"
  | "SERVICE_COMMUNICATION"
  | "WHATSAPP_SERVICE"
  | "MARKETING"
  | "AI_ASSISTANCE_DISCLOSURE"
  | "PORTFOLIO_MEDIA";

export type ConsentVersionStatus = "draft-review" | "approved" | "retired";

export type ConsentChannel =
  | "website-form"
  | "email"
  | "phone"
  | "whatsapp"
  | "in-person"
  | "portfolio-cms";

export interface ConsentApprovalRecord {
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly reference: string | null;
}

export interface ConsentVersion {
  readonly version: string;
  readonly title: string;
  readonly conciseCopy: string;
  readonly expandedNotice: string;
  readonly purposeCode: ConsentPurposeCode;
  readonly channels: readonly ConsentChannel[];
  readonly required: boolean;
  readonly defaultChecked: boolean;
  readonly status: ConsentVersionStatus;
  readonly effectiveFrom: string | null;
  readonly retiredAt: string | null;
  readonly ownerApproval: ConsentApprovalRecord | null;
  readonly legalApproval: ConsentApprovalRecord | null;
}

/** Future record contract — types only; no DB or migrations. */
export type ConsentRecordStatus =
  | "granted"
  | "withdrawn"
  | "suppressed"
  | "expired";

export interface ConsentRecordContract {
  readonly consentId: string;
  readonly contactId: string;
  readonly purposeCode: ConsentPurposeCode;
  readonly channel: ConsentChannel;
  readonly status: ConsentRecordStatus;
  readonly copyVersion: string;
  readonly noticeVersion: string;
  readonly source: string;
  readonly locale: string;
  readonly capturedAt: string;
  readonly withdrawnAt: string | null;
  readonly evidenceReference: string | null;
  readonly campaignCategories: readonly string[] | null;
  readonly actor: string;
  readonly metadataVersion: string;
}

const OWNER_APPROVAL_PR92: ConsentApprovalRecord = {
  approvedBy: "ONEDECORE owner",
  approvedAt: "2026-08-25",
  reference:
    "PR #92 owner APPROVE of published-mode package at 2609bbca1ba661989fd0e8f468b0724a47adcd5d",
};

/**
 * Aggregate registry status for non-lead draft purposes.
 * Lead-path v1.0 entries use status "approved" with effectiveFrom 2026-08-25.
 */
export const CONSENT_REGISTRY_STATUS: ConsentVersionStatus = "draft-review";

export const CONSENT_VERSIONS: readonly ConsentVersion[] = [
  {
    version: "service-enquiry-v1.0",
    title: "Service enquiry processing",
    conciseCopy:
      "Process information you provide to understand and respond to your interior design enquiry.",
    expandedNotice:
      "When you submit an enquiry, ONEDECORE will use the personal data you provide — such as your name, contact details, property locality, service requirements and messages — to understand and respond to your request, administer the related enquiry, maintain the necessary CRM and consent records, and protect the service against misuse as described in the Privacy Notice. This consent does not cover optional marketing or separate channel permissions.",
    purposeCode: "SERVICE_ENQUIRY",
    channels: ["website-form", "email", "phone", "in-person"],
    required: true,
    defaultChecked: false,
    status: "approved",
    effectiveFrom: "2026-08-25",
    retiredAt: null,
    ownerApproval: OWNER_APPROVAL_PR92,
    legalApproval: null,
  },
  {
    version: "service-communication-v1.0",
    title: "Service communication",
    conciseCopy:
      "Contact you about consultation, estimates, site visits, proposals or active project coordination.",
    expandedNotice:
      "ONEDECORE may use your contact details for operational communication related to your enquiry or project — including scheduling, estimates, site visits, design discussions, proposals and delivery coordination. This is separate from optional marketing consent and from channel-specific WhatsApp permission.",
    purposeCode: "SERVICE_COMMUNICATION",
    channels: ["email", "phone", "in-person"],
    required: true,
    defaultChecked: false,
    status: "approved",
    effectiveFrom: "2026-08-25",
    retiredAt: null,
    ownerApproval: OWNER_APPROVAL_PR92,
    legalApproval: null,
  },
  {
    version: "whatsapp-service-v1.0",
    title: "WhatsApp service communication",
    conciseCopy:
      "Send and receive WhatsApp messages for service-related communication about your enquiry or project.",
    expandedNotice:
      "WhatsApp is a separate channel requiring explicit permission. If you opt in, ONEDECORE may use WhatsApp for service-related messages such as consultation updates, site-visit coordination and project communication. Outbound WhatsApp sending is a separate activation concern from storing this consent. Marketing messages require separate optional consent.",
    purposeCode: "WHATSAPP_SERVICE",
    channels: ["whatsapp"],
    required: false,
    defaultChecked: false,
    status: "approved",
    effectiveFrom: "2026-08-25",
    retiredAt: null,
    ownerApproval: OWNER_APPROVAL_PR92,
    legalApproval: null,
  },
  {
    version: "service-enquiry-v0.1-draft",
    title: "Service enquiry processing (retired draft)",
    conciseCopy:
      "Process information you provide to understand and respond to your interior design enquiry.",
    expandedNotice:
      "When you submit an enquiry, ONEDECORE will use the personal data you provide — such as your name, contact details, property locality, service requirements and messages — to understand and respond to your request, administer the related enquiry, maintain the necessary CRM and consent records, and protect the service against misuse as described in the Privacy Notice. This consent does not cover optional marketing or separate channel permissions.",
    purposeCode: "SERVICE_ENQUIRY",
    channels: ["website-form", "email", "phone", "in-person"],
    required: true,
    defaultChecked: false,
    status: "retired",
    effectiveFrom: null,
    retiredAt: "2026-08-25",
    ownerApproval: null,
    legalApproval: null,
  },
  {
    version: "service-communication-v0.1-draft",
    title: "Service communication (retired draft)",
    conciseCopy:
      "Contact you about consultation, estimates, site visits, proposals or active project coordination.",
    expandedNotice:
      "ONEDECORE may use your contact details for operational communication related to your enquiry or project — including scheduling, estimates, site visits, design discussions, proposals and delivery coordination. This is separate from optional marketing consent and from channel-specific WhatsApp permission.",
    purposeCode: "SERVICE_COMMUNICATION",
    channels: ["email", "phone", "in-person"],
    required: true,
    defaultChecked: false,
    status: "retired",
    effectiveFrom: null,
    retiredAt: "2026-08-25",
    ownerApproval: null,
    legalApproval: null,
  },
  {
    version: "whatsapp-service-v0.1-draft",
    title: "WhatsApp service communication (retired draft)",
    conciseCopy:
      "Send and receive WhatsApp messages for service-related communication about your enquiry or project.",
    expandedNotice:
      "WhatsApp is a separate channel requiring explicit permission. If you opt in, ONEDECORE may use WhatsApp for service-related messages such as consultation updates, site-visit coordination and project communication. Outbound WhatsApp sending is a separate activation concern from storing this consent. Marketing messages require separate optional consent.",
    purposeCode: "WHATSAPP_SERVICE",
    channels: ["whatsapp"],
    required: false,
    defaultChecked: false,
    status: "retired",
    effectiveFrom: null,
    retiredAt: "2026-08-25",
    ownerApproval: null,
    legalApproval: null,
  },
  {
    version: "marketing-v0.1-draft",
    title: "Marketing communications",
    conciseCopy:
      "Send optional updates about offers, new services, events or inspiration you may find relevant.",
    expandedNotice:
      "Marketing communications are optional and not required to receive service. You may opt in to hear about offers, new services, events or interior inspiration. Accepting Privacy Policy or Terms of Use does not constitute marketing consent. Marketing checkboxes must not be pre-ticked.",
    purposeCode: "MARKETING",
    channels: ["email", "whatsapp", "phone"],
    required: false,
    defaultChecked: false,
    status: "draft-review",
    effectiveFrom: null,
    retiredAt: null,
    ownerApproval: null,
    legalApproval: null,
  },
  {
    version: "ai-assistance-disclosure-v0.1-draft",
    title: "AI assistance disclosure",
    conciseCopy:
      "Some messages may be drafted or handled by ONEDECORE's AI consultation assistant. A team member can take over at any time.",
    expandedNotice:
      "This is a transparency disclosure, not blanket consent to automated decision-making. When AI-assisted consultation features are enabled in future, some messages may be drafted or initially handled by ONEDECORE's AI consultation assistant. A human team member can review, override or take over at any time. Groq processing is not live on the current website.",
    purposeCode: "AI_ASSISTANCE_DISCLOSURE",
    channels: ["website-form", "whatsapp", "email"],
    required: false,
    defaultChecked: false,
    status: "draft-review",
    effectiveFrom: null,
    retiredAt: null,
    ownerApproval: null,
    legalApproval: null,
  },
  {
    version: "portfolio-media-v0.1-draft",
    title: "Portfolio and media reuse",
    conciseCopy:
      "Use project images, descriptions, locality, name or testimonial content you approve for portfolio, website, advertising or social media.",
    expandedNotice:
      "Separate consent is required before ONEDECORE may publish or reuse client project images, descriptions, locality references, names, testimonials or similar media on the website, in advertising or on social channels. Portfolio display on the public website follows existing Portfolio publication rules and owner approval workflows.",
    purposeCode: "PORTFOLIO_MEDIA",
    channels: ["portfolio-cms", "website-form", "in-person"],
    required: false,
    defaultChecked: false,
    status: "draft-review",
    effectiveFrom: null,
    retiredAt: null,
    ownerApproval: null,
    legalApproval: null,
  },
] as const;

export const CONSENT_SEPARATION_RULES: readonly string[] = [
  "Marketing consent is optional and defaultChecked is false for all current versions.",
  "Privacy Policy and Terms acceptance do not constitute marketing consent.",
  "WhatsApp service communication requires separate channel-specific consent.",
  "SERVICE_COMMUNICATION never independently authorises WhatsApp.",
  "A WhatsApp service message requires both a valid service-communication purpose and active WHATSAPP_SERVICE channel permission.",
  "WhatsApp service consent is not marketing consent; marketing WhatsApp requires MARKETING in addition to channel eligibility.",
  "AI assistance disclosure is transparency, not blanket automated-processing consent.",
  "Portfolio media reuse requires separate consent from general service enquiry consent.",
  "No bundled channel consent or vague third-party contact permissions.",
  "Future withdrawal must be as easy as granting consent.",
  "Lead-path v1.0 consent versions are effective from owner-authorized production activation (2026-08-25).",
] as const;

export type CommunicationChannelEligibility = "email" | "phone" | "whatsapp" | "in-person";

export interface CommunicationChannelCheckInput {
  readonly serviceCommunicationStatus: ConsentRecordStatus;
  readonly channel: CommunicationChannelEligibility;
  readonly channelConsentStatus: ConsentRecordStatus | null;
  readonly marketingStatus?: ConsentRecordStatus | null;
  readonly requireMarketing?: boolean;
}

/**
 * Pure future contract: may a message be sent on a channel?
 * WhatsApp requires service communication + WHATSAPP_SERVICE (channelConsentStatus).
 * When requireMarketing is true, MARKETING must be granted for every channel.
 */
export function canUseCommunicationChannel(
  input: CommunicationChannelCheckInput
): boolean {
  const { serviceCommunicationStatus, channel, channelConsentStatus } = input;

  if (
    serviceCommunicationStatus === "withdrawn" ||
    serviceCommunicationStatus === "suppressed" ||
    serviceCommunicationStatus === "expired"
  ) {
    return false;
  }

  if (serviceCommunicationStatus !== "granted") {
    return false;
  }

  if (input.requireMarketing) {
    const marketing = input.marketingStatus;
    if (
      marketing == null ||
      marketing === "withdrawn" ||
      marketing === "suppressed" ||
      marketing === "expired" ||
      marketing !== "granted"
    ) {
      return false;
    }
  }

  if (channel === "whatsapp") {
    if (channelConsentStatus == null) {
      return false;
    }
    if (
      channelConsentStatus === "withdrawn" ||
      channelConsentStatus === "suppressed" ||
      channelConsentStatus === "expired"
    ) {
      return false;
    }
    return channelConsentStatus === "granted";
  }

  if (channelConsentStatus == null) {
    return true;
  }
  if (
    channelConsentStatus === "withdrawn" ||
    channelConsentStatus === "suppressed" ||
    channelConsentStatus === "expired"
  ) {
    return false;
  }
  return channelConsentStatus === "granted";
}

export function getConsentVersionByPurpose(
  purposeCode: ConsentPurposeCode,
  versions: readonly ConsentVersion[] = CONSENT_VERSIONS
): ConsentVersion | undefined {
  const active = versions.find(
    (version) =>
      version.purposeCode === purposeCode && version.status !== "retired"
  );
  if (active) return active;
  return versions.find((version) => version.purposeCode === purposeCode);
}

/**
 * Current display / candidate mapping.
 * Lead-path IDs are owner-approved v1.0 (not yet effective).
 * Marketing / AI / portfolio remain draft-review.
 */
export const CURRENT_CONSENT_VERSION_IDS: Readonly<
  Record<ConsentPurposeCode, string>
> = {
  SERVICE_ENQUIRY: "service-enquiry-v1.0",
  SERVICE_COMMUNICATION: "service-communication-v1.0",
  WHATSAPP_SERVICE: "whatsapp-service-v1.0",
  MARKETING: "marketing-v0.1-draft",
  AI_ASSISTANCE_DISCLOSURE: "ai-assistance-disclosure-v0.1-draft",
  PORTFOLIO_MEDIA: "portfolio-media-v0.1-draft",
};

/**
 * Resolve the explicitly mapped current consent version for a purpose.
 * Throws when the mapping is missing, points at the wrong purpose, duplicates,
 * or cannot be found in the registry.
 *
 * Note: "current" may be owner-approved but still not effective.
 * Use isConsentVersionEffective / getEffectiveConsentVersionByPurpose for evidence.
 */
export function getCurrentConsentVersionByPurpose(
  purposeCode: ConsentPurposeCode,
  versions: readonly ConsentVersion[] = CONSENT_VERSIONS,
  currentIds: Readonly<Record<ConsentPurposeCode, string>> = CURRENT_CONSENT_VERSION_IDS
): ConsentVersion {
  const mappedId = currentIds[purposeCode];
  if (!mappedId) {
    throw new Error(
      `[ONEDECORE Consent] Missing current version mapping for ${purposeCode}.`
    );
  }

  const idValues = Object.values(currentIds);
  if (new Set(idValues).size !== idValues.length) {
    throw new Error(
      "[ONEDECORE Consent] Duplicate current consent version IDs in mapping."
    );
  }

  const matches = versions.filter((version) => version.version === mappedId);
  if (matches.length === 0) {
    throw new Error(
      `[ONEDECORE Consent] Current version ${mappedId} not found for ${purposeCode}.`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `[ONEDECORE Consent] Duplicate registry entries for version ${mappedId}.`
    );
  }

  const version = matches[0]!;
  if (version.purposeCode !== purposeCode) {
    throw new Error(
      `[ONEDECORE Consent] Current version ${mappedId} has purpose ${version.purposeCode}, expected ${purposeCode}.`
    );
  }

  return version;
}

/** Owner-approved (or published) and effectiveFrom set to a real calendar date. */
export function isConsentVersionEffective(version: ConsentVersion): boolean {
  if (version.status === "retired") return false;
  if (version.status !== "approved") return false;
  if (version.effectiveFrom == null || version.effectiveFrom.trim() === "") {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(version.effectiveFrom.trim());
}

export function isConsentVersionOwnerApprovedNotEffective(
  version: ConsentVersion
): boolean {
  return (
    version.status === "approved" &&
    version.ownerApproval != null &&
    version.legalApproval == null &&
    !isConsentVersionEffective(version)
  );
}

/**
 * Production consent evidence must use effective versions only.
 * Fail-closed while owner-approved v1.0 remains pre-activation.
 */
export function getEffectiveConsentVersionByPurpose(
  purposeCode: ConsentPurposeCode,
  versions: readonly ConsentVersion[] = CONSENT_VERSIONS,
  currentIds: Readonly<Record<ConsentPurposeCode, string>> = CURRENT_CONSENT_VERSION_IDS
): ConsentVersion {
  const version = getCurrentConsentVersionByPurpose(
    purposeCode,
    versions,
    currentIds
  );
  if (!isConsentVersionEffective(version)) {
    throw new Error(
      `[ONEDECORE Consent] Version ${version.version} for ${purposeCode} is not effective (approved-but-not-effective or draft).`
    );
  }
  return version;
}

export const LEAD_PATH_CONSENT_PURPOSES = [
  "SERVICE_ENQUIRY",
  "SERVICE_COMMUNICATION",
  "WHATSAPP_SERVICE",
] as const satisfies readonly ConsentPurposeCode[];

export function areLeadPathConsentVersionsEffective(
  versions: readonly ConsentVersion[] = CONSENT_VERSIONS,
  currentIds: Readonly<Record<ConsentPurposeCode, string>> = CURRENT_CONSENT_VERSION_IDS
): boolean {
  return LEAD_PATH_CONSENT_PURPOSES.every((purpose) => {
    try {
      getEffectiveConsentVersionByPurpose(purpose, versions, currentIds);
      return true;
    } catch {
      return false;
    }
  });
}

export function marketingConsentIsOptional(
  versions: readonly ConsentVersion[] = CONSENT_VERSIONS
): boolean {
  const marketing = getConsentVersionByPurpose("MARKETING", versions);
  return marketing != null && !marketing.required && !marketing.defaultChecked;
}

export function serviceCommunicationExcludesWhatsApp(
  versions: readonly ConsentVersion[] = CONSENT_VERSIONS
): boolean {
  const service = getConsentVersionByPurpose("SERVICE_COMMUNICATION", versions);
  return Boolean(service && !service.channels.includes("whatsapp"));
}
