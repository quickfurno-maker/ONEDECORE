# 05 — SUPABASE DATA DOMAINS AND SCHEMA SPECIFICATION

**Document Status:** Locked Data Domain Baseline  
**Source of Truth:** Supabase PostgreSQL  
**Enforcement:** 100% RLS Coverage on Exposed API Schemas  

---

## 1. Domain Architecture Overview

Supabase PostgreSQL serves as the sole authoritative database for all structured application state. Data is divided into six logical domains:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Identity & Permissions (profiles, roles, permissions)│
├─────────────────────────────────────────────────────────┤
│ 2. Portfolio Domain (projects, media, tags, ownership) │
├─────────────────────────────────────────────────────────┤
│ 3. CRM & Lead Domain (leads, activities, consultations) │
├─────────────────────────────────────────────────────────┤
│ 4. Commercial Domain (quotations, items, clients)       │
├─────────────────────────────────────────────────────────┤
│ 5. Communication Domain (whatsapp logs, templates)      │
├─────────────────────────────────────────────────────────┤
│ 6. Operations Domain (n8n logs, audit trail, settings)  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Conceptual Schema Models

### 2.1 Identity Domain
- **`profiles`:** Staff user profiles linked to `auth.users`.
- **`user_roles`:** Role assignments (`super_admin`, `management`, `sales`, `designer`, `operations`, `content_manager`).
- **`role_permissions`:** Granular feature permissions per role.

### 2.2 Portfolio Domain (Implemented in Phase 2E1)
- **`portfolio_projects`:** Catalog of luxury projects (`id`, `slug`, `title`, `summary`, `description`, `location_label`, `property_type`, `completion_year`, `status`, `is_featured`, `sort_order`, `seo_title`, `seo_description`, `published_at`, `created_by`, `updated_by`).
- **`portfolio_project_services`:** Service junction (`project_id`, `service_code`, `created_at`).
- **`portfolio_media`:** Public web derivative media (`id`, `project_id`, `public_bucket`, `public_object_path`, `media_role`, `status`, `alt_text`, `caption`, `width_px`, `height_px`, `file_size_bytes`, `mime_type`, `sort_order`, `created_by`, `updated_by`).
- **`portfolio_media_sources`:** Private master original photographs (`media_id`, `original_bucket`, `original_object_path`, `original_file_name`, `original_mime_type`, `original_file_size_bytes`, `checksum_sha256`, `uploaded_by`).

### 2.3 CRM & Lead Domain
- **`leads`:** Lead entries (`id`, `full_name`, `phone`, `email`, `locality`, `property_type`, `budget_range`, `status`, `assigned_to`).
- **`activities`:** Audit activity log (`id`, `lead_id`, `activity_type`, `notes`, `performed_by`, `created_at`).
- **`site_visits`:** Scheduled measurement & site evaluation visits.

### 2.4 Commercial Domain
- **`quotations`:** Quotation records (`id`, `lead_id`, `version_number`, `subtotal`, `discount_amount`, `total_amount`, `status`).
- **`quotation_items`:** Line items (`id`, `quotation_id`, `room_type`, `item_description`, `quantity`, `unit_price`).
- **`quote_acceptances`:** Auditable client acceptance logs (`quotation_id`, `doc_hash`, `accepted_at`, `client_id`, `ip_address`).

### 2.5 Communication Domain
- **`whatsapp_contacts`:** Contact records with explicit opt-in status (`phone`, `consent_given`, `consent_timestamp`).
- **`whatsapp_messages`:** Inbound/outbound message history (`id`, `contact_id`, `direction`, `message_text`, `status`).

### 2.6 Operations & Audit Domain
- **`system_audit_logs`:** Auditable system mutation events.
- **`automation_events`:** Outbox event records dispatched to n8n.

---

## 3. Related Governance Documents

- [Architecture & Repository Structure](02-architecture.md)
- [Security, Privacy & RLS](06-security-privacy-and-rls.md)
- [ADR-0002: Supabase Source of Truth](ADR/ADR-0002-supabase-source-of-truth.md)
