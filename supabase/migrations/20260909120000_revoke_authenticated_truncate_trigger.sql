-- Revoke TRUNCATE / TRIGGER / REFERENCES from `authenticated`.
--
-- WHAT WAS WRONG
--
-- Supabase's base setup grants ALL on tables in `public` to anon, authenticated
-- and service_role by default. Migrations here lock that back down, and for
-- `anon` they do it completely:
--
--   revoke all on table ... from public, anon;
--
-- For `authenticated` they revoke only the three verbs anyone thinks of as
-- writes:
--
--   revoke insert, update, delete on table ... from authenticated;
--
-- TRUNCATE, TRIGGER and REFERENCES therefore survived from the default grant on
-- 18 tables: every attendance table, every salary table, leave requests and
-- types, holidays, the Kriti run/event ledgers, and the staff admin event and
-- employment profile tables.
--
-- WHY IT MATTERS
--
-- TRUNCATE IS NOT SUBJECT TO ROW LEVEL SECURITY. It is a privilege check and
-- nothing more. So the row-level protection on those tables — including the
-- FORCE ROW LEVEL SECURITY deliberately set on every salary and attendance
-- submission table, specifically so that not even the owner bypasses it — did
-- not stand between a logged-in user and an empty payroll ledger. TRIGGER is
-- the same shape of problem one step further out: the right to attach
-- executable code to a table nobody should be able to write to.
--
-- The intent was never in doubt. The migration that created the salary tables
-- says it in a comment two lines above the incomplete revoke:
--
--   "Staff read their own salary; every mutation goes through the RPCs above."
--
-- TRUNCATE is a mutation. This migration finishes the sentence.
--
-- WHAT THIS DOES NOT DO
--
-- It does not touch `service_role`, which holds the same three privileges much
-- more widely. That role is the trusted backend identity, is never issued to a
-- browser, and revoking it needs its own review of the admin and fixture paths
-- rather than a change ridden along with this one.
--
-- It grants nothing. `authenticated` keeps exactly the SELECT it was given, and
-- every mutation continues to run through the SECURITY DEFINER RPCs.
--
-- `pg_catalog` is not consulted for the table list on purpose: naming the
-- tables makes the reviewed set explicit and the migration deterministic.
-- `supabase/tests/database/57_database_security_contracts_test.sql` asserts the
-- invariant dynamically, so a future table that inherits the default grant is
-- caught by the suite rather than silently repeating this.

revoke truncate, trigger, references on table
  public.attendance_corrections,
  public.attendance_days,
  public.attendance_events,
  public.attendance_policies,
  public.attendance_submission_events,
  public.attendance_submissions,
  public.holidays,
  public.kriti_events,
  public.kriti_runs,
  public.leave_requests,
  public.leave_types,
  public.salary_payments,
  public.salary_profiles,
  public.salary_statement_events,
  public.salary_statement_lines,
  public.salary_statements,
  public.staff_admin_events,
  public.staff_employment_profiles
from authenticated;
