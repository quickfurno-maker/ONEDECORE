# ONEDECORE — PHASE 1B OWNER REVIEW, CORRECTIONS & PHASE 1C EXECUTION

**Project:** ONEDECORE  
**Review date:** July 24, 2026  
**Phase 1A:** Passed  
**Phase 1B:** Conditionally passed after the corrections in this document  
**Current next phase:** Phase 1C — Documentation baseline and clean Git setup  
**Production implementation:** Not authorized  

---

# 1. PHASE 1B VERDICT

The Phase 1B report establishes a strong overall direction:

- Separate premium public website
- Dedicated Portfolio and case-study system
- Supabase as the structured-data source of truth
- Public/private storage separation
- Sales CRM instead of a full ERP
- Official Meta WhatsApp integration
- Controlled n8n automation
- Modular-monolith repository
- Phase-gated implementation

However, several items in the report are either technically incorrect, premature, unverified business claims, or inconsistent with the governing blueprint.

The following corrections supersede conflicting Phase 1B wording.

---

# 2. MANDATORY CORRECTIONS

## Correction 1 — Next.js version

The report says Phase 2 will use Next.js 15.

**Corrected decision:**

- Use the current vetted stable Next.js 16.x release in Phase 2.
- As of July 24, 2026, official Next.js documentation identifies 16.2.11 as the latest release.
- The exact version must be pinned in `package.json` and the lockfile during Phase 2 after Node.js, React and dependency compatibility checks.
- Do not scaffold or install Next.js in Phase 1C.

## Correction 2 — Lead persistence must not depend on n8n

The Phase 1B diagram showed:

`Public Web → n8n → Supabase`

This violates the locked source-of-truth boundary.

**Corrected architecture:**

`Public form → ONEDECORE server endpoint → validate and deduplicate → Supabase transaction → durable event/outbox → n8n notification workflow`

Rules:

- A lead is committed to Supabase before automation is triggered.
- An n8n outage must never cause loss of a valid lead.
- n8n does not own lead state.
- Automation dispatch must be retryable and idempotent.
- The same principle applies to consultation bookings and quotation notifications.

## Correction 3 — WhatsApp webhook boundary

**Corrected architecture:**

`Meta webhook → ONEDECORE verified webhook endpoint → idempotent Supabase persistence → optional event/outbox → n8n/internal notifications`

Rules:

- Verify webhook authenticity before processing.
- Store message and delivery-status events idempotently.
- n8n must not be the sole receiver or permanent message store.
- Manual pauses must stop automation without preventing inbound event persistence.

## Correction 4 — ₹100-crore statement

“₹100-crore” is an internal quality and perception benchmark only.

It must never appear publicly as:

- Revenue
- Valuation
- Company size
- Project volume
- Market position
- Financial claim

No fake business-scale claim is permitted.

## Correction 5 — Unverified ONEDECORE claims

The Phase 1B report introduced facts that the owner has not confirmed.

Do not publish or treat the following as locked facts:

- In-house factory or factory production
- Pune studio or “Book Studio Tour”
- Specific hardware brands such as Hettich, Blum or Häfele
- Warranty duration
- GST details
- Company history
- Leadership profiles
- Exact office address
- 3D visualization as a promised service
- Specific Pune project locations
- Existing verified testimonials
- Existing client projects
- Specific delivery process stages presented as already operational

These may be added later only after owner verification.

## Correction 6 — CRM qualification rules

The following are not locked:

- Minimum budget of ₹5 lakh
- Two-hour first-contact SLA
- Fixed qualification thresholds

**Corrected decision:**

- Qualification criteria must be configurable.
- Initial production thresholds remain unset until owner approval.
- SLA targets must be configurable and auditable.
- No hardcoded threshold in UI or database constraints.

## Correction 7 — Discount approval rules

The Phase 1B report locked a 10% discount threshold without owner approval.

**Corrected decision:**

- Discount limits are configurable business policy.
- Version 1 supports approval thresholds, but the numeric threshold remains unset until owner approval.
- No hardcoded 10% rule.

