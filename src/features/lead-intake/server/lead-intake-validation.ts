import "server-only";

import {
  ESTIMATOR_FINISHES,
  ESTIMATOR_SERVICES,
  type EstimatorFinishId,
  type EstimatorServiceId,
} from "../../public-site/home-r4/budget-config.ts";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_INTAKE_PLANNER_VERSIONS,
  PUBLIC_CONSULT_V3_PLANNER_VERSION,
  PUBLIC_CONSULT_V4_PLANNER_VERSION,
  v4RequiresScope,
  SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
  SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
  isBudgetRangeForScope,
  isLeadProjectScopeCode,
  serviceForProjectScope,
  type LeadProjectScopeCode,
  PUBLIC_CONSULT_V1_PLANNER_VERSION,
  PUBLIC_CONSULT_V2_PLANNER_VERSION,
  LEAD_QUALIFIER_KIND_BY_SERVICE,
  isAllowedLeadQualifier,
  propertyCodeFromQualifier,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
  type LeadBudgetComfortCode,
  type LeadPropertyCode,
  type LeadRoomCode,
  type LeadServiceCode,
  type LeadTimelineCode,
  type ValidatedLeadIntake,
} from "../contracts.ts";
import type { SignedPublicationContext } from "../../landing-lab/contracts/publication-context.ts";
import { LEAD_INTAKE_MAX_BODY_BYTES } from "./bounded-request-body.ts";
import { normalisePhoneToE164 } from "./phone-normalisation.ts";
import { isSafeSameSitePath } from "./same-site-path.ts";

