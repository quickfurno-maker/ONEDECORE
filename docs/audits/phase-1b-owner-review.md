# PHASE 1B — OWNER REVIEW AND MANDATORY CORRECTIONS LOG

**Review Date:** July 24, 2026  
**Status:** Conditionally Passed (Corrections Applied)  
**Governing Inputs:** `ONEDECORE_PHASE_1B_OWNER_REVIEW_AND_PHASE_1C.md`  

---

## 1. Summary of Mandatory Corrections

The owner review of the Phase 1B Architecture Freeze established 18 mandatory technical and business corrections that supersede conflicting Phase 1B wording:

1. **Next.js Version Target:** Target vetted stable Next.js 16.x release (pinned during Phase 2 setup), not Next.js 15.
2. **Supabase Lead Persistence Before n8n:** Web forms persist to Supabase *before* n8n triggers. An n8n outage must never result in lost lead data.
3. **Meta WhatsApp Webhook Endpoint:** Inbound Meta webhooks terminate at a verified ONEDECORE server endpoint, persist message state to Supabase idempotently, and only then trigger automation.
4. **₹100-crore Benchmark Rule:** Strictly an internal quality benchmark; never a public revenue, valuation, or scale claim.
5. **No Unverified Business Claims:** No public or code assumptions regarding in-house factories, studio tours, specific hardware brands (Hettich, Blum, Hafele), warranty length, GST details, or fake testimonials.
6. **Configurable CRM Thresholds:** Lead qualification criteria, SLAs, and discount approval thresholds are configurable business policies and remain unset pending owner approval.
7. **Auditable Quote Acknowledgement:** Quote acceptances are recorded as auditable client acknowledgements, not legal digital signatures.
8. **Storage Boundaries:** Private master portfolio originals are stored separately from public optimized derivatives.
9. **RLS Policy Scope:** RLS is mandatory on 100% of API-exposed application tables; anonymous CRM access is denied by default.
10. **Repository Layout & Admin Route:** Single modular monolith layout (`src/app`, `src/features`, `src/server`, `src/components/ui`). Admin route prefix locked as `/admin`.
11. **Truthful Structured Data:** Uses valid Schema.org types (`Organization`, `LocalBusiness`, `Service`, `CreativeWork`, etc.). Prohibits unsupported `InteriorDesign` type.
12. **Typography Evaluation:** Typography pairing (*Playfair Display* + *Plus Jakarta Sans*) remains a Phase 3 showroom recommendation requiring owner approval.
