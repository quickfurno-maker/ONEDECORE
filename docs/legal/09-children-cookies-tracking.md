# Children, cookies and tracking — Phase 3A1

Reflected in `privacy-policy-content.ts` and `data-inventory.ts`.

## Children

- Services are intended for **adult homeowners** or authorised adults acting on their behalf.
- No deliberate marketing to children.
- Future adult-confirmation gate may be added where appropriate.
- No age inference by AI; no proof-of-age documents collected by default.

## Cookies (current)

| Type | Status |
| --- | --- |
| Essential framework / session | Present for site operation |
| Supabase auth cookies | Admin authentication only |
| Analytics cookies | **Not approved** |
| Meta Pixel | **Not approved** |
| Advertising cookies | **Not approved** |
| Session replay | **Not approved** |

No cookie-banner package is installed for non-essential tracking because non-essential tracking is not approved on the current website.

## Tracking and fingerprinting

- **No analytics** on the current public homepage path
- **No Meta Pixel**
- **No session replay**
- **No advertising cookies**
- **No device fingerprinting** — future backend collection scope pending owner decision; design intent is minimal collection

## Future review

If analytics or campaign attribution is separately owner-approved, consent architecture, processor register and this document must be updated before deployment. Until then, treat tracking as **NOT IMPLEMENTED**.
