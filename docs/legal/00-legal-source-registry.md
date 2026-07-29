# Legal source registry — Phase 3A1.1

Authoritative Indian DPDP references for ONEDECORE legal architecture.  
Code mirror: `src/features/legal/legal-sources.ts`  
**Registry count: 4** (must match `LEGAL_SOURCE_REGISTRY_COUNT`).

## Allowlisted authorities

- India Code
- Ministry of Electronics and Information Technology (MeitY)
- Gazette of India (when an exact official notification is registered)

## Registered sources

| ID | Title | Authority | Type | Publication date | URL |
| --- | --- | --- | --- | --- | --- |
| `dpdp-act-2023` | Digital Personal Data Protection Act, 2023 | India Code | primary-legislation | 2023-08-11 | https://www.indiacode.nic.in/handle/123456789/22037 |
| `dpdp-rules-2025` | Digital Personal Data Protection Rules, 2025 | MeitY | subordinate-rules | 2025-11-14 | https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa |
| `dpdp-enforcement-timeline-2025` | Enforcement Timeline for the DPDP Act | MeitY | implementation-timeline | 2025-11-14 | Same MeitY landing (distinct listed document) |
| `dpdp-rules-2025-corrigendum` | Corrigendum G.S.R. 892(E) | Gazette of India | corrigendum | 2025-12-11 | Parent MeitY landing; exact egazette PDF URL pending verification |

## Enforcement Timeline (registered source)

The Enforcement Timeline is a **real registry entry** (`dpdp-enforcement-timeline-2025`), not only a prose note. It shares the MeitY Rules document landing URL because MeitY lists the Timeline alongside the Rules on that page; the entry title and `sourceType` identify the distinct document.

## Staged commencement

1. **November 2025 — institutional and procedural provisions**
2. **Rule 4 and consent-manager provisions — one year after notification**
3. **Rules 3, 5–16, 22–23 and linked operational provisions — eighteen months after notification**

## Corrigendum

December 2025 corrigendum **G.S.R. 892(E)** is registered as `dpdp-rules-2025-corrigendum` with status `pending-official-url` until an exact Official Gazette / India Code PDF URL is verified without secondary aggregators.

## Readiness statement

**Designed for DPDP readiness; owner, operational and Indian legal-counsel review remain pending.**

ONEDECORE does **not claim DPDP compliance** at this draft stage. Final compliance depends on applicable commencement, approved operational processes, processor contracts, implemented safeguards and qualified Indian legal review.