export { LEAD_INTAKE_MAX_BODY_BYTES };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROOT_KEYS = new Set([
  "idempotencyKey",
  "plannerVersion",
  "contact",
  "requirements",
  "consent",
  "attribution",
  "antiBot",
  "landingPublicationContext",
  "campaignExecutionContext",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnsafeControlChars(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function parseSignedPublicationContext(
  raw: unknown,
  fields: string[]
): SignedPublicationContext | null {
  if (raw == null) return null;
  if (!isPlainObject(raw)) {
    fields.push("landingPublicationContext");
    return null;
  }
  rejectUnknownKeys(raw, new Set(["context", "signature"]), "landingPublicationContext", fields);
  const signature = asString(raw.signature);
  if (!signature || signature.length > 128 || !/^[0-9a-f]+$/i.test(signature)) {
    fields.push("landingPublicationContext.signature");
  }
  if (!isPlainObject(raw.context)) {
    fields.push("landingPublicationContext.context");
    return null;
  }
  const ctx = raw.context;
  rejectUnknownKeys(
    ctx,
    new Set([
      "publicationReference",
      "pageReference",
      "pageVersionNumber",
      "experimentReference",
      "variantKey",
      "campaignReference",
      "campaignVersionNumber",
      "issuedAt",
      "expiresAt",
    ]),
    "landingPublicationContext.context",
    fields
  );
  const publicationReference = asString(ctx.publicationReference);
  const pageReference = asString(ctx.pageReference);
  const issuedAt = asString(ctx.issuedAt);
  if (!publicationReference || !pageReference || !issuedAt) {
    fields.push("landingPublicationContext.context");
    return null;
  }
  if (typeof ctx.pageVersionNumber !== "number" || !Number.isInteger(ctx.pageVersionNumber)) {
    fields.push("landingPublicationContext.context.pageVersionNumber");
    return null;
  }
  return {
    signature: signature ?? "",
    context: {
      publicationReference,
      pageReference,
      pageVersionNumber: ctx.pageVersionNumber,
      experimentReference: ctx.experimentReference == null ? null : asString(ctx.experimentReference),
      variantKey: ctx.variantKey == null ? null : asString(ctx.variantKey),
      campaignReference: ctx.campaignReference == null ? null : asString(ctx.campaignReference),
      campaignVersionNumber:
        ctx.campaignVersionNumber == null
          ? null
          : typeof ctx.campaignVersionNumber === "number"
            ? ctx.campaignVersionNumber
            : null,
      issuedAt,
      expiresAt: ctx.expiresAt == null ? null : asString(ctx.expiresAt),
    },
  };
}

function parseSignedCampaignExecutionContext(
  raw: unknown,
  fields: string[]
): import("../../marketing/execution/server/execution-context-crypto.ts").SignedCampaignExecutionContext | null {
  if (raw == null) return null;
  if (!isPlainObject(raw)) {
    fields.push("campaignExecutionContext");
    return null;
  }
  rejectUnknownKeys(raw, new Set(["context", "signature"]), "campaignExecutionContext", fields);
  const signature = asString(raw.signature);
  if (!signature || signature.length > 128 || !/^[0-9a-f]+$/i.test(signature)) {
    fields.push("campaignExecutionContext.signature");
  }
  if (!isPlainObject(raw.context)) {
    fields.push("campaignExecutionContext.context");
    return null;
  }
  const ctx = raw.context;
  rejectUnknownKeys(
    ctx,
    new Set([
      "version",
      "runReference",
      "runTargetReference",
      "providerChannel",
      "campaignReference",
      "campaignVersionNumber",
      "landingPublicationReference",
      "issuedAt",
      "expiresAt",
    ]),
    "campaignExecutionContext.context",
    fields
  );
  const runReference = asString(ctx.runReference);
  const runTargetReference = asString(ctx.runTargetReference);
  const providerChannel = asString(ctx.providerChannel);
  const campaignReference = asString(ctx.campaignReference);
  const issuedAt = asString(ctx.issuedAt);
  const expiresAt = asString(ctx.expiresAt);
  if (
    !runReference ||
    !runTargetReference ||
    (providerChannel !== "meta_ads" && providerChannel !== "google_ads") ||
    !campaignReference ||
    !issuedAt ||
    !expiresAt ||
    ctx.version !== 1 ||
    typeof ctx.campaignVersionNumber !== "number"
  ) {
    fields.push("campaignExecutionContext.context");
    return null;
  }
  return {
    signature: signature ?? "",
    context: {
      version: 1,
      runReference,
      runTargetReference,
      providerChannel,
      campaignReference,
      campaignVersionNumber: ctx.campaignVersionNumber,
      landingPublicationReference:
        ctx.landingPublicationReference == null ? null : asString(ctx.landingPublicationReference),
      issuedAt,
      expiresAt,
    },
  };
}

function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  prefix: string,
  fields: string[]
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      fields.push(`${prefix}.${key}`);
    }
  }
}

function normaliseWhitespace(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function validateEstimate(
  raw: unknown,
  fields: string[]
): Record<string, unknown> | null {
  if (raw == null) return null;
  if (!isPlainObject(raw)) {
    fields.push("requirements.estimate");
    return null;
  }

  const allowed = new Set([
    "estimatorService",
    "estimatorSize",
    "finish",
    "min",
    "max",
    "openEnded",
  ]);
  rejectUnknownKeys(raw, allowed, "requirements.estimate", fields);

  const estimatorService = asString(raw.estimatorService);
  const estimatorSize = asString(raw.estimatorSize);
  const finish = asString(raw.finish);
  const min = raw.min;
  const max = raw.max;
  const openEnded = raw.openEnded;

  const service = ESTIMATOR_SERVICES.find((s) => s.id === estimatorService);
  const finishDef = ESTIMATOR_FINISHES.find((f) => f.id === finish);
  if (!service || !finishDef || !estimatorSize) {
    fields.push("requirements.estimate");
    return null;
  }

  const size = service.sizes.find((s) => s.id === estimatorSize);
  if (!size) {
    fields.push("requirements.estimate");
    return null;
  }

  if (typeof min !== "number" || typeof max !== "number") {
    // Do not trust client numbers — store null on mismatch.
    return null;
  }

  const expectedMin = Math.round(size.range.min * finishDef.multiplier);
  const expectedMax = Math.round(size.range.max * finishDef.multiplier);
  if (min !== expectedMin || max !== expectedMax) {
    return null;
  }

  if (openEnded != null && openEnded !== Boolean((size.range as { openEnded?: boolean }).openEnded)) {
    return null;
  }

  return {
    estimatorService: service.id as EstimatorServiceId,
    estimatorSize,
    finish: finishDef.id as EstimatorFinishId,
    min: expectedMin,
    max: expectedMax,
    openEnded: Boolean((size.range as { openEnded?: boolean }).openEnded),
  };
}

export type ValidationResult =
  | { readonly ok: true; readonly value: ValidatedLeadIntake }
  | { readonly ok: false; readonly fields: readonly string[] };

export function parseJsonBody(
  raw: string,
  maxBytes = LEAD_INTAKE_MAX_BODY_BYTES
):
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly code: "BODY_TOO_LARGE" | "MALFORMED_JSON" } {
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > maxBytes) {
    return { ok: false, code: "BODY_TOO_LARGE" };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, code: "MALFORMED_JSON" };
  }
}

