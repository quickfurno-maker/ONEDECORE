-- Consent visibility, proved by ROLE BEHAVIOUR rather than policy text.
--
-- `57_database_security_contracts_test.sql` asserts that both `consent_events`
-- policies mention the right permissions and helpers. That is worth having and
-- it is not proof: `pg_get_expr` matching cannot tell you what a given person
-- actually sees. Two policies that each read correctly can still combine into a
-- leak, because PERMISSIVE policies are OR-ed and the union is what the user
-- gets.
--
-- So this file signs in as real roles, with real permissions, through real RLS,
-- and looks.
--
-- WHAT THE RBAC ACTUALLY SAYS (queried, not assumed)
--
--   sales_executive  consents.read, leads.read_assigned
--   sales_manager    consents.read, leads.read_all
--   management       consents.read, leads.read_all
--   super_admin      consents.read, leads.read_all, leads.read_assigned,
--                    marketing_consents.manage
--
-- `marketing_consents.manage` is held by super_admin ALONE, and super_admin
-- also holds `consents.read` and `leads.read_all`. Policy 1 therefore already
-- shows them every row, which means the marketing policy grants nothing extra
-- to anybody in the shipped role set — it is latent, and would only start
-- mattering the day a role receives `marketing_consents.manage` WITHOUT
-- `consents.read`.
--
-- That day is exactly what needs a test, so the marketing persona below is a
-- fixture role holding that one permission and nothing else. It is not a claim
-- that such a role exists in production; it is the isolation that makes the
-- second policy observable at all.

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- Fixture. Built as the superuser, because consent_events grants INSERT to no
-- role at all — which is itself asserted in suite 57.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name, status) values
  ('c0000000-0000-4000-8000-00000000000a', 'Exec A', 'active'),
  ('c0000000-0000-4000-8000-00000000000b', 'Exec B', 'active'),
  ('c0000000-0000-4000-8000-00000000000c', 'Marketing Only', 'active');

insert into public.user_roles (user_id, role_id)
select 'c0000000-0000-4000-8000-00000000000a', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'c0000000-0000-4000-8000-00000000000b', id from public.roles where code = 'sales_executive';

-- A role carrying ONLY marketing_consents.manage, so the marketing policy can
-- be observed in isolation from `consents.read`.
insert into public.roles (id, code, name, description, is_system, is_active)
values ('c0000000-0000-4000-8000-00000000000d', 'test_marketing_only',
        'Test Marketing Only', 'fixture: isolates the marketing consent policy', false, true);
insert into public.role_permissions (role_id, permission_id)
select 'c0000000-0000-4000-8000-00000000000d', id
  from public.permissions where code in ('marketing_consents.manage', 'leads.read_assigned');
insert into public.user_roles (user_id, role_id)
values ('c0000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000d');

-- Two separate customers, one lead each, assigned to different executives.
insert into public.contacts (id, display_name) values
  ('c0000000-0000-4000-8000-0000000000c1', 'Customer One'),
  ('c0000000-0000-4000-8000-0000000000c2', 'Customer Two');

insert into public.leads (id, contact_id, submitted_name, service_code,
                          primary_source_id, entry_method, planner_version,
                          landing_path, status, assigned_to)
select 'c0000000-0000-4000-8000-0000000000d1',
       'c0000000-0000-4000-8000-0000000000c1',
       'Customer One', 'complete-home-interiors',
       (select id from public.lead_sources order by created_at limit 1),
       'public_intake', 'public-consult-v4', '/',
       -- an assigned lead is 'assigned'; the schema refuses 'new' with an owner.
       'assigned', 'c0000000-0000-4000-8000-00000000000a';

insert into public.leads (id, contact_id, submitted_name, service_code,
                          primary_source_id, entry_method, planner_version,
                          landing_path, status, assigned_to)
select 'c0000000-0000-4000-8000-0000000000d2',
       'c0000000-0000-4000-8000-0000000000c2',
       'Customer Two', 'complete-home-interiors',
       (select id from public.lead_sources order by created_at limit 1),
       'public_intake', 'public-consult-v4', '/',
       -- an assigned lead is 'assigned'; the schema refuses 'new' with an owner.
       'assigned', 'c0000000-0000-4000-8000-00000000000b';

-- Customer One has a SECOND lead, owned by the marketing persona. This is the
-- shape the contact-scoped policy exists for: the actor can see one of the
-- contact's leads, and the MARKETING consent hangs off the other one.
insert into public.leads (id, contact_id, submitted_name, service_code,
                          primary_source_id, entry_method, planner_version,
                          landing_path, status, assigned_to)
