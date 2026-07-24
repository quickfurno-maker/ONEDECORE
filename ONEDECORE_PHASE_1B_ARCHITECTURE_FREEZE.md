# ONEDECORE — PHASE 1B ARCHITECTURE FREEZE & MASTER DECISION PROMPT

**Project:** ONEDECORE  
**Tagline:** One Vision. Complete Interiors.  
**Domain:** onedecore.in  
**Working directory:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore`  
**Governing blueprint:** `ONEDECORE_MASTER_BLUEPRINT_PHASE_1.md`  
**Previous gate:** Phase 1A completed successfully  
**Current authorized phase:** Phase 1B — Architecture and product-decision freeze  
**Implementation authorization:** NOT GRANTED  

---

# 1. PHASE 1A REVIEW VERDICT

The Phase 1A audit confirms:

- The project directory is completely empty.
- No application code exists.
- Git is not initialized.
- No dependencies are installed.
- No Supabase, CRM, portfolio, WhatsApp or n8n implementation exists.
- No secrets or environment files were found.
- No QuickFurno or Jarvis contamination exists.
- No local brand or portfolio assets exist.
- ONEDECORE can start from a clean architecture.

## Important correction to the Phase 1A recommendations

The Phase 1A report recommended initializing Git, scaffolding Next.js, creating directories and creating `.env.example` during Phase 1B.

That recommendation conflicts with the approved phase protocol.

During **Phase 1B**, Antigravity must NOT:

- Initialize Git
- Create a Next.js project
- Install packages
- Create folders
- Create `.env.example`
- Create documentation files
- Configure Supabase
- Generate UI
- Make any filesystem change

Those actions belong to:

- **Phase 1C:** approved documentation and safe Git baseline
- **Phase 2:** Next.js and Supabase engineering foundation

Phase 1B is a decision-freezing and architecture-review phase only.

---

# 2. LOCKED PROJECT TRUTH

## Business

- Brand: ONEDECORE
- Tagline: One Vision. Complete Interiors.
- Domain: onedecore.in
- Launch market: Pune, India
- Initial services:
  1. Complete Home Interiors
  2. Modular Kitchens
  3. Custom Wardrobes
- Product: Premium interior-business web application
- Target perception: Established ₹100-crore premium interior brand
- Deployment target: Hostinger VPS
- Independent from QuickFurno and Jarvis

## Product layers

1. Premium public website
2. Dedicated Portfolio and project case-study system
3. Sales and client-management CRM
4. Official Meta WhatsApp communication
5. Controlled n8n workflows

## Supabase boundary

A completely separate ONEDECORE Supabase project will be used for:

- PostgreSQL
- Authentication
- Roles and permissions
- Row-Level Security
- Portfolio content
- Portfolio media metadata
- Public portfolio storage
- Leads
- CRM activities
- Follow-ups
- Consultations
- Site visits
- Quotations
- Clients
- Basic project records
- WhatsApp records
- Consent
- Audit logs
- Private documents
- Settings and automation controls

Public portfolio media and private CRM documents must use different storage boundaries and policies.

## Version 1 boundary

Included:

- Premium public website
- Dedicated Portfolio
- Project case studies
- Portfolio CMS
- Sales CRM
- Quotations
- Basic project handoff
- Official WhatsApp
- Controlled n8n automation
- Analytics and audit history

Deferred:

- Accounting and GST
- Payroll
- Full inventory
- Procurement ERP
- Vendor portal
- Customer app
- Full construction ERP
- AI sales agents
- Voice calling
- QuickFurno integration
- Jarvis integration

---

# 3. EXACT ANTIGRAVITY + GEMINI PROMPT — PHASE 1B

Copy everything between `BEGIN PROMPT` and `END PROMPT` into Antigravity.

---

## BEGIN PROMPT

# PROJECT: ONEDECORE
# PHASE: 1B — ARCHITECTURE, SCOPE AND MASTER DECISION FREEZE

You are the senior product architect, software architect, security architect and information architect for ONEDECORE.

Use these sources as governing inputs:

1. `ONEDECORE_MASTER_BLUEPRINT_PHASE_1.md`
2. The completed Phase 1A audit report
3. This Phase 1B instruction file

The Phase 1A audit verified that:

- `C:\Users\KESHAV SHARMA\Desktop\OneDecore` is completely empty.
- No application code exists.
- Git is not initialized.
- No assets, secrets, packages, configuration or external integrations exist.
- No QuickFurno or Jarvis contamination exists.

## 1. Operating mode

ARCHITECTURE AND DECISION FREEZE ONLY.

This is still a non-implementation phase.

Do not create, edit, delete, rename or move any file.

Do not initialize Git.

Do not scaffold Next.js.

Do not install packages.

Do not create `.env.example`.

Do not create documentation files yet.

Do not configure Supabase.

Do not create database migrations.

Do not create storage buckets or RLS policies.

Do not generate UI.

Do not connect WhatsApp, n8n, GitHub or Hostinger.

Do not begin Phase 1C or Phase 2.

Return the complete Phase 1B decision report in chat only.

## 2. Locked business truth

- Brand: ONEDECORE
- Tagline: One Vision. Complete Interiors.
- Domain: onedecore.in
- Initial market: Pune, India
- Initial services:
  1. Complete Home Interiors
  2. Modular Kitchens
  3. Custom Wardrobes
- Product type: Premium interior-business web application
- Target perception: Established ₹100-crore premium interior company
- Deployment target: Hostinger VPS
- ONEDECORE must remain completely independent from QuickFurno and Jarvis.

## 3. Locked product architecture

ONEDECORE has five product layers:

1. Premium public website
2. Dedicated Portfolio and case-study system
3. Sales and client-management CRM
4. Official Meta WhatsApp communication
5. Controlled n8n workflows

Supabase PostgreSQL is the source of truth for structured application data.

Supabase Storage will hold approved public portfolio media and protected private CRM documents using separate security boundaries.

n8n must execute controlled workflows only and must not become the permanent customer or portfolio database.

## 4. Required Phase 1B decisions

Produce precise, implementable decisions for every section below.

### A. Final product scope

Freeze:

- Version 1 included modules
- Explicit exclusions
- Public website scope
- Portfolio scope
- CRM scope
- Quotation scope
- Client/project handoff boundary
- WhatsApp scope
- n8n scope
- Analytics scope
- Content-management scope

Identify any scope item that risks turning ONEDECORE into a full ERP and explicitly defer it.

### B. Final public sitemap

Freeze the route-level sitemap for:

- Home
- About
- Services
- Complete Home Interiors
- Modular Kitchens
- Custom Wardrobes
- Portfolio
- Project case studies
- Process
- Materials and Craftsmanship
- Testimonials
- Contact
- Consultation
- Pune SEO pages
- Privacy
- Terms
- Authentication
- Admin CRM

For each route, specify:

- Proposed URL
- Primary purpose
- Primary CTA
- Content owner
- Public, authenticated or role-restricted status
- Phase in which it will be implemented

Avoid creating duplicate routes with overlapping intent.

### C. Homepage information architecture

Freeze the exact homepage section order.

For every section, define:

- Purpose
- Required content
- Primary interaction
- Data source
- Whether content is static or Supabase-managed
- Desktop motion level
- Mobile motion level
- Performance risks
- Empty-content fallback

The homepage must show only selected signature projects and must not duplicate the full Portfolio page.

### D. Dedicated Portfolio architecture

Freeze:

- `/portfolio` listing behavior
- Project card content
- Filtering model
- Sort model
- Pagination or progressive loading choice
- Featured-project behavior
- Homepage signature-project behavior
- Project-case-study route
- Draft/review/approval/published/unpublished/archived states
- Preview rules
- Publication permissions
- Image ordering
- Cover-image selection
- Before/after handling
- Video handling
- SEO metadata
- Alt-text requirements
- Ownership and publication-right records
- Portfolio candidate workflow from CRM projects
- Orphaned-media cleanup
- Deletion and archival rules

Initial service categories:

- Complete Home Interiors
- Modular Kitchens
- Custom Wardrobes

Initial configurable room tags:

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

Do not hardcode business taxonomy into presentation components when it should be data-driven.

### E. Brand and visual-direction freeze

The current direction is Contemporary Warm Indian Luxury / Warm Architectural Luxury.

Freeze:

- Colour-token direction
- Typography selection criteria
- Recommended display-font category
- Recommended interface-font category
- Spacing character
- Grid character
- Image-treatment rules
- Button character
- Form character
- Navigation character
- CRM visual relationship to the public brand
- Mobile visual rules
- Motion hierarchy
- Accessibility rules
- Reduced-motion behavior
- Visual anti-patterns

Because the logo is not finalized:

- Define logo requirements
- Define required logo variants
- Define safe placeholder strategy
- Do not generate or finalize a logo
- Do not download or install fonts

You may recommend up to three legally usable typography pairings and identify one preferred pairing for later owner approval. Clearly mark it as a recommendation, not an implemented asset.

### F. Final repository architecture

Review the repository structure in the governing blueprint and freeze the target structure.

For every major directory, define:

- Responsibility
- What is allowed inside
- What is prohibited
- Public/server boundary
- Ownership of domain logic
- Testing location
- Documentation location
- Infrastructure location
- n8n workflow location
- Supabase migration location

Make an explicit decision on:

- Single repository versus monorepo
- Feature-based structure
- Route groups
- Server-only modules
- Repository/service boundaries
- UI component boundaries
- Shared types
- Validation ownership
- Query ownership
- Integration adapters

The default preference is one maintainable repository, not premature microservices.

### G. Supabase domain architecture

Define conceptual domains and relationships for:

#### Identity

- profiles
- roles
- permissions
- user-role assignment

#### Portfolio

- projects
- media
- categories
- tags
- project-tag assignment
- publication history
- ownership/publication rights

#### CRM

- leads
- sources
- activities
- follow-ups
- tasks
- consultations
- site visits

#### Commercial

- quotations
- quotation versions
- quotation items
- clients
- basic projects
- documents

#### Communication

- WhatsApp contacts
- conversations
- messages
- templates
- consent
- opt-out

#### Operations

- automation controls
- automation runs
- failures
- audit logs
- settings

For each domain, define:

- Purpose
- Ownership
- Key entities
- Important relationships
- Public/private classification
- Retention considerations
- Audit requirements
- Phase of implementation

Do not write SQL in Phase 1B.

### H. Storage architecture

Freeze the storage-boundary plan.

At minimum, distinguish:

1. Approved public portfolio media
2. Private CRM and client documents
3. Controlled brand/team assets

Define:

- Public/private access model
- Upload authorization
- File type restrictions
- File size strategy
- Naming strategy
- Metadata ownership
- Replacement strategy
- Soft-delete or archival behavior
- Orphaned-file cleanup
- Signed URL usage
- Cache strategy
- Original versus optimized derivatives
- Backup and restore requirements
- Staging/production separation

Do not create bucket names unless the naming convention is explicitly marked as proposed for Phase 2 approval.

### I. Authentication, roles and permissions

Freeze the role model for:

- Super Admin
- Management
- Sales
- Designer
- Project / Operations
- Content Manager

Produce a permission matrix covering:

- Leads
- Activities
- Follow-ups
- Consultations
- Site visits
- Quotations
- Clients
- Projects
- Portfolio drafts
- Portfolio approval
- Portfolio publication
- Media deletion
- WhatsApp
- Analytics
- Users
- Settings
- Automation controls
- Audit logs

State:

- Least-privilege rules
- Server-side authorization requirements
- RLS expectations
- Sensitive-action controls
- Audit requirements
- Which actions require Management or Super Admin approval

### J. CRM workflow freeze

Freeze the pipeline:

New Lead
→ Contacted
→ Qualified
→ Consultation
→ Site Visit
→ Design Discussion
→ Estimate
→ Negotiation
→ Won or Lost

Define:

- Entry criteria
- Exit criteria
- Required fields
- Allowed transitions
- Reopening behavior
- Lost-reason handling
- Duplicate-lead behavior
- Lead-source attribution
- Follow-up rules
- Activity-timeline rules
- Consultation rules
- Site-visit rules
- Won-to-client conversion
- Basic project handoff boundary

Avoid adding accounting, procurement, inventory or full construction scheduling.

### K. Quotation boundary

Freeze:

- Quotation ownership
- Quote versioning
- Line-item model
- Status model
- PDF/document strategy
- Approval boundaries
- Revision history
- Negotiation tracking
- Client acceptance recording
- Relationship to CRM pipeline
- Relationship to basic project creation

Explicitly state what is deferred to future accounting or ERP phases.

### L. WhatsApp and n8n boundary

Freeze:

- Meta WhatsApp Cloud API as the only supported WhatsApp integration
- Consent model
- Opt-out model
- Template ownership
- Webhook ownership
- Message-history ownership
- Delivery-status handling
- Manual messaging controls
- Retry limits
- Failure visibility
- Duplicate protection
- Idempotency
- Manual pause controls
- CRM versus n8n responsibility
- Audit requirements

No unofficial WhatsApp Web automation.

No autonomous AI sales agent in Version 1.

### M. Security and privacy baseline

Freeze requirements for:

- Environment separation
- Secret handling
- Service-role usage
- Server/client boundaries
- RLS
- Input validation
- File validation
- Authorization
- Audit logging
- Rate limiting
- Webhook verification
- Consent
- Data minimization
- Backup
- Restore
- Rollback
- Error redaction
- Private-document access
- Public-portfolio publishing controls

### N. SEO and content governance

Freeze:

- Metadata ownership
- Canonical URLs
- Sitemap strategy
- Robots strategy
- Structured-data scope
- Project case-study SEO
- Service-page SEO
- Pune location-page rules
- Image alt-text ownership
- Draft content exclusion
- Duplicate-content prevention
- UTM retention
- Analytics boundary
- No fake portfolio or testimonial content

### O. Testing and quality gates

Define later implementation gates for:

- Unit tests
- Integration tests
- End-to-end tests
- RLS tests
- Role-permission tests
- Visual regression
- Accessibility
- Mobile behavior
- Performance
- Portfolio workflow
- Upload validation
- Duplicate leads
- Quotation versioning
- WhatsApp sandbox
- n8n retries
- Backup and restore
- Deployment rollback

### P. Final phase plan

Reconcile and freeze the Phase 1–10 roadmap.

For every phase, define:

- Objective
- In scope
- Out of scope
- Inputs
- Deliverables
- Validation
- Exit gate
- Rollback or stop condition

Phase 1B must preserve:

- Phase 1C for documentation and safe Git baseline
- Phase 2 for Next.js and Supabase foundation
- Phase 3 for design system
- Phase 4 for homepage
- Phase 5 for Portfolio
- Phase 6 for remaining public pages
- Phase 7 for CRM foundation
- Phase 8 for commercial workflow
- Phase 9 for WhatsApp and n8n
- Phase 10 for hardening and launch

## 5. Required decision classifications

For each major decision, label it as:

- LOCKED
- RECOMMENDED — OWNER APPROVAL REQUIRED
- DEFERRED
- OPEN RISK
- NOT IN VERSION 1

Avoid vague phrases such as “can be decided later” unless the item is explicitly deferred with a reason and target phase.

## 6. Required report structure

Return one complete report using exactly these primary headings:

# PHASE 1A RECONCILIATION

# LOCKED PRODUCT SCOPE

# FINAL SITEMAP AND ROUTE OWNERSHIP

# HOMEPAGE INFORMATION ARCHITECTURE

# PORTFOLIO ARCHITECTURE

# BRAND AND VISUAL DIRECTION

# REPOSITORY ARCHITECTURE

# SUPABASE DATA DOMAINS

# STORAGE AND MEDIA ARCHITECTURE

# AUTHENTICATION, ROLES AND PERMISSION MATRIX

# CRM PIPELINE AND WORKFLOW

# QUOTATION BOUNDARY

# WHATSAPP AND N8N BOUNDARY

# SECURITY AND PRIVACY BASELINE

# SEO AND CONTENT GOVERNANCE

# TESTING AND QUALITY GATES

# FINAL PHASE 1–10 PLAN

# OWNER APPROVAL ITEMS

# OPEN RISKS

# RECOMMENDED PHASE 1C ACTIONS

# FILES CHANGED: NONE

Do not write implementation code.

Do not create SQL.

Do not create files.

Do not initialize Git.

Do not start Phase 1C.

End with exactly:

PHASE_1B_ARCHITECTURE_FREEZE_COMPLETE

## END PROMPT

---

# 4. PHASE 1B ACCEPTANCE CHECKLIST

Phase 1B passes only when the response contains:

- A reconciled Version 1 scope
- Complete sitemap
- Homepage section contract
- Dedicated Portfolio contract
- Case-study publishing workflow
- Repository architecture
- Supabase domain map
- Public/private storage architecture
- Role-permission matrix
- CRM transition rules
- Quotation boundary
- WhatsApp/n8n responsibility boundary
- Security baseline
- SEO/content governance
- Testing gates
- Reconciled Phase 1–10 plan
- Explicit owner-approval items
- Explicit open risks
- `FILES CHANGED: NONE`
- Final completion marker

Phase 1B fails if Antigravity:

- Creates or modifies files
- Initializes Git
- Scaffolds Next.js
- Installs packages
- Configures Supabase
- Generates UI
- Creates database code
- Starts deployment
- Combines Phase 1C or Phase 2 work

---

# 5. NEXT STEP AFTER PHASE 1B

After Antigravity returns the complete Phase 1B report:

1. Copy the entire report without shortening it.
2. Review all `OWNER APPROVAL REQUIRED` items.
3. Resolve any open risks.
4. Freeze the final decisions.
5. Prepare the Phase 1C prompt.
6. Phase 1C will create approved documentation and establish the safe Git baseline.
7. Next.js and Supabase scaffolding will begin only in Phase 2.

---

**Current status:** Phase 1A passed.  
**Current authorization:** Phase 1B architecture freeze only.  
**Files and implementation:** Not authorized.
