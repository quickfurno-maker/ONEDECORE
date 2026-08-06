# ADR-0022: V1 Direct Quotation Finalization and Send Authority

**Status:** Accepted  
**Date:** August 6, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Commercial Quotation Governance (Phase 7A/7B architecture)

---

## Context and Problem Statement

The business owner removed the internal quotation approval workflow for ONEDECORE Version 1. The operational objective is faster turnaround for assigned Sales Executives while preserving commercial safety through strict ownership, server-canonical calculations, immutable finalized versions, Phase 6B controlled outbound eligibility, and explicit client acceptance before Closed-Won.

Earlier ONEDECORE documentation (including portions of ADR-0020) described a maker-checker path: Draft → Submitted for Approval → Approved → Sent. That path is **not** current V1 governance.

**No quotation runtime, migration, or managed database change is implied by this ADR.** This records locked architecture for future Phase 7 implementation.

---

## Decision Drivers

- Assigned Sales Executive must create, finalize, and send quotations for currently assigned leads without Sales Manager or Super Admin approval.
- Commercial truth must remain server/database canonical — not browser-calculated.
- Finalized quotation versions must be immutable; revisions create new draft versions.
- Customer delivery must use Phase 6B `WHATSAPP_SERVICE` controlled outbound — Phase 7 must not call Meta directly.
- Client acceptance remains the authoritative prerequisite for Closed-Won; staff cannot accept on behalf of the client.
- Sales performance achievement must use post-discount, pre-tax `taxable_base_paise`; GST must not inflate achievement.
- Kriti (human-controlled copilot) must not perform authoritative commercial mutations.

---

## Decision Outcome

### 1. Assigned Sales Executive authority

For leads **currently assigned** to the executive:

- Read, create, and edit the single mutable draft quotation version
- Finalize/freeze the draft (canonical recalculation, content hash, `frozen_at`)
- Generate/request authoritative PDF from the finalized immutable version (future Phase 7B)
- Send the finalized quotation through Phase 6B controlled outbound (`WHATSAPP_SERVICE` only)
- Create a revision after client revision request; resend eligible finalized versions

Cannot: access another executive's lead quotation; mutate frozen versions; bypass hard commercial bounds; bypass DNC/consent/WhatsApp eligibility; use `MARKETING` purpose for quotation delivery; accept on behalf of client; manually mark Closed-Won; create execution projects.

### 2. No internal quotation approval (V1)

**Removed from V1 governance:**

- `Submitted for Approval` and `Approved` quotation lifecycle states
- `quotations.approve` permission
- `quotation_approvals` table
- `quotation_approval_policies` table
- Manager or Super Admin approval as a send prerequisite
- Maker-checker quotation approval

**Current V1 workflow:**

```
Draft → Finalized/Frozen → Sent → client outcomes
```

Client outcomes: Viewed (observational), Accepted, Rejected, Revision Requested, Expired (validity condition).

### 3. Finalization (freeze)

Future `finalize_quotation_version` (or repo-equivalent) must transactionally:

- Authenticate staff and verify `quotations.finalize` permission
- Verify current lead assignment (or broad manager/admin scope)
- Recompute canonical line/section/subtotal/tax/grand totals
- Validate quotation-level discount against **hard commercial bounds** (configuration/validation — not manager approval)
- Validate payment schedule reconciliation and required customer-facing snapshot
- Compute canonical SHA-256 `content_hash`; set `frozen_at`; set `lifecycle_state = 'finalized'`
- Append audit event; make version and children immutable

No approver. No approval record. Staff changes after finalize require a **new** mutable draft version.

### 4. Discount governance

- **Quotation-level discount only** in Phase 7A V1 (no line-item discount)
- Ordinary discount may be applied by authorized Sales Executive within server-enforced hard bounds
- Hard bounds may be Super Admin configurable when implemented
- Exact bound values remain a separate owner commercial configuration decision before production
- Hard validation bounds are **not** an approval workflow

