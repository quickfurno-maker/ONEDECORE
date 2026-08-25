# PR #92 â€” FINAL proposed production legal / consent copy (owner APPROVE | REVISE)

**Status:** Final proposed package for **one explicit owner decision**. **Not effective.**
**Approval flags remain FALSE** until the owner replies APPROVE (or REVISE with edits).
**Counsel status:** NO COUNSEL REVIEW YET â€” not lawyer-approved; not a compliance claim.

**Effective-date rule:** the calendar date of **authorized production lead-intake activation** (not this commit).

| Instrument | Draft / code version | Proposed production version |
|---|---|---|
| Privacy Notice | `privacy-notice-v0.1-draft` | `privacy-notice-v1.0` |
| Terms of Use | draft content module | `terms-of-use-v1.0` |
| Service enquiry consent | `service-enquiry-v0.1-draft` | `service-enquiry-v1.0` |
| Service communication consent | `service-communication-v0.1-draft` | `service-communication-v1.0` |
| WhatsApp optional consent | `whatsapp-service-v0.1-draft` | `whatsapp-service-v1.0` |

---

## Owner facts recorded in code (this commit)

- Trading name: **ONEDECORE**
- Proprietor / legal identity (`legalEntityName` / `proprietorFullLegalName`): **ONEDECORE** (owner-supplied exactly; no personal name substituted)
- Entity type: **proprietorship**
- Registered office: **SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207**
- Operating office: **same as registered**
- Business email: **onedecore@gmail.com**
- Privacy email: **onedecore@gmail.com**
- Combined roles: privacy+grievance **true**; privacy+data-rights **true** (no duplicate grievance/data-rights inboxes)
- Authorised representative: **ONEDECORE**
- Grievance contact: **ONEDECORE, Proprietor / Grievance Contact**
- Jurisdiction: owner-approved wording below Â· **NOT COUNSEL REVIEWED**
- Counsel reference: **null** Â· **NO COUNSEL REVIEW YET**
- Retention MVP: approved as written
- Rate limits MVP: approved; SQL unchanged
- CRM: manual assignment; no auto-rule
- Supabase region: **ap-south-1 / Mumbai** (owner-confirmed)
- Hosting register: **Hostinger VPS** brand from repo deployment docs; legal entity / region / DPA still under-review
- Flags still false: `privacyTermsVersionApproved`, `serviceEnquiryCopyApproved`, `serviceCommunicationCopyApproved`, `leadProcessorsRegistered`

---

## FINAL Privacy Notice (proposed `privacy-notice-v1.0`)

### Draft / effectiveness

This Privacy Notice is proposed for owner approval. It is **not yet effective**.

ONEDECORE does **not** claim DPDP compliance at this draft stage, and does not claim DPDP compliance merely by publishing this notice. Final compliance depends on applicable commencement, approved operational processes, processor contracts, implemented safeguards, and any later qualified legal review the owner obtains.

Counsel status: **NO COUNSEL REVIEW YET.** This notice has not been reviewed by counsel.

### Who we are

- Trading name: ONEDECORE
- Entity type: proprietorship
- Proprietor / legal identity: ONEDECORE
- Service region: Pune, Maharashtra, India
- Registered office: SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207
- Operating office: same as registered office
- Business email: onedecore@gmail.com
- Privacy contact email: onedecore@gmail.com
- Grievance / data-rights emails: same privacy mailbox (owner-approved combined-role mapping)
- Authorised representative: ONEDECORE
- Grievance contact: ONEDECORE, Proprietor / Grievance Contact

### Scope

This notice describes how ONEDECORE handles personal data for the public website, consultation enquiry form (when enabled), CRM follow-up, and related service operations.

### Personal data we may process from website enquiries

Name; mobile number; email (if provided); locality (if provided); service, property and timeline selections; optional message; consent choices; first-party attribution such as landing path / UTM fields already supported by the product; technical request metadata needed for security, rate limiting and abuse prevention. WhatsApp number only if you opt in when offered. No payment-card data via the website lead form. No sensitive personal data intentionally requested.

### Purposes

Respond to interior design / renovation consultation enquiries; coordinate follow-up; keep CRM records for sales operations; store consent evidence; protect the service against abuse; provide indicative planning guidance via the in-browser estimator. Marketing is not collected by the current website form. WhatsApp requires separate optional consent and separate channel activation.

### How we collect data

In-browser planner and estimator inputs remain on your device unless you copy or submit them yourself. When production lead intake is authorized and enabled, the consultation enquiry form may submit the personal data above. Until that authorization, public lead collection remains disabled. We do not buy personal data lists.

### Legal bases / consent

Service enquiry processing and phone service communication require explicit consent on the form. Email channel consent appears only when an email is supplied. WhatsApp channel consent is optional and separate. Marketing consent is not collected by the current website form. No consent checkbox is pre-checked.

### Retention (owner-approved MVP; not counsel-approved)

- Lead records: 24 months after last meaningful lead activity or closure, then delete/anonymize unless another lawful/business requirement requires retention.
- Consent evidence: 36 months after related lead/customer relationship closure, retaining only evidence reasonably needed to demonstrate consent/withdrawal history.
- Audit/security evidence linked to leads: 36 months after related lead closure, limited to accountability needs.
- Suppression: retain minimum suppression record while opt-out remains in force; do not retain unrelated profile/marketing content merely for suppression.

