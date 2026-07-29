# Consent architecture — Phase 3A1

Code mirror: `src/features/legal/consent-registry.ts`.

Status: `draft-review` — no database, API or live capture implementation.

## Six purpose codes

| Purpose code | Required | defaultChecked | Notes |
| --- | --- | --- | --- |
| `SERVICE_ENQUIRY` | yes | false | Enquiry intake when forms go live |
| `SERVICE_COMMUNICATION` | yes | false | Operational contact about enquiry/project |
| `WHATSAPP_SERVICE` | no | false | Separate channel consent; WhatsApp not live |
| `MARKETING` | no | **false** | Optional; must not be pre-ticked |
| `AI_ASSISTANCE_DISCLOSURE` | no | false | Transparency disclosure, not blanket automated-processing consent |
| `PORTFOLIO_MEDIA` | no | false | Client media reuse separate from service enquiry |

Each purpose has a versioned draft copy in `CONSENT_VERSIONS`.

## Marketing default false

- `MARKETING` version: `required: false`, `defaultChecked: false`
- `marketingConsentIsOptional()` must return `true`
- Accepting Privacy Policy or Terms of Use **does not** constitute marketing consent

## Separation rules (`CONSENT_SEPARATION_RULES`)

1. Marketing consent is optional and `defaultChecked` is false for all current versions.
2. Privacy Policy and Terms acceptance do not constitute marketing consent.
3. WhatsApp service communication requires separate channel-specific consent.
4. AI assistance disclosure is transparency, not blanket automated-processing consent.
5. Portfolio media reuse requires separate consent from general service enquiry consent.
6. No bundled channel consent or vague third-party contact permissions.
7. Future withdrawal must be as easy as granting consent.

## Future record contract

`ConsentRecordContract` type defines the intended evidence fields (consent ID, purpose, channel, copy version, withdrawal, campaign categories, actor). **Types only — no migrations.**
