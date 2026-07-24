# ADR-0002: SUPABASE POSTGRESQL AS SOLE STRUCTURED DATA SOURCE OF TRUTH

**Status:** Accepted  
**Date:** July 24, 2026  
**Deciders:** Senior Software Architect, Security Architect  
**Technical Scope:** Database Architecture & Data Persistence  

---

## Context and Problem Statement

ONEDECORE handles public portfolio metadata, customer lead submissions, activity audit trails, commercial quotations, WhatsApp message logs, and staff permissions. We must establish the single source of truth for persistent structured data.

---

## Decision Drivers

- Need for robust relational integrity, transactions, and row-level security (RLS).
- Prevention of state fragmentation across third-party automation tools (e.g., n8n, Google Sheets).
- Compliance with security and data access auditing standards.

---

## Decision Outcome

**Chosen Option:** **Supabase PostgreSQL is the sole authoritative source of truth for all structured application data.**

### Key Rules

1. **No External Primary Stores:** n8n, Webhook relays, and third-party tools are stateless dispatchers. They must never serve as permanent customer or portfolio databases.
2. **Database-First Persistence:** All incoming web form submissions and WhatsApp messages are validated and committed to Supabase before triggering external automation or notifications.
3. **100% RLS Coverage:** Row Level Security (RLS) policies are enforced on 100% of API-exposed application tables. Anonymous access is denied by default for private schemas.
