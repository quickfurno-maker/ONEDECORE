# ONEDECORE — MASTER BLUEPRINT, PROJECT ARCHITECTURE & PHASE 1 EXECUTION PROMPT

**Document status:** Locked working blueprint  
**Project:** ONEDECORE  
**Tagline:** One Vision. Complete Interiors.  
**Domain:** onedecore.in  
**Launch market:** Pune, India  
**Working directory:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore`  
**Execution environment:** Antigravity with Gemini  
**Current authorized phase:** Phase 1A — Read-only baseline audit only  

---

# 1. PURPOSE OF THIS DOCUMENT

This Markdown file is the current source of truth for ONEDECORE.

It defines:

- Locked business identity
- Version 1 boundaries
- Technical architecture
- Public website structure
- Dedicated portfolio architecture
- Supabase responsibilities
- CRM scope
- WhatsApp and n8n boundaries
- Recommended repository structure
- Documentation structure
- Complete implementation phases
- Step-by-step execution gates
- Exact Phase 1A Antigravity + Gemini prompt

Antigravity and Gemini must not silently change these decisions.

Any contradiction, uncertainty or proposed change must be reported before implementation.

---

# 2. LOCKED BUSINESS TRUTH

## Brand

- **Brand:** ONEDECORE
- **Tagline:** One Vision. Complete Interiors.
- **Domain:** onedecore.in
- **Initial launch city:** Pune
- **Deployment target:** Hostinger VPS
- **Repository:** Independent ONEDECORE GitHub repository
- **Separation:** Completely separate from QuickFurno and Jarvis

## Initial services

1. Complete Home Interiors
2. Modular Kitchens
3. Custom Wardrobes

The architecture may support future service expansion, but Version 1 must focus on these three services.

## Product definition

ONEDECORE will be a premium interior-business web application.

It is:

- More capable than a brochure website
- More focused than a full ERP
- Designed for premium client acquisition
- Designed for project storytelling
- Designed for sales and client management
- Designed for official WhatsApp communication
- Designed for controlled operational automation

## Target perception

The website should create the impression of an established ₹100-crore premium interior company through:

- Exceptional architectural imagery
- Editorial typography
- Generous spacing
- Controlled cinematic motion
- Strong project storytelling
- Confident premium copy
- Excellent mobile performance
- Visual consistency
- Reliable lead handling

The target perception must not be created through excessive gold, loud gradients, fake statistics or excessive animation.

---

# 3. LOCKED VERSION 1 SCOPE

## Included

- Premium cinematic public website
- Separate public Portfolio page
- Individual portfolio case-study pages
- Supabase-powered portfolio CMS
- Portfolio media storage
- Lead-generation and consultation forms
- Campaign and UTM attribution
- Duplicate-lead protection
- Advanced sales CRM
- Authentication and role permissions
- Follow-ups, consultations and site visits
- Quotation records and version history
- Basic lead-to-client and project handoff
- Official Meta WhatsApp Cloud API integration
- Basic controlled n8n workflows
- Audit records
- Analytics and reporting
- Staging and production deployment

## Deferred

- Accounting and GST
- Payroll and attendance
- Complete material inventory
- Full procurement
- Vendor portal
- Customer mobile application
- Full construction-project ERP
- Autonomous AI sales agents
- Voice calling
- QuickFurno integration
- Jarvis integration

---

# 4. SYSTEM ARCHITECTURE

ONEDECORE will have five connected product layers.

| Layer | Purpose |
|---|---|
| Public experience | Premium website, services, consultation conversion and brand presentation |
| Portfolio system | Portfolio listing, project case studies, media, SEO and publishing workflow |
| Business application | CRM, follow-ups, site visits, quotations, clients and basic projects |
| Communication | Official WhatsApp messages, templates, consent and conversation history |
| Operations | n8n workflows, notifications, retry controls, logging and reporting |

## Source-of-truth boundaries

- **Supabase PostgreSQL** is the primary source of truth for structured application data.
- **Supabase Storage** stores approved portfolio media and protected CRM documents.
- **The CRM** owns lead, client and customer-operation data.
- **n8n** executes controlled workflows and must not become the permanent customer database.
- **The public website** reads only approved public content.
- **Private CRM data** must never be exposed through public storage rules or public database policies.

---

# 5. RECOMMENDED TECHNICAL ARCHITECTURE

## Application

- Next.js App Router
- TypeScript
- Tailwind CSS
- Server Components by default
- Client Components only where interaction or animation requires them
- Reusable ONEDECORE design system
- Server-side authorization
- Schema-based input validation
- Central error handling
- Structured logging
- Responsive image delivery
- Accessibility support
- Reduced-motion support

## Motion

Use a controlled motion hierarchy:

| Level | Use |
|---|---|
| Ambient | Gentle hero depth, light, grain and background movement |
| Reveal | Headings, images and section transitions |
| Interactive | Buttons, cards, filters and navigation feedback |
| Cinematic | Selected hero or portfolio storytelling sequences |

Rules:

- Maximum one major cinematic sequence per viewport
- Do not delay enquiry actions
- Mobile receives lighter motion
- Content remains understandable without animation
- Reduced-motion mode must be respected
- Performance must be checked after every public-site phase

Recommended tools:

- GSAP for flagship sequences only
- CSS animation or one lightweight motion library for smaller interface transitions
- Native browser transitions where sufficient

Do not use multiple animation systems everywhere.

## Supabase

Create a separate ONEDECORE Supabase project containing:

- PostgreSQL database
- Authentication
- Role-based access control
- Row-Level Security
- Public portfolio storage
- Private CRM storage
- Activity and audit history
- Backup and migration strategy

## Deployment

- Independent GitHub repository
- Hostinger VPS
- Nginx
- PM2
- HTTPS
- Staging environment
- Production environment
- Automated backups
- Rollback process
- n8n separated from the main Node.js process, even if initially hosted on the same VPS

---

# 6. PUBLIC WEBSITE ARCHITECTURE

## Primary sitemap

- Home
- About
- Services
- Complete Home Interiors
- Modular Kitchens
- Custom Wardrobes
- Portfolio
- Individual Project Case Studies
- Process
- Materials and Craftsmanship
- Testimonials
- Contact
- Book a Consultation
- Pune service and location SEO pages
- Privacy Policy
- Terms and Conditions

## Homepage sequence

1. Cinematic full-screen hero
2. Brand proposition
3. Selected signature projects
4. Services
5. ONEDECORE design philosophy
6. Before-and-after transformation
7. Design-to-execution process
8. Materials and craftsmanship
9. Numbers and credibility
10. Client stories
11. Final consultation experience
12. Premium footer

## Conversion system

- Persistent WhatsApp action
- Book Consultation CTA
- Get Interior Estimate CTA
- Site Visit CTA
- Multi-step enquiry form
- Campaign and UTM capture
- Lead-source attribution
- Consent recording
- Duplicate-lead control
- Mobile click-to-call
- Mobile WhatsApp action

---

# 7. DEDICATED PORTFOLIO ARCHITECTURE

## Separation of responsibilities

### Homepage

The homepage displays only selected signature projects.

### Portfolio page

The dedicated `/portfolio` page displays the complete approved public portfolio.

### Project case-study pages

Each published project may have its own SEO-friendly case-study page.

### CRM Portfolio Manager

Authorized team members can create, edit, review, publish, unpublish and archive portfolio content.

## Portfolio page capabilities

- Editorial project grid
- Featured projects
- Category filters
- Room filters
- Service filters
- Design-style filters
- Location filters
- Controlled pagination or progressive loading
- Responsive image loading
- Mobile-friendly filter interface
- Empty-filter states
- Consultation CTA
- SEO-friendly content

## Initial service categories

- Complete Home Interiors
- Modular Kitchens
- Custom Wardrobes

## Configurable room tags

- Living Room
- Kitchen
- Bedroom
- Wardrobe
- Dining Area
- Foyer
- Study
- TV Unit
- Utility
- Other

These must be data-driven and configurable rather than permanently hardcoded into UI components.

## Case-study fields

A project case study may contain:

- Project title
- Slug
- Location
- Service category
- Property type
- Design style
- Scope of work
- Project overview
- Client requirement
- Design solution
- Materials used
- Colour palette
- Timeline
- Challenges
- Cover image
- Before images
- After images
- Ordered gallery
- Optional video
- Room tags
- Featured status
- Homepage visibility
- SEO title
- Meta description
- Open Graph image
- Image alt text
- Publication date
- Draft, published or archived status
- Consultation CTA
- Ownership/publication-right record

Fields with unavailable or unverified information must remain hidden rather than displaying invented content.

## Portfolio publishing states

- Draft
- In Review
- Approved
- Published
- Unpublished
- Archived

## Media requirements

- Multiple images per project
- Cover-image selection
- Manual ordering
- Image metadata
- Alt text
- Responsive sizing
- Compression workflow
- Modern web formats
- Progressive loading
- Optional blur placeholders
- Video validation
- File replacement
- Soft deletion where suitable
- Orphaned-file cleanup
- Ownership and publication-right tracking

Third-party inspiration images must never be published as completed ONEDECORE projects without verified ownership and commercial publication rights.

---

# 8. SUPABASE RESPONSIBILITIES

Supabase will support:

- Authentication
- Team profiles
- Roles and permissions
- Portfolio projects
- Portfolio categories
- Portfolio tags
- Portfolio media
- Homepage featured-project selection
- Leads
- Lead sources
- UTM data
- Consent records
- CRM activities
- Follow-ups
- Tasks
- Consultations
- Site visits
- Quotations
- Quotation versions
- Client records
- Basic project records
- WhatsApp conversations
- WhatsApp messages
- Delivery status
- Opt-out records
- Application settings
- Automation controls
- Audit logs
- Private documents

## Recommended storage separation

### Public portfolio media

For approved public content:

- Project cover images
- Galleries
- Before-and-after media
- Project videos
- Service-page media
- Approved testimonial media

### Private CRM documents

For protected information:

- Quotation PDFs
- Client documents
- Site-visit documents
- Measurement files
- Internal project files
- Restricted attachments

### Controlled brand and team assets

For:

- Brand assets
- Team images
- Controlled content-management uploads

Public portfolio media and private CRM documents must not share unrestricted access policies.

## Required controls

- Row-Level Security
- Least-privilege policies
- Server-side authorization
- MIME-type validation
- File-size validation
- Upload ownership records
- Audit history
- Safe migrations
- Soft deletion where suitable
- Duplicate protection
- Backup and restore plan
- Storage cleanup
- Staging and production separation
- Service-role credentials used only on trusted server paths

---

# 9. CRM ARCHITECTURE

## Pipeline

New Lead  
→ Contacted  
→ Qualified  
→ Consultation  
→ Site Visit  
→ Design Discussion  
→ Estimate  
→ Negotiation  
→ Won or Lost

## Roles

- Super Admin
- Management
- Sales
- Designer
- Project / Operations
- Content Manager

Role permissions must be designed before CRM screens are implemented.

## Core modules

- Executive dashboard
- Lead inbox
- Kanban pipeline
- Lead profile
- Activity timeline
- Follow-ups
- Reminders
- Tasks
- Consultations
- Site visits
- Quotations
- Clients
- Basic projects
- WhatsApp conversations
- Portfolio management
- Team and roles
- Lead-source analytics
- Settings
- Automation controls
- Audit logs

## Example portfolio permissions

- Content Manager can create and edit drafts.
- Management can approve and publish.
- Sales can view published portfolio content.
- Only specifically authorized roles can delete or archive assets.
- Public users can access only published portfolio content.
- Private CRM records remain inaccessible to public website users.

---

# 10. WHATSAPP AND N8N BOUNDARY

## Official WhatsApp

Use Meta WhatsApp Cloud API only.

Planned capabilities:

- Webhook verification
- Webhook security
- Approved templates
- CRM conversation history
- Delivery status
- Read status where available
- Consent
- Opt-out
- Manual messaging controls
- Failure visibility

No unofficial WhatsApp Web automation.

No autonomous AI sales agent in Version 1.

## Controlled n8n workflows

Initial workflows:

- New-lead acknowledgement
- Internal lead notification
- Follow-up reminder
- Consultation confirmation
- Site-visit reminder
- Quotation notification
- Overdue-lead escalation

Each workflow requires:

- Duplicate protection
- Idempotency
- Retry limits
- Failure logging
- Consent validation
- Manual pause switch
- Admin visibility
- Clear CRM/n8n ownership

---

# 11. RECOMMENDED REPOSITORY STRUCTURE

This is the target structure for a single, maintainable ONEDECORE repository.

Do not create it during Phase 1A.

```text
OneDecore/
├── .github/
│   ├── workflows/
│   └── pull_request_template.md
├── docs/
│   ├── 00-project-truth.md
│   ├── 01-prd.md
│   ├── 02-architecture.md
│   ├── 03-design-system.md
│   ├── 04-data-model.md
│   ├── 05-security-rls.md
│   ├── 06-portfolio-content-model.md
│   ├── 07-crm-workflows.md
│   ├── 08-whatsapp-n8n-boundary.md
│   ├── 09-deployment-runbook.md
│   ├── 10-backup-rollback.md
│   ├── 11-testing-strategy.md
│   ├── 12-seo-content-governance.md
│   ├── ADR/
│   └── audits/
├── public/
│   ├── brand/
│   ├── placeholders/
│   └── static/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── about/
│   │   │   ├── services/
│   │   │   ├── portfolio/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/
│   │   │   ├── process/
│   │   │   ├── craftsmanship/
│   │   │   ├── testimonials/
│   │   │   ├── contact/
│   │   │   ├── consultation/
│   │   │   ├── pune/
│   │   │   └── legal/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       ├── leads/
│   │   │       ├── pipeline/
│   │   │       ├── consultations/
│   │   │       ├── site-visits/
│   │   │       ├── quotations/
│   │   │       ├── clients/
│   │   │       ├── projects/
│   │   │       ├── portfolio/
│   │   │       ├── whatsapp/
│   │   │       ├── team/
│   │   │       ├── analytics/
│   │   │       ├── audit/
│   │   │       └── settings/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── brand/
│   │   ├── layout/
│   │   ├── forms/
│   │   ├── motion/
│   │   ├── portfolio/
│   │   └── crm/
│   ├── features/
│   │   ├── portfolio/
│   │   ├── enquiries/
│   │   ├── leads/
│   │   ├── consultations/
│   │   ├── site-visits/
│   │   ├── quotations/
│   │   ├── clients/
│   │   ├── projects/
│   │   ├── whatsapp/
│   │   ├── automation/
│   │   ├── analytics/
│   │   └── auth/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── auth/
│   │   ├── validation/
│   │   ├── logging/
│   │   ├── errors/
│   │   ├── seo/
│   │   ├── media/
│   │   └── utilities/
│   ├── server/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── authorization/
│   │   └── integrations/
│   ├── config/
│   ├── types/
│   ├── styles/
│   └── middleware.ts
├── supabase/
│   ├── migrations/
│   ├── seed/
│   ├── tests/
│   └── README.md
├── automation/
│   └── n8n/
│       ├── workflows/
│       ├── contracts/
│       └── README.md
├── infra/
│   ├── nginx/
│   ├── pm2/
│   ├── scripts/
│   └── README.md
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   └── visual/
├── .env.example
├── .gitignore
├── package.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.*
├── README.md
└── CHANGELOG.md
```

## Structural rules

- Keep domain logic inside `features`, `server/services` or repositories—not page components.
- Keep Supabase queries out of visual components.
- Keep server-only credentials away from client bundles.
- Keep public and admin route groups separate.
- Keep portfolio publishing logic centralized.
- Keep all schema changes in versioned migrations.
- Keep n8n workflow exports version-controlled but operationally separated.
- Keep infrastructure files documented.
- Avoid premature microservices.
- Avoid a monorepo until a real need appears.
- Avoid building a generic ERP framework.

---

# 12. INITIAL DATA DOMAINS

These are planning domains, not authorization to create tables during Phase 1A.

## Identity and access

- users
- profiles
- roles
- permissions
- user_roles

## Portfolio

- portfolio_projects
- portfolio_media
- portfolio_categories
- portfolio_tags
- portfolio_project_tags
- portfolio_publication_history
- portfolio_rights_records

## Leads and CRM

- leads
- lead_sources
- lead_activities
- follow_ups
- tasks
- consultations
- site_visits

## Commercial

- quotations
- quotation_versions
- quotation_items
- clients
- projects
- project_documents

## Communication

- whatsapp_contacts
- whatsapp_conversations
- whatsapp_messages
- whatsapp_templates
- communication_consents
- opt_outs

## Operations

- automation_rules
- automation_runs
- integration_failures
- audit_logs
- application_settings

Exact table names, relationships, constraints and policies must be designed and reviewed in a later gated phase.

---

# 13. UPDATED IMPLEMENTATION PHASES

## Phase 1 — Project truth, audit and master blueprint

- Read-only folder inspection
- Asset inventory
- Code and configuration inventory
- Secret and licensing-risk review
- Freeze sitemap
- Freeze homepage sequence
- Freeze portfolio architecture
- Freeze visual direction
- Freeze CRM roles and pipeline
- Define data domains
- Define repository structure
- Create architecture and decision documents
- Establish safe Git baseline after approval

## Phase 2 — Engineering and Supabase foundation

- Next.js application foundation
- TypeScript and Tailwind
- Folder architecture
- Environment validation
- Supabase project
- Authentication
- Roles and permissions
- Row-Level Security
- Storage boundaries
- Logging
- Validation
- Testing foundation
- Staging workflow

## Phase 3 — ONEDECORE design system

- Colour tokens
- Typography
- Spacing
- Layout grid
- Components
- Forms
- Portfolio cards
- CRM controls
- Image treatments
- Motion tokens
- Responsive rules
- Accessibility
- Internal visual showroom

## Phase 4 — Cinematic homepage

- Navigation
- Hero
- Signature projects
- Services
- Philosophy
- Process
- Craftsmanship
- Testimonials
- Conversion
- Footer
- Mobile and performance validation

## Phase 5 — Dedicated portfolio and case-study system

- Portfolio page
- Filters
- Case-study template
- Supabase portfolio records
- Supabase media storage
- Portfolio CMS
- Publishing workflow
- Rights and ownership records
- SEO metadata
- Responsive image system

## Phase 6 — Complete public website

- About
- Service pages
- Process
- Materials and Craftsmanship
- Testimonials
- Contact
- Consultation flow
- Legal pages
- Pune SEO pages
- Analytics
- Attribution
- Lead forms

## Phase 7 — CRM foundation

- Dashboard
- Leads
- Pipeline
- Activity timeline
- Follow-ups
- Tasks
- Consultations
- Site visits
- Team
- Roles
- Portfolio administration
- Analytics
- Audit logs

## Phase 8 — Commercial workflow

- Quotations
- Quote versions
- Documents
- Negotiation
- Lead-to-client conversion
- Basic project records
- Reporting
- Portfolio candidate workflow

## Phase 9 — WhatsApp and n8n

- Meta WhatsApp Cloud API
- Webhooks
- Templates
- Conversation history
- Message statuses
- Consent and opt-out
- Controlled n8n workflows
- Retry and failure visibility

## Phase 10 — Hardening and launch

- Cross-device testing
- Visual testing
- Performance audit
- Accessibility audit
- RLS and security audit
- Form and duplicate-lead testing
- Portfolio policy testing
- WhatsApp sandbox testing
- SEO audit
- Backup and restore test
- Staging approval
- VPS deployment
- Rollback verification
- Live critical-path testing

---

# 14. STEP-BY-STEP EXECUTION PROTOCOL

ONEDECORE will be implemented using strict phase gates.

## Operating rule

For every subphase:

1. Read the project truth and latest approved architecture.
2. Inspect the current repository state.
3. Report contradictions before changing files.
4. State the exact allowed scope.
5. Perform only the authorized work.
6. Run applicable validation.
7. List files changed.
8. List commands executed.
9. Report risks and remaining work.
10. Stop at the approval gate.

## Required progression

### Step 1 — Run Phase 1A only

Use the exact prompt in Section 15.

### Step 2 — Return the complete audit report

Do not summarize it. Preserve:

- Directory findings
- Asset findings
- Git findings
- Security findings
- Licensing findings
- Commands executed
- Files changed confirmation

### Step 3 — Owner and architecture review

Review the Phase 1A report before authorizing any file creation.

### Step 4 — Phase 1B

After explicit approval, Phase 1B will:

- Reconcile the audit with this blueprint
- Freeze the final project structure
- Freeze the final sitemap
- Freeze portfolio content architecture
- Freeze Supabase domains
- Freeze CRM roles and permission matrix
- Freeze visual direction
- Produce architecture and PRD documents
- Recommend the Git baseline procedure

### Step 5 — Phase 1C

After approval, Phase 1C will:

- Create the approved documentation files
- Initialize or cleanly establish Git only if appropriate
- Create the safe baseline commit
- Create a protected implementation checklist
- Stop before Phase 2

Do not combine Phase 1A, Phase 1B and Phase 1C into one uncontrolled action.

---

# 15. EXACT ANTIGRAVITY + GEMINI PROMPT — PHASE 1A

Copy everything from `BEGIN PROMPT` to `END PROMPT` into Antigravity.

---

## BEGIN PROMPT

# PROJECT: ONEDECORE
# PHASE: 1A — READ-ONLY PROJECT BASELINE AUDIT

You are the senior technical architect, repository auditor and asset auditor for ONEDECORE.

Use the uploaded file `ONEDECORE_MASTER_BLUEPRINT_PHASE_1.md` as the governing project source of truth.

## A. Locked project identity

- Brand: ONEDECORE
- Tagline: One Vision. Complete Interiors.
- Domain: onedecore.in
- Initial launch market: Pune, India
- Initial services:
  1. Complete Home Interiors
  2. Modular Kitchens
  3. Custom Wardrobes
- Product: premium interior-business web application
- Deployment target: Hostinger VPS
- ONEDECORE must remain completely separate from QuickFurno and Jarvis.
- Logo and typography are not finalized.

## B. Locked product layers

1. Premium public website
2. Dedicated Portfolio and project case-study system
3. Sales and client-management CRM
4. Official WhatsApp communication
5. Controlled n8n workflows

## C. Locked portfolio and Supabase requirements

- ONEDECORE requires a completely separate public Portfolio page.
- The homepage will display only selected signature projects.
- Every eligible portfolio project may have an individual case-study page.
- Portfolio records, categories, tags, descriptions, publication status and media metadata will use the separate ONEDECORE Supabase project.
- Approved portfolio images, renders and videos will use Supabase Storage.
- CRM records, leads, clients, activities, quotations, permissions, audit logs and other required structured data will use Supabase.
- Public portfolio media and private CRM documents must use separate storage and security policies.
- The CRM will include portfolio content management.
- Portfolio projects require controlled draft, review, approval, publication, unpublication and archive states.
- Inspiration images and third-party work must never be published as ONEDECORE completed projects without verified ownership and commercial publication rights.
- Supabase PostgreSQL will be the source of truth for structured application data.
- n8n will not be used as the permanent customer or portfolio database.

## D. Working directory

`C:\Users\KESHAV SHARMA\Desktop\OneDecore`

Inspect only this project directory.

Do not inspect unrelated folders outside this directory unless a file inside the project explicitly references them. Report external references without opening unrelated private files.

## E. Operating mode

READ-ONLY AUDIT ONLY.

You are not authorized to create, edit, delete, rename, move, format, install, scaffold, initialize, configure, migrate, deploy or generate anything.

### Strictly prohibited

Do not:

- Create any file or directory
- Edit any file
- Delete any file
- Rename or move anything
- Auto-format files
- Initialize Git
- Change Git configuration
- Create branches or commits
- Install packages
- Update dependency lockfiles
- Create a Next.js application
- Generate production UI
- Generate a logo
- Finalize fonts
- Connect Supabase
- Create Supabase tables, policies, buckets or migrations
- Connect WhatsApp
- Connect n8n
- Connect Hostinger
- Run deployment
- Print secret values
- Copy project contents elsewhere
- Open unrelated private user files

Commands must be limited to safe inspection operations.

## F. Audit requirements

### 1. Directory baseline

Report:

- Complete non-secret directory tree
- Exclude generated folders such as node_modules, .next, dist, build, coverage and caches
- Whether the directory is empty, asset-only, an existing application, partial application, template or production project
- Important hidden configuration files
- Unexpected project links or nested repositories

### 2. Application inspection

Verify:

- Whether application code exists
- Framework and version
- Node and package-manager requirements
- App Router, Pages Router or other routing
- Existing routes
- Components
- Styling system
- Animation libraries
- Forms and validation
- State management
- API routes
- Server actions
- Authentication
- Supabase usage
- Database code
- CRM code
- Portfolio code
- Image-management code
- WhatsApp code
- n8n code
- Testing
- Linting
- Formatting
- Error handling
- Logging
- Deployment configuration
- Staging or production configuration

Do not assume that a package is actively used merely because it is listed. Verify actual usage where practical.

### 3. Portfolio inspection

Specifically report:

- Existing Portfolio routes
- Project detail routes
- Existing project cards
- Existing gallery components
- Filtering code
- Media ordering logic
- Cover-image logic
- Draft or publication status logic
- Existing CMS controls
- Existing image upload code
- Existing Supabase Storage references
- Existing storage bucket names without exposing credentials
- Public/private storage policy concerns
- SEO fields for portfolio projects
- Image alt-text handling
- Ownership or rights metadata
- Any conflict with the dedicated Portfolio requirement

### 4. Asset inventory

Identify:

- Logo files
- Icons
- Fonts
- Photographs
- Architectural renders
- Videos
- Documents
- Inspiration/reference assets
- Stock assets
- Existing design-system assets

For media, report where possible:

- Filename
- Relative path
- Format
- Dimensions
- Orientation
- Approximate file size
- Apparent quality
- Watermarks
- Social-media overlays
- Third-party branding
- Possible copyright concerns
- Suitability for:
  - Desktop hero
  - Mobile hero
  - Homepage signature project
  - Portfolio card
  - Project case study
  - Detail image
  - Background

Also report:

- Missing image categories
- Missing Custom Wardrobe imagery
- Assets suitable only as inspiration
- Assets that may represent genuine ONEDECORE work only where evidence exists
- Inconsistent visual styles
- Low-resolution or duplicated media
- Horizontal versus portrait-image availability

Do not claim ownership unless the project contains supporting evidence.

### 5. Git baseline

When Git exists, report:

- Current branch
- Clean or dirty state
- Modified files
- Untracked files
- Local branches
- Remotes
- Existing commits
- Latest commit summary
- Nested repositories
- References to QuickFurno, Jarvis or unrelated repositories

Do not initialize or change Git.

### 6. Environment and secrets

Report environment-variable names only.

Never reveal values.

Safely check:

- .env
- .env.local
- .env.production
- .env.development
- Example environment files
- Hardcoded-looking credentials

For a possible secret, report only:

- Relative path
- Approximate line or area
- Secret category
- Risk level

Mask values completely.

### 7. Licensing and originality

Look for:

- Copied templates
- Theme marketplace code
- Third-party branding
- Unlicensed fonts
- Watermarked media
- Social-media downloads
- Code copied from another company project
- QuickFurno or Jarvis code
- Missing attribution
- Placeholder projects that may be mistaken for ONEDECORE work

Classify every finding as:

- Verified
- Likely
- Possible
- Not determinable

Do not make unsupported accusations.

### 8. Requirement conflict analysis

Compare the current folder with the uploaded master blueprint.

Report every verified or probable conflict, including:

- ONEDECORE independence
- Dedicated Portfolio requirement
- Premium visual direction
- Generic SaaS styling
- Excessive animation
- Mobile-performance risk
- Public/private data separation
- Supabase boundaries
- CRM ownership of customer data
- Official WhatsApp requirement
- Controlled n8n boundary
- Version 1 no-ERP boundary

### 9. Retention classification

Classify current items into:

1. SAFE TO RETAIN
2. RETAIN AFTER REVIEW
3. REPLACE
4. REMOVE LATER
5. OWNERSHIP OR LICENSING VERIFICATION REQUIRED

Do not perform any change.

## G. Required report format

Return one complete report using exactly these primary headings:

# VERIFIED BASELINE

# DIRECTORY AND APPLICATION INVENTORY

# PORTFOLIO FINDINGS

# ASSET INVENTORY

# TECHNICAL FINDINGS

# GIT BASELINE

# SECURITY AND SECRETS REVIEW

# LICENSING AND ORIGINALITY RISKS

# REQUIREMENT CONFLICTS

# SAFE TO RETAIN

# REPLACE OR VERIFY

# RECOMMENDED PHASE 1B ACTIONS

# COMMANDS EXECUTED

# FILES CHANGED: NONE

Under `COMMANDS EXECUTED`, list every inspection command that was run.

Confirm that no command changed project files, repository state or external services.

Do not begin Phase 1B.

Do not create documentation files.

Do not provide production implementation code.

Do not generate the homepage.

Do not create the Portfolio page.

Do not configure Supabase.

End with exactly:

PHASE_1A_READ_ONLY_AUDIT_COMPLETE

## END PROMPT

---

# 16. EXPECTED PHASE 1A OUTPUT

The audit should answer:

- What already exists?
- What assets exist?
- Which assets are usable?
- Which assets need ownership verification?
- Is the folder clean or mixed with another project?
- Does Git already exist?
- Is any Supabase or CRM work already present?
- Is any portfolio functionality already present?
- Are secrets at risk?
- What can be retained?
- What must be replaced?
- What should Phase 1B freeze?

Any report that modifies files or starts implementation has violated Phase 1A.

---

# 17. PHASE 1 COMPLETION DEFINITION

Phase 1 is complete only when all three subphases are finished and approved.

## Phase 1A

Read-only audit complete.

## Phase 1B

Master blueprint reconciled and final decisions frozen.

## Phase 1C

Approved documentation and safe repository baseline created.

Only then may Phase 2 begin.

---

# 18. CURRENT NEXT ACTION

1. Upload this Markdown file into Antigravity.
2. Open `C:\Users\KESHAV SHARMA\Desktop\OneDecore`.
3. Select the strongest available Gemini coding/reasoning model.
4. Paste the Phase 1A prompt from Section 15.
5. Allow read-only inspection only.
6. Copy the complete final audit report.
7. Return the complete report for Phase 1B review.
8. Do not authorize implementation until the audit is reviewed.

---

**Current status:** Phase 1A authorized; implementation not authorized.  
**Next gate:** Owner review of the read-only audit.