select 'c0000000-0000-4000-8000-0000000000d3',
       'c0000000-0000-4000-8000-0000000000c1',
       'Customer One', 'modular-kitchens',
       (select id from public.lead_sources order by created_at limit 1),
       'public_intake', 'public-consult-v4', '/',
       'assigned', 'c0000000-0000-4000-8000-00000000000c';

-- A service consent on each lead, and a MARKETING consent on customer one.
insert into public.consent_events
  (id, contact_id, lead_id, purpose_code, channel, event_type, copy_version,
   notice_version, source, actor_type)
values
  ('c0000000-0000-4000-8000-0000000000e1', 'c0000000-0000-4000-8000-0000000000c1',
   'c0000000-0000-4000-8000-0000000000d1', 'SERVICE_ENQUIRY', 'website-form',
   'granted', 'service-enquiry-v1.1-single-consent', 'privacy-notice-v1.0',
   'website-planner', 'data-principal'),
  ('c0000000-0000-4000-8000-0000000000e2', 'c0000000-0000-4000-8000-0000000000c2',
   'c0000000-0000-4000-8000-0000000000d2', 'SERVICE_ENQUIRY', 'website-form',
   'granted', 'service-enquiry-v1.1-single-consent', 'privacy-notice-v1.0',
   'website-planner', 'data-principal'),
  ('c0000000-0000-4000-8000-0000000000e3', 'c0000000-0000-4000-8000-0000000000c1',
   'c0000000-0000-4000-8000-0000000000d1', 'MARKETING', 'email',
   'granted', 'marketing-v1.0', 'privacy-notice-v1.0',
   'staff-console', 'data-principal');

-- ---------------------------------------------------------------------------
-- A. Sales executives are isolated from each other's leads
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.consent_events
    where id = 'c0000000-0000-4000-8000-0000000000e1'),
  1,
  'Executive A sees the consent on their OWN lead'
);

select is(
  (select count(*)::int from public.consent_events
    where id = 'c0000000-0000-4000-8000-0000000000e2'),
  0,
  'Executive A cannot see the consent on another executive''s lead'
);

-- Whole-table view, not just the row they were asked about: the union of both
-- policies must still be one lead's worth of consent.
select is(
  (select count(*)::int from public.consent_events),
  2,
  'Executive A sees only their own lead''s consents in total'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.consent_events
    where id = 'c0000000-0000-4000-8000-0000000000e2'),
  1,
  'Executive B sees the consent on their OWN lead'
);

select is(
  (select count(*)::int from public.consent_events
    where id = 'c0000000-0000-4000-8000-0000000000e1'),
  0,
  'Executive B cannot see the consent on another executive''s lead'
);

select is(
  (select count(*)::int from public.consent_events
    where contact_id = 'c0000000-0000-4000-8000-0000000000c1'),
  0,
  'the MARKETING row does not leak to an executive without the permission'
);

-- ---------------------------------------------------------------------------
-- B/C. The marketing policy: MARKETING only, and only for a visible contact
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

-- This persona holds marketing_consents.manage and nothing else, so every row
-- it can see arrives through the second policy alone.
select is(
  (select count(*)::int from public.consent_events
    where id = 'c0000000-0000-4000-8000-0000000000e2'),
  0,
  'the marketing persona sees nothing for a contact they have no lead on'
);

select is(
  (select count(*)::int from public.consent_events
    where id = 'c0000000-0000-4000-8000-0000000000e3'),
  1,
  'the marketing policy shows the MARKETING consent for a visible contact'
);

-- THE ONE THAT MATTERS. The same contact, the same visible lead, a consent row
-- this persona is NOT entitled to: it lacks `consents.read`, so the service
-- purposes must stay invisible even though the contact is in scope.
select is(
  (select count(*)::int from public.consent_events
    where id = 'c0000000-0000-4000-8000-0000000000e1'),
  0,
  'the marketing policy does NOT expose SERVICE_ENQUIRY on the same contact'
);

select is(
  (select count(*)::int from public.consent_events),
  1,
  'the marketing persona sees exactly the one MARKETING row and nothing else'
);

select is(
  (select count(*)::int from public.consent_events
    where purpose_code <> 'MARKETING'),
  0,
  'no non-MARKETING purpose is reachable through the marketing policy'
);

-- ---------------------------------------------------------------------------
-- D. Anonymous callers
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

select throws_ok(
  $$select 1 from public.consent_events limit 1$$,
  '42501',
  NULL,
  'anon is refused consent_events outright, before RLS is even consulted'
);

reset role;
select * from finish();
rollback;
