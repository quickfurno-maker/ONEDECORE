# ONEDECORE — SECURITY & PRIVACY POLICY

ONEDECORE prioritizes customer data privacy, robust authorization, and secure infrastructure.

---

## 1. Security Architecture Controls

- **Database Security:** Row Level Security (RLS) is strictly enforced on 100% of API-exposed Supabase PostgreSQL tables. Anonymous access is denied by default.
- **Service Key Protection:** The `SUPABASE_SERVICE_ROLE_KEY` is restricted exclusively to secure server-side runtimes (API routes, webhook handlers). It is never exposed in browser bundles.
- **Media Access Boundaries:** Master high-resolution portfolio originals and private CRM documents are isolated in non-public storage buckets. Public access uses approved optimized derivatives or short-lived signed URLs (max 15 minutes).
- **Meta Webhook Authentication:** All Meta WhatsApp Cloud API webhooks verify SHA256 HMAC signatures before payload processing.
- **Client Acceptance Acknowledgements:** Quotation acceptances capture immutable document hashes, client identifier, timestamp, and audit event logs.

---

## 2. Privacy & Data Minimization

- **Consent Management:** Meta WhatsApp communication requires explicit opt-in consent captured during form submission. Opt-out requests (`STOP`) immediately revoke messaging consent.
- **Data Minimization:** PII (names, phone numbers, Pune site addresses) is masked in non-essential CRM views and visible only to assigned staff roles.
- **No Public Scale Claims:** Public web pages must never feature unverified financial, project volume, or factory claims.

---

## 3. Reporting Security Vulnerabilities

If you discover a security vulnerability or credential leak:

1. **Do NOT open a public GitHub issue.**
2. Send a detailed report directly to `security@onedecore.in`.
3. Include reproduction steps, affected endpoints, and potential impact.
4. Reports will be acknowledged within 24 hours and addressed promptly.
