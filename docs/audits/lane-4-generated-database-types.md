# Lane 4 — generated database type reconciliation

**Date:** 2026-09-09
**Branch:** `chore/database-generated-types-reconciliation`
**Starting main:** `0d8ebf588d590939d9e7ee0cc6158e539a52843e`
**Migrations:** 67, unchanged. No migration was added, edited, or applied anywhere.

---

## Why this lane existed

`src/types/database.generated.ts` was doing two incompatible jobs.

It was nominally machine output, and it was also where a generator limitation
got repaired by hand. Commit `632bb36` recorded the consequences honestly: the
checked-in types were stale, two `leads` columns were added manually because a
full regeneration produced a large unrelated diff, and raw generation dropped
nullable RPC arguments the repository had restored by hand.

That was a contained repair and the right call at the time. Its cost was
structural: once regeneration means "lose the hand corrections", regeneration
stops happening. By the time this lane measured it the file was missing **7
tables** and **25 functions** that existed in the database, and nothing in CI
could tell.

The fix is not a better regeneration. It is separating the two jobs so
regeneration is free.

---

## The boundary

| File | Role | Edited by |
| :--- | :--- | :--- |
| `src/types/database.generated.ts` | Raw generator output | `npm run db:types:generate` only |
| `src/types/database.ts` | Application `Database` type: reviewed corrections | People, with evidence |

Every Supabase client factory and every runtime module imports the overlay.
Only the typegen tooling and the tests that police it read the generated file.

**Canonical source:** repository migrations applied to a clean local stack.
Never production, never a dashboard state, never a hand edit.

**Canonical schema:** `public` only.

---

## What the regeneration changed

Compared structurally (AST, not text), old checked-in file vs fresh local
generation:

| | Removed | Added | Changed |
| :--- | ---: | ---: | ---: |
| Tables | 0 | 7 | 5 |
| Views | 0 | 0 | 0 |
| Functions | 0 | 25 | 16 |
| Enums | 0 | 0 | 0 |
| Composite types | 0 | 0 | 0 |

**Nothing was lost.** Every difference is the stale file catching up, with two
exceptions classified below.

### Tables restored (7)

`attendance_submission_events`, `attendance_submissions`, `salary_payments`,
`salary_profiles`, `salary_statement_events`, `salary_statement_lines`,
`salary_statements`

### Functions restored (25)

`add_salary_statement_line`, `approve_attendance_day`, `attach_staff_app_access`,
`begin_staff_credential_operation`, `complete_staff_credential_operation`,
`confirm_staff_app_access`, `create_salary_statement`,
`create_staff_member_without_invite`, `fail_staff_credential_operation`,
`finalize_salary_statement`, `get_attendance_approval_inbox`,
`get_attendance_monthly_summary`, `get_salary_statement`,
`get_staff_credential_operation`, `list_salary_statements`,
`record_salary_payment`, `record_staff_first_login`, `reject_attendance_day`,
`remove_salary_statement_line`, `reopen_salary_statement`,
`request_attendance_correction`, `return_attendance_for_correction`,
`set_salary_profile`, `submit_attendance_day`, `sync_staff_access_states`

### Classification of every semantic difference

| Class | Meaning | Instances |
| :--- | :--- | :--- |
| A | Genuine stale schema | 7 tables, 25 functions, columns on `quotation_items` (3) and `staff_employment_profiles` (5), foreign keys on `leads` and `user_roles`, v4 fields in 5 function return types, 2 new `submit_lead_intake` arguments |
| B | Generator formatting only | `portfolio_projects` column ordering — identical column set, different emission order |
| C | Historical manual edit no longer needed | `graphql_public` schema block; 2 nullable arguments no call site uses |
| D | Real generator limitation | 15 nullable RPC arguments — the overlay, below |
| E | Unexplained | **none** |

### `graphql_public`

Removed. The historical file carried the schema; no tracked file in the
repository references `graphql_public`, `Database["graphql_public"]`, or the
GraphQL endpoint. The only matches were inside `supabase/.temp/`, which is
generated CLI state and gitignored. It was stale output kept alive by inertia,
not a contract.

---

## The overlay: 15 nullable RPC arguments

PostgREST's schema description cannot distinguish *"this argument may be
omitted"* from *"this argument may be NULL"*, so the generator emits
`p?: string` for an argument declared `DEFAULT NULL` and `p: string` for a
required argument whose routine handles NULL deliberately. Both are narrower
than the database.

