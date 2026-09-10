# ONEDECORE — SECURITY & PRIVACY POLICY

ONEDECORE prioritizes customer data privacy, robust authorization, and secure
infrastructure.

Claims in this document are backed by tests in the repository. Where a control
is asserted by a suite, the suite is named, so a reader can check rather than
trust.

---

## 1. Database security

- **Row Level Security is mandatory.** Every table in the public schema has RLS
  enabled — asserted dynamically, so a new table without it fails CI rather
  than shipping.
- **FORCE RLS is a reviewed subset, not universal.** It additionally binds the
  table owner, and is required where owner bypass must not become an escape
  hatch: salary, commerce, attendance submissions and campaign metrics.
  Elsewhere, owner-side `SECURITY DEFINER` workflows are the intended
  mechanism, so claiming FORCE everywhere would be false.
- **SECURITY DEFINER functions are governed by an explicit privilege
  contract.** Every one pins a safe `search_path` — the value is checked, not
  merely its presence, because `search_path=public` is pinned and useless. The
  set of functions callable anonymously is frozen and reviewed: two quotation
  capability RPCs and five public commerce reads.
- **Service-only tables use RLS with zero policies.** That combination is
  default-deny and is the mechanism, not an oversight. Those tables also grant
  nothing to `anon` or `authenticated`, so the denial holds at both the
  privilege and policy layers.
- **The end-user role cannot bypass RLS.** `authenticated` holds no `TRUNCATE`,
  `TRIGGER` or `REFERENCES` on any public table. TRUNCATE in particular is not
  subject to RLS, so holding it would have made the row-level protections
  ornamental.
- **`anon` can only read.** Four published portfolio tables, nothing else, and
  no write privilege anywhere.

Asserted by `supabase/tests/database/57_database_security_contracts_test.sql`
and `58_consent_visibility_behaviour_test.sql`.

## 2. Application and credential boundaries

- **The service-role key never reaches a browser.** It is server-only, refused
  if it looks like a publishable key, and usable only against a validated
  target.
- **One validated Supabase target.** In production the managed ONEDECORE
  project or nothing; outside production, that or a strict loopback stack. The
  browser client, the cookie-scoped server client and the service-role client
  all resolve through the same predicates.
- **Cryptographic domains are separate.** Lead fingerprinting, Landing Lab
  publication signing, campaign execution context and quotation capability
  tokens each have their own secret, with no fallback between them. Sharing one
  would mean rotating either silently breaks the other.
- **Media access boundaries.** High-resolution portfolio originals and private
  CRM documents live in non-public buckets; public access uses approved
  derivatives or short-lived signed URLs.
- **Meta webhook authentication.** Inbound WhatsApp webhooks verify the SHA-256
  HMAC signature before any payload is processed.
- **Quotation acceptance** captures immutable document hashes, client
  identifier, timestamp and audit events.
- **Uploaded workbooks are bounded before they are parsed, in two stages.** A
  bulk-import `.xlsx` is a ZIP. Its central directory is first checked against
  declared entry count, per-entry and total uncompressed size, and expansion
  ratio, and rejected for ZIP64, encryption, macros, absolute paths or
  traversal. Because a directory can declare one size and inflate to another,
  every entry is then inflated under a hard output ceiling — counted and
  discarded, aborting mid-stream when a per-entry or whole-archive limit is
  crossed — and required to match its declaration. Both stages run before
  ExcelJS sees the file.
- **Production HTTP responses are configured with a Content-Security-Policy
  and HSTS**, alongside the existing nosniff, referrer-policy, frame-deny and
  permissions-policy headers. The policy is enforced and static-compatible
  rather than nonce-based: it bounds where scripts, styles, images, fonts,
  connections, frames and form posts may come from, and it does not stop an
  injected inline script. Development ships neither header.
- **Production high and critical dependency advisories fail CI.** `npm run
  verify:dependencies` audits production dependencies on every Application
  Quality run. An unfixable finding requires a reviewed exception naming its
  reachability, compensating control and expiry, matched against the exact
  advisory, package, severity and installed dependency path — so a decision
  taken about one location cannot excuse the same advisory somewhere else. An
  exception that matches no current finding fails as stale.

These four controls are **configured in this repository and merged**. Whether
they are live on onedecore.in depends on a deployment, which this repository
does not perform.

## 3. Consent

The public consultation form (`public-consult-v4`) records exactly two consent
purposes, both from the single checkbox the visitor actually reads:

- `SERVICE_ENQUIRY` — website form
- `SERVICE_COMMUNICATION` — phone

**It does not capture WhatsApp service consent, and it does not capture
marketing consent.** Those are distinct purposes with their own lawful basis
and their own copy, and neither may be inferred from a consultation
submission. An optional consent nobody was asked for is recorded as absent, not
as `false` — a `false` implies a question that was declined.

Consent rows are append-only from outside the database: no role writes
`consent_events` directly, not `authenticated` and not `service_role`. Every
row is produced by a postgres-owned `SECURITY DEFINER` routine.

Visibility is scoped twice over: CRM staff see consent only for leads they can
see, and the separate marketing-manager path is restricted to `MARKETING` rows
and still requires a visible lead for that contact. Both are proven behaviourally
against real roles, not by reading policy text.

### Opt-out is a required behaviour, not a shipped one

There is no STOP handling in this codebase today, and WhatsApp messaging is OFF
and fail-closed, so nothing is currently sending anything a customer would need
to stop. Saying otherwise would describe a control that does not exist.

When outbound messaging is activated, opt-out handling must update the CRM
consent and suppression source of truth through an explicit governed flow.
Receiving an inbound message must not, by itself, fabricate or infer a consent
withdrawal: a webhook payload is a claim about what someone typed, and consent
state is a legal record. The two are connected by a reviewed path or not at
all.

## 4. Privacy and data minimization

- PII — names, phone numbers, Pune site addresses — is masked in non-essential
  CRM views and visible only to appropriately scoped staff roles.
- Public pages must never feature unverified financial, project-volume or
  factory claims.

## 5. Reporting security vulnerabilities

If you discover a security vulnerability or credential leak:

1. **Do NOT open a public GitHub issue.**
2. Send a detailed report to `security@onedecore.in`.
3. Include reproduction steps, affected endpoints, and potential impact.
4. Reports are acknowledged within 24 hours and addressed promptly.