### 5. Send boundary

Send requires finalized immutable version, authoritative PDF with matching hashes, Phase 6B eligibility (ownership, DNC/suppression, service consent, template/window rules, runtime gates), and `WHATSAPP_SERVICE` purpose only.

```
Phase 7B quotation domain → Phase 6B controlled outbound service → Meta WhatsApp Cloud API
```

Phase 7B must **not** call Meta directly. No approval check before send.

### 6. Client acceptance and Closed-Won

Preserved unchanged in principle:

- Secure explicit client acknowledgement on exact finalized version/document
- One authoritative accepted quotation per lead; duplicate acceptance idempotent
- No staff `quotations.accept` permission; no raw IP — privacy-safe keyed network fingerprint only if needed
- Accepted version cannot silently become rejected/expired; revision creates new draft
- Future dedicated acceptance path must atomically drive Closed-Won with `credited_sales_executive_id` snapshot at acceptance instant
- `accepted_at` in Asia/Kolkata determines achievement month

### 7. Sales performance basis (locked)

| Metric | Source |
| :--- | :--- |
| Sales revenue achievement | `taxable_base_paise` (post-discount, pre-tax) |
| Customer payable total | `grand_total_paise` = taxable_base + tax |

GST/tax must **not** inflate Sales Executive or team revenue achievement. Accountant/legal tax configuration review remains required before production.

### 8. Sales Manager and Super Admin

- **Sales Manager:** Broad sales scope — read/create/edit/finalize/send within authorized scope; audit/history; controlled revoke/reissue when implemented. **No quotation approval action.**
- **Super Admin:** Full commercial administrative scope; configure hard bounds; audited void/revoke. **No ordinary quotation approval step.**

### 9. Project Manager and Designer

No Phase 7 quotation mutation or send authority. Future read-only commercial visibility remains Phase 8-governed.

### 10. Kriti boundary

Kriti must not authoritatively calculate commercial totals, finalize, send, accept, or mutate quotation rows.

### 11. Phase 8A boundary

Project creation remains Phase 8A only, after Closed-Won driven by accepted quotation. No execution before PM handover acceptance.

---

## Supersession

This ADR **partially supersedes** the following **quotation approval portions only** of [ADR-0020](ADR-0020-closed-won-project-handover-invariants.md):

- Sales Manager quotation approval requirement
- Draft → Submitted for Approval → Approved → Sent lifecycle
- Approval-based revision loop language

**ADR-0020 remains accepted** for all non-quotation-approval invariants: Accepted quotation prerequisite for Closed-Won; one authoritative accepted version; no project before Closed-Won; PM assignment/acceptance; Designer assignment; Phase 8 execution/design state graphs; No-ERP boundary.

---

## Consequences

### Positive

- Faster assigned-executive quotation turnaround
- Reduced maker-checker friction for routine quotes
- Clear separation between hard validation bounds and approval workflow

### Negative / trade-offs

- Greater importance of hard commercial bounds, audit trails, and ownership enforcement
- Sales Manager operational support shifts from approval gate to broad-scope assist/revise

### Implementation note

Planned permissions include `quotations.finalize`, `quotations.send`, `quotations.void` — **not** `quotations.approve`. Tables such as `quotation_pdf_documents`, `quotation_access_grants`, `quotation_delivery_events`, `quotation_client_events`, and `quotation_acceptances` are future Phase 7B scope.

---

## Related Documents

- [ADR-0020: Closed-Won Project Handover Invariants](ADR-0020-closed-won-project-handover-invariants.md) (partial quotation-approval supersession only)
- [ADR-0019: Five-Role CRM Authorization Model](ADR-0019-five-role-crm-authorization-model.md)
- [CRM & Quotation Boundary](../07-crm-and-quotation-boundary.md)
- [Decision Register DEC-0056](../10-decision-register.md)