**How the list was derived — not from the previous file.** The overlay was
removed, the clients were pointed at raw generated types, and `tsc` was run.
The compiler named exactly 15 call sites. Each was then checked against the
routine's SQL definition. Nothing was carried over on the strength of having
been there before.

| Function | Argument | Database evidence |
| :--- | :--- | :--- |
| `authorize_commerce_product_media_upload` | `p_variant_id` | body: `p_variant_id is not null and not exists (...)` |
| `bind_campaign_run_operation` | `p_provider_ad_set_id` | `text DEFAULT NULL` |
| `bind_campaign_run_operation` | `p_provider_ad_group_id` | `text DEFAULT NULL` |
| `create_landing_publication` | `p_campaign_reference` | body: `coalesce(p_campaign_reference, '')` |
| `create_landing_publication` | `p_campaign_version_number` | body: `coalesce(p_campaign_version_number, 0)` |
| `get_crm_management_analytics` | `p_owner_id` | `uuid DEFAULT NULL` |
| `get_crm_management_analytics` | `p_source_id` | `uuid DEFAULT NULL` |
| `get_crm_my_day` | `p_owner_id` | `uuid DEFAULT NULL` |
| `get_crm_pipeline_value_summary` | `p_owner_id` | `uuid DEFAULT NULL` |
| `record_landing_exposure` | `p_experiment_id` | written to a nullable column; the routine raises `LANDING_EXPOSURE_INVALID` for its three required arguments and pointedly not this one |
| `record_landing_exposure` | `p_variant_key` | same, plus `nullif(p_variant_key, '')`, which *produces* NULL |
| `save_landing_experiment_draft` | `p_experiment_id` | body: `if p_experiment_id is null then insert ...` |
| `set_portfolio_media_room_category` | `requested_room_code` | body: `if requested_room_code is not null and ...` |
| `verify_live_landing_publication_context` | `p_experiment_reference` | body: `if p_experiment_reference is not null then ...` |
| `verify_live_landing_publication_context` | `p_variant_key` | body: `if p_variant_key is null or not exists (...)` |

No routine among these is `STRICT`, so NULL reaches the body rather than
short-circuiting the call. The pgTAP suites already invoke several of them with
explicit SQL `NULL`, so the contract is executable, not merely asserted.

### Two historical overrides deliberately dropped

`bind_campaign_run_operation.p_provider_status` and
`get_crm_management_analytics.p_target_month` were nullable in the old
hand-maintained file. Both are `DEFAULT NULL` in SQL, so the *database* would
accept NULL — but every call site passes a non-null value, so the override was
carrying no weight. They are left as generated. If a caller ever needs to pass
NULL, the argument goes on the allowlist with its evidence rather than a cast at
the call site.

The handoff also named `quote_public_commerce_cart.p_experiment_id` and
`.p_variant_key` as candidates. That function has no such arguments in either
the old or the new types; the hint did not survive contact with the schema.

### What the overlay does not do

No `any`. No `unknown as`. No `@ts-ignore`. No blanket client cast. No call site
was changed to make types fit. Tables, views, enums and composite types pass
through byte-identical, and the function *names* are unchanged — only the
argument types of the 10 listed functions differ. `npm run typecheck` passes
with zero suppressions.

---

## Local versus managed

Read-only type generation against managed project `lpurlfmpvriyvpkujvyl`,
compared structurally against the local generation:

**Zero business-schema difference.** Identical tables, views, functions, enums
and composite types.

The only delta is environment metadata, exactly as expected at 67/67 migration
alignment:

- managed output carries `__InternalSupabase: { PostgrestVersion: "14.5" }`;
  the local stack's CLI does not emit the block
- the same version detection changes parenthesisation in the generic helper
  boilerplate at the end of the file

Neither is schema drift. Local generation owns the checked-in shape; CI never
needs a production credential.

---

## Guard

- `npm run db:types:generate` — writes the file. The only supported way to
  change it.
- `npm run verify:db-types` — regenerates and compares; never writes.
- Wired into `check:db`, so it runs in **Database Quality**, the only job with a
  database. Application Quality starts no stack and is left alone.

Both invoke the repo-pinned CLI as a plain Node script from `node_modules`, not
through a shell or a globally installed binary, so Windows and Linux run the
same code path. The single normalisation is line endings — Git checks the file
out as CRLF on Windows while the generator always emits LF, and without
normalising the guard would fail on every Windows machine and pass in CI.

**Proven:** a `db reset` followed by regeneration reproduces the committed file
with an identical hash; a local-only table created outside the migrations makes
`verify:db-types` fail with the table named, and dropping it makes it pass.
