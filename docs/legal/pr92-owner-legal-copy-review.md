# PR #92 — Proposed production legal / consent copy (owner review)

**Status:** Draft for owner review only. **Not effective.**  
**Approval flags remain FALSE** until the owner explicitly approves final text.  
**Counsel status:** NO COUNSEL REVIEW YET — do not treat this package as lawyer-approved or as a compliance claim.

Proposed effective date (subject to owner choice): **the calendar date of authorized production lead-intake activation** (suggested placeholder: `2026-08-26` IST if owner prefers a fixed date).

Proposed version identifiers (activate only after owner approval):

| Instrument | Current code version (draft) | Proposed production version |
|---|---|---|
| Privacy Notice | `privacy-notice-v0.1-draft` | `privacy-notice-v1.0` |
| Terms of Use | (draft content module) | `terms-of-use-v1.0` |
| Service enquiry consent | `service-enquiry-v0.1-draft` | `service-enquiry-v1.0` |
| Service communication consent | `service-communication-v0.1-draft` | `service-communication-v1.0` |
| WhatsApp optional consent | `whatsapp-service-v0.1-draft` | `whatsapp-service-v1.0` |

Placeholders still required from owner before finalization:

- `[PROPRIETOR FULL LEGAL NAME]`
- Contact-channel simplification: `[APPROVE | DO NOT APPROVE]` combined privacy/grievance/data-rights → `onedecore@gmail.com`
- Representative roles: `[APPROVE | DO NOT APPROVE]`
- Jurisdiction draft: `[APPROVE THIS DRAFT | REVISE | LEAVE NOT YET APPROVED]`

---

## Confirmed identity facts already recorded in code

- Trading name: **ONEDECORE**
- Entity type: **proprietorship**
- Registered office: **SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207**
- Operating office: **same as registered**
- Business email: **onedecore@gmail.com**
- Proprietor full legal name: **NOT YET SUPPLIED** (must not equal trading name alone)

---

## Proposed Privacy Notice (production candidate text)

### Draft / effectiveness

This Privacy Notice is proposed for owner approval. It is **not yet effective** until the owner sets Privacy/Terms approval and the publication mode is advanced after activation authorization.

ONEDECORE does **not** claim DPDP compliance merely by publishing this notice. Final compliance depends on applicable law, approved operational processes, processor contracts, implemented safeguards, and any later qualified legal review the owner obtains.

### Who we are

- Trading name: ONEDECORE
- Entity type: proprietorship
- Proprietor / legal identity: `[PROPRIETOR FULL LEGAL NAME]`
- Service region: Pune, Maharashtra, India
- Registered office: SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207
- Operating office: same as registered office
- Business email: onedecore@gmail.com
- Privacy contact email: `[onedecore@gmail.com IF contact-channel simplification APPROVED; otherwise OWNER-SUPPLIED privacyEmail]`
- Grievance / data-rights contacts: `[same mailbox via combined-role mapping IF APPROVED; otherwise separate owner-supplied emails]`
- Authorised representative: `[PROPRIETOR FULL LEGAL NAME IF representative-roles APPROVED]`
- Grievance contact: `[PROPRIETOR FULL LEGAL NAME, Proprietor / Grievance Contact IF representative-roles APPROVED]`

### Scope

This notice describes how ONEDECORE handles personal data for the public website, consultation enquiry form, CRM follow-up, and related service operations.

### Personal data we may process from website enquiries

Name; mobile number; email (if provided); locality (if provided); service, property and timeline selections; optional message; consent choices; first-party attribution such as landing path / UTM fields already supported by the product; technical request metadata needed for security, rate limiting and abuse prevention.

### Purposes

Respond to interior design / renovation consultation enquiries; coordinate follow-up; keep CRM records for sales operations; store consent evidence; protect the service against abuse.

### Legal bases / consent

Service enquiry processing and phone service communication require explicit consent on the form. Email channel consent appears only when an email is supplied. WhatsApp channel consent is optional and separate. Marketing consent is not collected by the current website form.

### Retention (owner-approved MVP policy)