## Correction 8 — Quotation acceptance

Client IP and timestamp alone must not be described as a legally binding digital signature.

**Corrected Version 1 boundary:**

- Record quote version, immutable document hash, acceptance action, timestamp, client identifier and audit event.
- Label this as “client acceptance acknowledgement.”
- Password or OTP verification may be added after security and legal review.
- Formal e-signature and contract execution are deferred unless a compliant provider is deliberately integrated.

## Correction 9 — Portfolio originals and public derivatives

Original high-resolution portfolio files must not be placed in a world-readable public bucket by default.

**Corrected logical storage model:**

1. Private portfolio originals
2. Public approved optimized derivatives
3. Private CRM/client documents
4. Controlled brand/team assets

Rules:

- Originals remain private.
- Public pages use approved optimized derivatives.
- Publishing a project does not automatically expose master originals.
- Signed URLs are used for authorized private access.
- Derivative generation and cleanup must be auditable.

Logical bucket names may be proposed in documentation but are created only in Phase 2.

## Correction 10 — RLS scope

“RLS on 100% of all tables” is too imprecise.

**Corrected decision:**

- RLS is mandatory for all application tables exposed through Supabase APIs.
- Anonymous access is denied by default.
- CRM and private records receive no anonymous policies.
- Server-only/internal schemas, if used, must be removed from exposed API schemas or have privileges revoked.
- Authorization is enforced both through RLS and trusted server-side checks.

## Correction 11 — Repository structure

The governing blueprint’s `src/` structure remains preferred.

**Corrected repository decision:**

- Single modular-monolith repository
- `src/app` for route groups
- `src/features` for feature-owned application logic
- `src/server` for repositories, services, authorization and integrations
- `src/components/ui` for reusable primitives
- `supabase/migrations` for versioned database changes
- `automation/n8n` for workflow exports and contracts
- `docs/ADR` for architecture decisions
- Public components never call Supabase, WhatsApp or n8n directly

Authentication routes remain separate from CRM routes:

- `src/app/(auth)/login`
- `src/app/(admin)/admin/...`

The public URL prefix for the internal application is frozen as `/admin`, not `/crm`, unless changed through a later architecture decision.

## Correction 12 — Role permissions

Designer and Project/Operations roles require least-privilege access to assigned work.

**Corrected model:**

- Designer: view assigned leads/clients/projects, add design notes and contribute to assigned quotations.
- Project/Operations: view assigned clients, site visits and basic projects; update execution handoff status.
- Sales: access owned or assigned leads and related communications.
- Content Manager: portfolio/content access only; no general CRM access.
- Management: broad operational approval.
- Super Admin: system and identity administration.

Exact permissions will be implemented and tested in Phase 7.

## Correction 13 — Lost lead transitions

A lead may become Lost from any active pipeline stage.

Rules:

- Lost reason is mandatory.
- Opt-out is separate from Lost status.
- Reopening creates an auditable transition.
- Won and Lost are terminal states unless an authorized reopen occurs.
- The pipeline must not imply that a lead becomes Lost only after Won.

## Correction 14 — Typography and logo

Playfair Display + Plus Jakarta Sans remains a recommendation only.

Do not lock or generate:

- Final logo
- “O” icon
- Font-based SVG logo
- Downloaded font files

Phase 3 must test typography in the design-system showroom before owner approval.

Phase 1C may document:

- Required logo variants
- Placeholder text-wordmark approach
- Typography evaluation criteria

## Correction 15 — Structured data

Do not use a nonexistent or unsupported `InteriorDesign` Schema.org type.

Use only page-relevant, truthful structured data such as:

- `Organization`
- `LocalBusiness` or `HomeAndConstructionBusiness`, once real business details are verified
- `Service`
- `CreativeWork`, `ImageObject` or `VideoObject` where appropriate
- `BreadcrumbList`

Structured data must match visible page content and must never contain invented ratings, addresses, reviews or business claims.