export function validateLeadIntakePayload(input: unknown): ValidationResult {
  const fields: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, fields: ["body"] };
  }

  rejectUnknownKeys(input, ROOT_KEYS, "body", fields);

  const idempotencyKey = asString(input.idempotencyKey);
  if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
    fields.push("idempotencyKey");
  }

  const plannerVersion = asString(input.plannerVersion);
  if (
    !plannerVersion ||
    !(LEAD_INTAKE_PLANNER_VERSIONS as readonly string[]).includes(plannerVersion) ||
    plannerVersion.length > 80
  ) {
    fields.push("plannerVersion");
  }
  /*
   * The version decides WHICH requirements are mandatory. It is not a way to
   * opt out of validation: each version is strict about exactly the answers its
   * form actually collects.
   */
  /*
   * THREE DISCRIMINATORS, THREE DIFFERENT CONTRACTS.
   *
   *   home-r4-v1         property + timeline required, qualifier forbidden
   *   public-consult-v1  qualifier required and matched to the service
   *   public-consult-v2  qualifier, property, timeline, rooms, budget and
   *                      estimate ALL forbidden — the single-step form asks
   *                      for none of them
   *   public-consult-v3  projectScope + budgetRange REQUIRED and cross-checked
   *                      against each other; service derived from the scope;
   *                      everything v2 forbids stays forbidden
   *
   * These mirror the SQL branch-for-branch. They have to: `submit_lead_intake`
   * is SECURITY DEFINER and enforces the same rules itself, so a disagreement
   * between the two layers is a route that validates a body the database will
   * then refuse — green tests either side of a lead that never lands.
   */
  const isPublicConsultV1 = plannerVersion === PUBLIC_CONSULT_V1_PLANNER_VERSION;
  const isPublicConsultV2 = plannerVersion === PUBLIC_CONSULT_V2_PLANNER_VERSION;
  const isPublicConsultV3 = plannerVersion === PUBLIC_CONSULT_V3_PLANNER_VERSION;
  const isPublicConsultV4 = plannerVersion === PUBLIC_CONSULT_V4_PLANNER_VERSION;
  /*
   * v2 and v3 share every prohibition; they differ only in what they ADD. So
   * the "unasked field" rules below are written once against this flag, and v3
   * layers its two required answers on top.
   */
  const forbidsQualifier =
    isPublicConsultV2 || isPublicConsultV3 || isPublicConsultV4;
  const isPublicConsult =
    isPublicConsultV1 ||
    isPublicConsultV2 ||
    isPublicConsultV3 ||
    isPublicConsultV4;

  if (!isPlainObject(input.contact)) {
    fields.push("contact");
    return { ok: false, fields };
  }
  rejectUnknownKeys(
    input.contact,
    new Set(["name", "mobile", "email"]),
    "contact",
    fields
  );

  const nameRaw = asString(input.contact.name);
  const name = nameRaw ? normaliseWhitespace(nameRaw) : "";
  if (name.length < 2 || name.length > 120) {
    fields.push("contact.name");
  }

  const mobileRaw = asString(input.contact.mobile);
  let phoneE164: string | null = null;
  if (!mobileRaw) {
    fields.push("contact.mobile");
  } else {
    const phone = normalisePhoneToE164(mobileRaw);
    if (!phone.ok) {
      fields.push("contact.mobile");
    } else {
      phoneE164 = phone.e164;
    }
  }

  let email: string | null = null;
  if (input.contact.email != null) {
    const emailRaw = asString(input.contact.email);
    if (!emailRaw) {
      fields.push("contact.email");
    } else {
      email = emailRaw.normalize("NFKC").trim().toLowerCase();
      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        fields.push("contact.email");
      }
    }
  }

  if (!isPlainObject(input.requirements)) {
    fields.push("requirements");
    return { ok: false, fields };
  }
  rejectUnknownKeys(
    input.requirements,
    new Set([
      "service",
      "property",
      "timeline",
      "qualifier",
      "rooms",
      "budgetComfort",
      "estimate",
      "projectScope",
      "budgetRange",
      "locality",
      "message",
    ]),
    "requirements",
    fields
  );

  const service = asString(input.requirements.service);
  if (
    !service ||
    !(LEAD_SERVICE_CODES as readonly string[]).includes(service)
  ) {
    fields.push("requirements.service");
  }

  /*
   * PROJECT SCOPE AND BUDGET RANGE (v3 only)
   *
   * Three checks, and all three matter:
   *
   *   1. the scope is one of the five;
   *   2. the budget belongs to THAT scope's ladder — `villa-above-20l` is a
   *      real code and still nonsense on a kitchen enquiry;
   *   3. the service is the one the scope implies.
   *
   * (3) is why the service is DERIVED rather than believed. A body claiming
   * `2-bhk` with `modular-kitchens` is not a body to correct quietly; it is a
   * caller sending a contradiction, and the rest of what it sent is no more
   * trustworthy than the part that disagrees with itself.
   *
   * Every other version must not carry these fields at all: they were never on
   * screen, and accepting them would put an answer in CRM nobody gave.
   */
  let projectScope: LeadProjectScopeCode | null = null;
  let budgetRange: string | null = null;

  if (isPublicConsultV3 || isPublicConsultV4) {
    /*
     * v3 always asks for a scope. v4 asks only where one exists: there is no
     * scope list describing a wardrobe job and no approved wardrobe budget
     * ladder, so `custom-wardrobes` carries neither — and carrying one would
     * mean the form invented an answer. The absence is ENFORCED rather than
     * tolerated, so a stale client cannot smuggle a scope onto a wardrobe.
     */
    const scopeExpected = isPublicConsultV3 || v4RequiresScope(service ?? "");
    const scope = input.requirements.projectScope;

    if (!scopeExpected) {
      for (const unasked of ["projectScope", "budgetRange"] as const) {
        if (input.requirements[unasked] != null) {
          fields.push(`requirements.${unasked}`);
        }
      }
    } else if (!isLeadProjectScopeCode(scope)) {
      fields.push("requirements.projectScope");
    } else {
      projectScope = scope;

      const budget = asString(input.requirements.budgetRange);
      if (!budget || !isBudgetRangeForScope(scope, budget)) {
        fields.push("requirements.budgetRange");
      } else {
        budgetRange = budget;
      }

      /*
       * The service is CHECKED against the scope rather than believed. A body
       * claiming 2-bhk with modular-kitchens contradicts itself, and the rest
       * of what it sent is no more trustworthy than the half that disagrees.
       */
      if (service && serviceForProjectScope(scope) !== service) {
        fields.push("requirements.service");
      }
    }
  } else {
    for (const unasked of ["projectScope", "budgetRange"] as const) {
      if (input.requirements[unasked] != null) {
        fields.push(`requirements.${unasked}`);
      }
    }
  }

  /*
   * PROPERTY, TIMELINE AND THE QUALIFIER
   *
   * `home-r4-v1` collects property, timeline and rooms, so all three stay
   * required for it — unchanged.
   *
   * `public-consult-v1` asks one service-relevant question instead. Under that
   * version property and timeline must be ABSENT rather than merely optional:
   * accepting them would let a client send a value its form never asked for,
   * which is the fabricated data this contract exists to keep out of CRM.
   */
  let property: string | null = null;
  let timeline: string | null = null;
  let qualifier: { kind: string; code: string } | null = null;

  if (isPublicConsult) {
    /*
     * UNASKED FIELDS ARE REJECTED, NOT IGNORED.
     *
     * Anything in the body that was never on screen came from a tampered or
     * stale client, and accepting it would put an answer in CRM that no
     * customer gave. Silently dropping it would be almost as bad: the caller
     * would believe it was stored.
     *
     * The timeline is the one field that MOVES between versions. v1, v2 and v3
     * never ask for it and reject it. The unified v4 form asks for it in step
     * three, so v4 requires it — from the existing vocabulary, not free text.
     */
    for (const unasked of [
      ...(isPublicConsultV4 ? [] : (["timeline"] as const)),
      "rooms",
      "budgetComfort",
      "estimate",
    ] as const) {
      if (input.requirements[unasked] != null) {
        fields.push(`requirements.${unasked}`);
      }
    }

    if (isPublicConsultV4) {
      const asked = asString(input.requirements.timeline);
      if (
        !asked ||
        !(LEAD_TIMELINE_CODES as readonly string[]).includes(asked)
      ) {
        fields.push("requirements.timeline");
      } else {
        timeline = asked;
      }
    }

    /*
     * v1 allows `property` ONLY when the customer's own home-size answer names
     * one, which the qualifier check below enforces. v2 forbids it outright,
     * handled with the qualifier above. Neither accepts a property nobody was
     * asked for.
     */

    // Neither public form has an email field, so neither the address nor its
    // consent may arrive under these versions.
    if (isPlainObject(input.contact) && input.contact.email != null) {
      fields.push("contact.email");
    }

    /*
     * THE QUALIFIER SPLITS THE TWO PUBLIC VERSIONS.
     *
     * v1's form asked one service-specific question and its rows carry the
     * answer, so it is REQUIRED and must match the kind the service implies —
     * a wardrobe enquiry still cannot carry a BHK. The SQL raises
     * `qualifier_required` for exactly this.
     *
     * v2's form asks nothing of the sort, so a qualifier is FORBIDDEN. Not
     * optional: optional would accept an answer that was never on screen.
     */
    if (forbidsQualifier) {
      /*
       * v2 asks no service-specific question, so a qualifier in the body was
       * never on screen. Rejected rather than ignored — see the unasked-field
       * note above; the same reasoning, the same answer.
       */
      if (input.requirements.qualifier != null) {
        fields.push("requirements.qualifier");
      }
      if (input.requirements.property != null) {
        fields.push("requirements.property");
      }
    } else if (!isPlainObject(input.requirements.qualifier)) {
      fields.push("requirements.qualifier");
    } else {
      rejectUnknownKeys(
        input.requirements.qualifier,
        new Set(["kind", "code"]),
        "requirements.qualifier",
        fields
      );
      const kind = asString(input.requirements.qualifier.kind);
      const code = asString(input.requirements.qualifier.code);

      // The pair is checked together, and the KIND must be the one this service
      // implies — so `custom-wardrobes` can never arrive carrying a BHK.
      if (
        !kind ||
        !code ||
        !isAllowedLeadQualifier(kind, code) ||
        (service &&
          (LEAD_SERVICE_CODES as readonly string[]).includes(service) &&
          LEAD_QUALIFIER_KIND_BY_SERVICE[service as LeadServiceCode] !== kind)
      ) {
        fields.push("requirements.qualifier");
      } else {
        qualifier = { kind, code };
        // Only a real home-size answer names a property. Everything else — a
        // kitchen scope, a wardrobe count, any "unsure" — stays null.
        property = propertyCodeFromQualifier(kind, code);
      }
    }
  } else {
    if (input.requirements.qualifier != null) {
      fields.push("requirements.qualifier");
    }

    const legacyProperty = asString(input.requirements.property);
    if (
      !legacyProperty ||
      !(LEAD_PROPERTY_CODES as readonly string[]).includes(legacyProperty)
    ) {
      fields.push("requirements.property");
    } else {
      property = legacyProperty;
    }

    const legacyTimeline = asString(input.requirements.timeline);
    if (
      !legacyTimeline ||
      !(LEAD_TIMELINE_CODES as readonly string[]).includes(legacyTimeline)
    ) {
      fields.push("requirements.timeline");
    } else {
      timeline = legacyTimeline;
    }
  }

  let rooms: LeadRoomCode[] = [];
  if (isPublicConsult) {
    // Absence is required and already enforced above; the stored value is an
    // empty list because no room question was ever asked.
    rooms = [];
  } else if (!Array.isArray(input.requirements.rooms)) {
    fields.push("requirements.rooms");
  } else {
    const seen = new Set<string>();
    const nextRooms: LeadRoomCode[] = [];
    for (const room of input.requirements.rooms) {
      if (
        typeof room !== "string" ||
        !(LEAD_ROOM_CODES as readonly string[]).includes(room)
      ) {
        fields.push("requirements.rooms");
        break;
      }
      if (seen.has(room)) {
        fields.push("requirements.rooms");
        break;
      }
      seen.add(room);
      nextRooms.push(room as LeadRoomCode);
    }
    rooms = nextRooms;
    if (rooms.length > 6) {
      fields.push("requirements.rooms");
    }
  }

  let budgetComfort: LeadBudgetComfortCode | null = null;
  if (input.requirements.budgetComfort != null) {
    const bc = asString(input.requirements.budgetComfort);
    if (
      !bc ||
      !(LEAD_BUDGET_COMFORT_CODES as readonly string[]).includes(bc)
    ) {
      fields.push("requirements.budgetComfort");
    } else {
      budgetComfort = bc as LeadBudgetComfortCode;
    }
  }

  const estimateSnapshot = validateEstimate(
    input.requirements.estimate,
    fields
  );

  let locality: string | null = null;
  if (input.requirements.locality != null) {
    const loc = asString(input.requirements.locality);
    if (!loc) {
      fields.push("requirements.locality");
    } else {
      locality = normaliseWhitespace(loc);
      if (locality.length > 120) fields.push("requirements.locality");
    }
  }

  let message: string | null = null;
  if (input.requirements.message != null) {
    const msg = asString(input.requirements.message);
    if (!msg) {
      fields.push("requirements.message");
    } else {
      message = normaliseWhitespace(msg);
      if (message.length > 2000) fields.push("requirements.message");
    }
  }

  if (!isPlainObject(input.consent)) {
    fields.push("consent");
    return { ok: false, fields };
  }

  const forbiddenConsent = [
    "aiAssistance",
    "portfolioMedia",
    "AI_ASSISTANCE_DISCLOSURE",
    "PORTFOLIO_MEDIA",
    "marketing",
    "marketingCopyVersion",
    "serviceCommunication",
  ];
  for (const key of Object.keys(input.consent)) {
    if (forbiddenConsent.includes(key)) {
      fields.push(`consent.${key}`);
    }
  }

  rejectUnknownKeys(
    input.consent,
    new Set([
      "serviceEnquiry",
      "serviceChannels",
      "whatsappService",
      "serviceEnquiryCopyVersion",
      "serviceCommunicationCopyVersion",
      "whatsappCopyVersion",
      "noticeVersion",
    ]),
    "consent",
    fields
  );

  if (input.consent.serviceEnquiry !== true) {
    fields.push("consent.serviceEnquiry");
  }

  if (!isPlainObject(input.consent.serviceChannels)) {
    fields.push("consent.serviceChannels");
  } else {
    rejectUnknownKeys(
      input.consent.serviceChannels,
      new Set(["phone", "email"]),
      "consent.serviceChannels",
      fields
    );
    if (input.consent.serviceChannels.phone !== true) {
      fields.push("consent.serviceChannels.phone");
    }
    // The public form collects no email, so it may not consent to one either.
    if (isPublicConsult && input.consent.serviceChannels.email != null) {
      fields.push("consent.serviceChannels.email");
    }
  }

  /*
   * CONSENT EVIDENCE RECORDS THE WORDING THAT WAS SHOWN.
   *
   * v3's form shows ONE checkbox covering both required purposes, so it records
   * the combined copy versions — not the two separate v1.0 strings, which
   * describe a two-checkbox layout the visitor never saw. v4 inherits that
   * layout: the unified sheet's brief step shows the same single combined
   * sentence, so it records the same combined versions.
   *
   * `home-r4-v1`, v1 and v2 still show two checkboxes and still record the
   * separate copies. Accepting either shape's copy under the other would file
   * evidence of a sentence nobody read.
   */
  const usesSingleConsentCopy = isPublicConsultV3 || isPublicConsultV4;
  const expectedCopyServiceEnquiry = usesSingleConsentCopy
    ? SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION
    : SERVICE_ENQUIRY_COPY_VERSION;
  const expectedCopyServiceCommunication = usesSingleConsentCopy
    ? SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION
    : SERVICE_COMMUNICATION_COPY_VERSION;

  const copyServiceEnquiry = asString(input.consent.serviceEnquiryCopyVersion);
  if (copyServiceEnquiry !== expectedCopyServiceEnquiry) {
    fields.push("consent.serviceEnquiryCopyVersion");
  }
  const copyServiceCommunication = asString(
    input.consent.serviceCommunicationCopyVersion
  );
  if (copyServiceCommunication !== expectedCopyServiceCommunication) {
    fields.push("consent.serviceCommunicationCopyVersion");
  }

  const noticeVersion = asString(input.consent.noticeVersion);
  if (noticeVersion !== LEAD_INTAKE_NOTICE_VERSION) {
    fields.push("consent.noticeVersion");
  }

  const consentWhatsapp = input.consent.whatsappService === true;
  let copyWhatsapp: string | null = null;

  /*
   * v3's ONE checkbox covers the two REQUIRED purposes and nothing else.
   *
   * WhatsApp is optional, and its form field is gone. A body arriving under v3
   * with WhatsApp granted therefore claims a permission that no visitor was
   * offered, so it is refused rather than recorded. The alternative — quietly
   * setting it false — would let a caller believe it stored an opt-in.
   */
  if (isPublicConsultV3 && input.consent.whatsappService != null) {
    fields.push("consent.whatsappService");
  }

  if (consentWhatsapp) {
    copyWhatsapp = asString(input.consent.whatsappCopyVersion);
    if (copyWhatsapp !== WHATSAPP_COPY_VERSION) {
      fields.push("consent.whatsappCopyVersion");
    }
  } else if (input.consent.whatsappCopyVersion != null) {
    fields.push("consent.whatsappCopyVersion");
  }

  const emailChannelRaw =
    isPlainObject(input.consent.serviceChannels) &&
    "email" in input.consent.serviceChannels
      ? input.consent.serviceChannels.email
      : undefined;

  // email?: true — omit or true only; false and other values are invalid.
  if (emailChannelRaw !== undefined && emailChannelRaw !== true) {
    fields.push("consent.serviceChannels.email");
  }

  const emailChannelRequested = emailChannelRaw === true;

  // Email service communication requires both valid email and explicit permission.
  if (emailChannelRequested && !email) {
    fields.push("consent.serviceChannels.email");
    fields.push("contact.email");
  }
  if (email && !emailChannelRequested) {
    fields.push("consent.serviceChannels.email");
    fields.push("contact.email");
  }

  if (!isPlainObject(input.attribution)) {
    fields.push("attribution");
    return { ok: false, fields };
  }
  rejectUnknownKeys(
    input.attribution,
    new Set([
      "landingPath",
      "referrerPath",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "utmTerm",
      "utmContent",
      "fbclid",
      "gclid",
      "wbraid",
      "gbraid",
      "fbc",
      "fbp",
    ]),
    "attribution",
    fields
  );

  const landingPath = asString(input.attribution.landingPath);
  if (!landingPath || !isSafeSameSitePath(landingPath, 500)) {
    fields.push("attribution.landingPath");
  }

  const attribution: Record<string, string> = {};
  if (landingPath) attribution.landingPath = landingPath;
  for (const key of [
    "referrerPath",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmTerm",
    "utmContent",
    "fbclid",
    "gclid",
    "wbraid",
    "gbraid",
    "fbc",
    "fbp",
  ] as const) {
    if (input.attribution[key] != null) {
      const val = asString(input.attribution[key]);
      if (!val || val.length > 200 || hasUnsafeControlChars(val)) {
        fields.push(`attribution.${key}`);
      } else if (key === "referrerPath") {
        if (!isSafeSameSitePath(val, 200)) {
          fields.push(`attribution.${key}`);
        } else {
          attribution[key] = val;
        }
      } else {
        attribution[key] = key === "fbclid" || key === "gclid" ? val.trim() : normaliseWhitespace(val);
      }
    }
  }

  const landingPublicationContext = parseSignedPublicationContext(
    input.landingPublicationContext,
    fields
  );
  const campaignExecutionContext = parseSignedCampaignExecutionContext(
    input.campaignExecutionContext,
    fields
  );

  if (!isPlainObject(input.antiBot)) {
    fields.push("antiBot");
    return { ok: false, fields };
  }
  rejectUnknownKeys(
    input.antiBot,
    new Set(["website", "formStartedAt"]),
    "antiBot",
    fields
  );

  const honeypot = asString(input.antiBot.website);
  if (honeypot == null || honeypot !== "") {
    fields.push("antiBot.website");
  }

  const formStartedAt = asString(input.antiBot.formStartedAt);
  if (!formStartedAt || Number.isNaN(Date.parse(formStartedAt))) {
    fields.push("antiBot.formStartedAt");
  } else {
    const started = Date.parse(formStartedAt);
    const ageMs = Date.now() - started;
    // Plausible timing: not in the future, not older than 24h, not < 800ms.
    if (ageMs < 800 || ageMs > 24 * 60 * 60 * 1000) {
      fields.push("antiBot.formStartedAt");
    }
  }

  if (fields.length > 0) {
    return { ok: false, fields: [...new Set(fields)] };
  }

  return {
    ok: true,
    value: {
      idempotencyKey: idempotencyKey!,
      plannerVersion: plannerVersion!,
      name,
      phoneE164: phoneE164!,
      email,
      service: service as LeadServiceCode,
      // Null stays null. The previous cast would have laundered a missing
      // answer into a typed code the customer never gave.
      property: property as LeadPropertyCode | null,
      timeline: timeline as LeadTimelineCode | null,
      qualifier: qualifier as ValidatedLeadIntake["qualifier"],
      rooms,
      budgetComfort,
      projectScope,
      budgetRange,
      estimateSnapshot,
      locality,
      message,
      landingPath: landingPath!,
      attribution,
      landingPublicationContext,
      campaignExecutionContext,
      consentServicePhone: true,
      consentServiceEmail: emailChannelRequested,
      consentWhatsapp,
      copyServiceEnquiry: copyServiceEnquiry!,
      copyServiceCommunication: copyServiceCommunication!,
      copyWhatsapp,
      noticeVersion: noticeVersion!,
      formStartedAt: formStartedAt!,
    },
  };
}