### Processors

1. **Supabase** (current) â€” database / auth / portfolio / lead-intake / CRM; region **ap-south-1 / Mumbai** (owner-confirmed); bespoke signed DPA **not claimed**.
2. **Hostinger VPS** (under-review) â€” website hosting / TLS / application logs (brand from repository deployment documentation); exact legal entity, region, and DPA/terms **not invented / still open**.

Planned / not active for website lead capture: Meta WhatsApp, Groq, n8n, analytics, email/SMS TBD.

### Your rights / grievance

Contact **onedecore@gmail.com** to request access, correction, or other applicable rights, or to raise a grievance. Grievance contact: **ONEDECORE, Proprietor / Grievance Contact**. Verification measures will be proportionate.

### Changes

Material changes will be communicated before or when they take effect. Version identifiers will be recorded for consent purposes.

---

## FINAL Terms of Use (proposed `terms-of-use-v1.0`)

### Draft / effectiveness

These Terms are proposed for owner approval and are **not yet effective**. Counsel status: **NO COUNSEL REVIEW YET.**

### Operator

ONEDECORE is the trading name of a proprietorship. Proprietor / legal identity (owner-supplied): **ONEDECORE**. Registered office: SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207. Operating office: same as registered. Business email: onedecore@gmail.com.

### Website use

The website provides information about interior services, planning tools, portfolio content, and (when enabled) a consultation enquiry form. Nothing on the website creates a binding project contract unless separately agreed in a signed quotation or agreement.

### Indicative prices

Estimator outputs and budget ranges are indicative planning guidance only â€” not quotations or guaranteed prices.

### Consultation requests

Submitting a consultation enquiry is a **request**, not a confirmed appointment or booking, unless a separate scheduling system is later introduced and clearly described.

### Prohibited use / IP / third parties / availability / no professional advice

As stated in the site Terms module: no misuse or unlawful use; site content owned/licensed to ONEDECORE; third-party services are not ONEDECOREâ€™s responsibility; site is as-available; content is general information only.

### Governing law / jurisdiction (OWNER APPROVED Â· NOT COUNSEL REVIEWED)

> These Terms are governed by the laws of India. Subject to applicable law, courts having jurisdiction in Pune, Maharashtra will have jurisdiction over disputes arising from these Terms.

This clause is **not** lawyer-approved.

### Limitation / indemnity / disputes

Draft owner-facing wording exists in the Terms module. Counsel has not reviewed it. No separate arbitration clause is currently published.

---

## FINAL consent copy (proposed production versions)

These match the current concise registry copy and are proposed as `v1.0` once approved. Status remains **draft-review** in code until owner APPROVE.

### Service enquiry (required) â€” proposed `service-enquiry-v1.0`

**Concise:** Process information you provide to understand and respond to your interior design enquiry.

**Expanded:** When you submit an enquiry, ONEDECORE will use the personal data you provide â€” such as your name, contact details, property locality, service requirements and messages â€” solely to understand your request and respond. This consent does not cover optional marketing or separate channel permissions.

### Service communication (required for phone; email only if email supplied) â€” proposed `service-communication-v1.0`

**Concise:** Contact you about consultation, estimates, site visits, proposals or active project coordination.

**Expanded:** ONEDECORE may use your contact details for operational communication related to your enquiry or project â€” including scheduling, estimates, site visits, design discussions, proposals and delivery coordination. This is separate from optional marketing consent and from channel-specific WhatsApp permission.

### WhatsApp service (optional) â€” proposed `whatsapp-service-v1.0`

**Concise:** Send and receive WhatsApp messages for service-related communication about your enquiry or project.

**Expanded:** WhatsApp is a separate channel requiring explicit permission. If you opt in, ONEDECORE may use WhatsApp for service-related messages such as consultation updates, site-visit coordination and project communication. Outbound WhatsApp sending is a separate activation concern from storing this consent. Marketing messages require separate optional consent.

No consent checkbox is pre-checked.

---

## Remaining blockers before activation (not this commit)

1. Owner **APPROVE | REVISE** on this full Privacy / Terms / consent package
2. Then flip `privacyTermsVersionApproved`, `serviceEnquiryCopyApproved`, `serviceCommunicationCopyApproved` in a later authorized commit
3. Complete processor register enough for `leadProcessorsRegistered=true` (Supabase DPA/sub-processor confirmation; Hostinger legal entity / region / terms)
4. Proxy/trust, secrets, and explicit owner authorize-to-collect decision
5. Do **not** enable production lead intake, merge for activation, or deploy activation in this step

## Owner decision required now

Reply with exactly one of:

- **APPROVE** â€” accept the FINAL Privacy Notice, Terms of Use, and consent texts above as the production versions to take effect on the authorized activation date
- **REVISE** â€” list exact edits

---

## Non-goals of this commit

- Does not activate production lead intake
- Does not merge or deploy
- Does not change shop gate (`ONEDECORE_SHOP_PUBLIC_ENABLED` remains fail-closed)
- Does not invent a personal proprietor name or counsel approval
- Does not invent Hostinger legal entity/region/DPA
- Does not touch M38 or online payments