## Correction 16 — Privacy language

Do not claim “full DPDP compliance” through architecture alone.

Use:

- Privacy-by-design controls
- Data minimization
- Purpose and consent records
- Retention rules
- Rights-request procedures
- Security controls
- Applicable-law review before launch

Final privacy policy and operational compliance require qualified legal review.

## Correction 17 — Asset placeholders

Staging may use clearly labelled neutral placeholders.

Production must not use:

- Third-party inspiration images presented as ONEDECORE work
- Fake project locations
- Fake testimonials
- Fake statistics
- Fake client names
- Unverified brand logos
- Unlicensed renders

## Correction 18 — Owner approvals and phase blockers

These are not Phase 1C blockers:

- Meta Business account details
- Hostinger VPS specification
- Photography budget

They are readiness items for later phases.

Phase 1C may proceed without them.

Typography remains pending for Phase 3 owner approval.

---

# 3. PHASE 1C AUTHORIZED SCOPE

Phase 1C may:

- Re-inspect the current ONEDECORE directory
- Create approved project-governance documents
- Create `.gitignore`
- Create `.editorconfig`
- Create `README.md`
- Create documentation and ADR directories
- Initialize local Git on branch `main`
- Stage the documentation baseline
- Create one initial commit only if Git identity already exists
- Report the exact resulting status

Phase 1C may not:

- Scaffold Next.js
- Create `package.json`
- Install packages
- Create application source code
- Create Supabase configuration or migrations
- Create `.env` files
- Connect GitHub
- Add a remote
- Connect Hostinger
- Generate UI
- Add images or fonts
- Begin Phase 2

---

# 4. REQUIRED PHASE 1C DOCUMENTS

Create this documentation baseline:

```text
OneDecore/
├── .editorconfig
├── .gitignore
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── ONEDECORE_MASTER_BLUEPRINT_PHASE_1.md
├── ONEDECORE_PHASE_1B_ARCHITECTURE_FREEZE.md
└── docs/
    ├── 00-project-truth.md
    ├── 01-product-requirements.md
    ├── 02-architecture.md
    ├── 03-public-site-and-sitemap.md
    ├── 04-portfolio-architecture.md
    ├── 05-supabase-data-domains.md
    ├── 06-security-privacy-and-rls.md
    ├── 07-crm-and-quotation-boundary.md
    ├── 08-whatsapp-and-n8n-boundary.md
    ├── 09-phase-roadmap.md
    ├── 10-decision-register.md
    ├── audits/
    │   ├── phase-1a-baseline-audit.md
    │   └── phase-1b-owner-review.md
    └── ADR/
        ├── ADR-0001-modular-monolith.md
        ├── ADR-0002-supabase-source-of-truth.md
        ├── ADR-0003-portfolio-storage-boundaries.md
        ├── ADR-0004-crm-before-n8n-persistence.md
        ├── ADR-0005-version-1-no-erp-boundary.md
        └── ADR-0006-public-and-admin-route-separation.md
```

The two existing root blueprint files must be preserved unchanged.

Do not copy secret values into documentation.

---

# 5. GIT BASELINE RULES

- Initialize with `git init -b main`.
- Do not add a remote.
- Do not create a feature branch.
- Do not change global Git configuration.
- Check `user.name` and `user.email`.
- If identity is already configured, create one baseline commit.
- Recommended commit message:

`chore(governance): establish ONEDECORE phase 1 baseline`

- If identity is missing, stage nothing permanently, do not invent an identity, and report:

`BASELINE_COMMIT_BLOCKED_GIT_IDENTITY_MISSING`

- Final working tree must be clean if a commit succeeds.
- Report branch, commit SHA, file list and `git status --short`.

---

# 6. PHASE 1C COMPLETION MARKER

Successful commit:

`PHASE_1C_DOCUMENTATION_AND_GIT_BASELINE_COMPLETE`

Identity-blocked result:

`PHASE_1C_DOCUMENTATION_COMPLETE_COMMIT_BLOCKED`