- Lead records: 24 months after last meaningful lead activity or closure, then delete/anonymize unless another lawful/business requirement requires retention.
- Consent evidence: 36 months after related lead/customer relationship closure, retaining only evidence reasonably needed to demonstrate consent/withdrawal history.
- Audit/security evidence linked to leads: 36 months after related lead closure, limited to accountability needs.
- Suppression: retain minimum suppression record while opt-out remains in force; do not retain unrelated profile/marketing content merely for suppression.

### Processors

Current processors that handle public website lead data (see also `processor-register.ts`):

1. **Supabase** (current) — database / lead-intake / CRM persistence; DPA not claimed signed; region/transfer assessment pending owner confirmation.
2. **Hosting provider** (under-review) — website hosting / TLS / request logs; exact legal provider name, region, DPA/terms pending owner confirmation.

Planned processors (not active for website lead capture): Meta WhatsApp, Groq, n8n, analytics, email/SMS TBD.

### Your rights / contact

Contact the privacy email above to request access, correction, or other applicable rights requests. Verification measures will be proportionate.

### Counsel status

**NO COUNSEL REVIEW YET.** This notice is not lawyer-approved.

---

## Proposed Terms of Use (production candidate text)

### Draft / effectiveness

These Terms are proposed for owner approval and are **not yet effective**.

### Operator

ONEDECORE is the trading name of a proprietorship. Proprietor: `[PROPRIETOR FULL LEGAL NAME]`. Registered office: SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207. Business email: onedecore@gmail.com.

### Website use

The website provides information about interior services, planning tools, portfolio content, and (when enabled) a consultation enquiry form. Nothing on the website creates a binding project contract unless separately agreed in a signed quotation or agreement.

### Indicative prices

Estimator outputs and budget ranges are indicative planning guidance only — not quotations or guaranteed prices.

### Consultation requests

Submitting a consultation enquiry is a **request**, not a confirmed appointment or booking, unless a separate scheduling system is later introduced and clearly described.

### Governing law / jurisdiction (proposed draft — awaiting owner decision)

Proposed wording:

> These Terms are governed by the laws of India. Subject to applicable law, courts having jurisdiction in Pune, Maharashtra will have jurisdiction over disputes arising from these Terms.

Owner decision still required: **APPROVE THIS DRAFT | REVISE | LEAVE NOT YET APPROVED**.  
This is **not** described as lawyer-approved.

### Counsel status

**NO COUNSEL REVIEW YET.**

---

## Proposed consent copy (current form text, production candidate)

These match the current concise registry copy and are proposed as `v1.0` once approved.

### Service enquiry (required)

**Concise:** Process information you provide to understand and respond to your interior design enquiry.

**Expanded:** When you submit an enquiry, ONEDECORE will use the personal data you provide — such as your name, contact details, property locality, service requirements and messages — solely to understand your request and respond. This consent does not cover optional marketing or separate channel permissions.

### Service communication (required for phone; email only if email supplied)

**Concise:** Contact you about consultation, estimates, site visits, proposals or active project coordination.

**Expanded:** ONEDECORE may use your contact details for operational communication related to your enquiry or project — including scheduling, estimates, site visits, design discussions, proposals and delivery coordination. This is separate from optional marketing consent and from channel-specific WhatsApp permission.

### WhatsApp service (optional)

**Concise:** Send and receive WhatsApp messages for service-related communication about your enquiry or project.

**Expanded:** WhatsApp is a separate channel requiring explicit permission. If you opt in, ONEDECORE may use WhatsApp for service-related messages such as consultation updates, site-visit coordination and project communication. Outbound WhatsApp sending is a separate activation concern from storing this consent. Marketing messages require separate optional consent.

No consent checkbox is pre-checked.

---

## Remaining owner decisions before approval flags can flip

1. `proprietorFullLegalName`
2. Contact-channel simplification APPROVE / DO NOT APPROVE
3. Representative roles APPROVE / DO NOT APPROVE
4. Jurisdiction draft APPROVE / REVISE / LEAVE NOT YET APPROVED
5. Confirm Supabase DPA/sub-processor review + project region for processor register
6. Confirm exact hosting provider legal name / region / terms for processor register
7. Explicit approval of the Privacy Notice, Terms, and consent texts above (then flags may be set true in a later commit)

## Non-goals of this document

- Does not activate production lead intake
- Does not merge or deploy
- Does not change shop gate
- Does not invent counsel approval
