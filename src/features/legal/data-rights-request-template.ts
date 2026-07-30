/**
 * Phase 3A1 — local data-rights request template.
 * Plain text for copy/download only; nothing is transmitted by the website.
 */

import { BUSINESS_IDENTITY } from "./business-identity.ts";

export const DATA_RIGHTS_REQUEST_TEMPLATE_INTRO =
  "Copy or download this template and send it using ONEDECORE's published data-rights contact route when available. Nothing is sent automatically from the website. No ticket or case ID is created here." as const;

export const DATA_RIGHTS_REQUEST_TEMPLATE = `${DATA_RIGHTS_REQUEST_TEMPLATE_INTRO}

---
ONEDECORE — DATA SUBJECT RIGHTS REQUEST (DRAFT TEMPLATE)
---

To: ${BUSINESS_IDENTITY.tradingName} — Data Rights Contact (pending owner input)
Date: [Enter date]

REQUEST TYPE (tick one or more):
[ ] Access — I request a copy of personal data you hold about me
[ ] Correction — I request correction of inaccurate data
[ ] Completion — I request completion of incomplete data
[ ] Update — I request updating of outdated data
[ ] Erasure — I request deletion of my personal data
[ ] Consent withdrawal — I withdraw consent for processing based on consent
[ ] Marketing opt-out — I do not wish to receive marketing communications
[ ] WhatsApp opt-out — I withdraw WhatsApp channel consent
[ ] Grievance — I wish to raise a privacy grievance
[ ] Nomination — I nominate the person below to exercise my rights on my behalf

YOUR DETAILS:
Full name: [Enter your full name]
Email: [Enter your email]
Phone: [Enter your phone number]
Preferred response channel: [Email / Phone / Post]

DETAILS OF YOUR REQUEST:
[Describe your request clearly. Include relevant dates, services or interactions if known.]

DATA YOU BELIEVE WE HOLD (optional):
[ e.g. enquiry messages, project address, phone number ]

NOMINATED PERSON (if applicable):
Name: [Enter name]
Relationship: [Enter relationship]
Contact: [Enter contact details]

DECLARATION:
I confirm that the information provided is accurate to the best of my knowledge.

Signature / Name: [Enter your name]
Date: [Enter date]

---
IMPORTANT:
- This template is for your convenience only.
- Nothing is sent when you copy or download this text from the website.
- Send your completed request to the published data-rights contact route: pending owner input.
- ONEDECORE may request reasonable identity verification before responding.
---
`.trim();

export function getDataRightsRequestTemplateText(): string {
  return DATA_RIGHTS_REQUEST_TEMPLATE;
}
