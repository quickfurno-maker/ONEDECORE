-- ONEDECORE — room categories as a many-to-many dimension.
--
-- WHAT THIS SUITE EXISTS TO PREVENT
--
-- `portfolio_projects` is a whole-project record: one row is one delivered
-- home, photographed across its kitchen, its hall and its bedrooms. The old
-- scalar `portfolio_category_code` could file that home under exactly one of
-- those, which left the other categories empty even though the photographs
-- existed — and the only ways around it were to split one home into fake
-- projects or to pretend the other rooms were not delivered.
--
-- So the first thing asserted here is the thing the scalar could not do: ONE
-- project holding all four categories at once, and appearing under each.
--
-- The second is containment. This table is writable by staff and readable by
-- the public, so it gets the same authorization proof its sibling
-- `portfolio_project_services` has: anonymous readers see mappings only for
-- published projects, and only `portfolio.manage` may write.
--
-- The third is the cut itself. Classifications an editor already made under the
-- scalar must survive into the join table, and a null scalar must NOT become a
-- mapping — "not yet classified" is a real answer and inventing one would put a
-- bedroom label on a project nobody looked at.

begin;
select plan(32);

-- ---------------------------------------------------------------------------
-- 1. Structure
-- ---------------------------------------------------------------------------

select has_table(
  'public', 'portfolio_project_categories',
  'the canonical room-category join table exists'
);

select col_is_pk(
  'public', 'portfolio_project_categories',
  array['project_id', 'category_code'],
  'the pair is the primary key, so a duplicate mapping is impossible'
);

select has_index(
  'public', 'portfolio_project_categories',
  'idx_portfolio_project_categories_code',
  'category -> project has its own index: it is what the listing filters on'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'portfolio_project_categories'
      and c.contype = 'f'
      and c.confdeltype = 'c'
  ),
  'the project foreign key cascades on delete'
);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'portfolio_project_categories'),
  'row level security is enabled'
);

-- The service dimension is untouched by this change.
select has_table(
  'public', 'portfolio_project_services',
  'the service dimension still exists and is separate'
);

-- ---------------------------------------------------------------------------
-- 2. Fixtures
-- ---------------------------------------------------------------------------

-- Staff user with portfolio.manage.
insert into auth.users (id, instance_id, email, aud, role)
values (
  'a1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'portfolio-manager@onedecore.in',
  'authenticated',
  'authenticated'
);
update public.profiles set status = 'active'
  where id = 'a1111111-1111-4111-8111-111111111111';
insert into public.user_roles (user_id, role_id)
select 'a1111111-1111-4111-8111-111111111111', id
from public.roles where code = 'super_admin';

-- Staff user WITHOUT any portfolio permission.
insert into auth.users (id, instance_id, email, aud, role)
values (
  'a2222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'sales-only@onedecore.in',
  'authenticated',
  'authenticated'
);
update public.profiles set status = 'active'
  where id = 'a2222222-2222-4222-8222-222222222222';
insert into public.user_roles (user_id, role_id)
select 'a2222222-2222-4222-8222-222222222222', id
from public.roles where code = 'sales';

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

-- A published whole-home project: the case the scalar could not express.
insert into public.portfolio_projects (
  id, slug, title, summary, status, published_at, created_by, updated_by
) values (
  'b1111111-1111-4111-8111-111111111111',
  'whole-home-project-fixture',
  'Whole Home Project Fixture',
  'A synthetic whole-home fixture summary that comfortably exceeds twenty characters.',
  'published',
  now(),
  'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111'
);

-- A second published project, to prove a category is shared rather than owned.
insert into public.portfolio_projects (
  id, slug, title, summary, status, published_at, created_by, updated_by
) values (
  'b2222222-2222-4222-8222-222222222222',
  'kitchen-only-project-fixture',
  'Kitchen Only Project Fixture',
  'A synthetic kitchen-focused fixture summary that also exceeds twenty characters.',
  'published',
  now(),
  'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111'
);

-- A DRAFT project, for the anonymous containment check.
insert into public.portfolio_projects (
  id, slug, title, summary, status, created_by, updated_by
) values (
  'b3333333-3333-4333-8333-333333333333',
  'draft-project-fixture',
  'Draft Project Fixture',
  'A synthetic draft fixture summary that also comfortably exceeds twenty characters.',
  'draft',
  'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111'
);

-- ---------------------------------------------------------------------------
-- 3. The thing the scalar could not do
-- ---------------------------------------------------------------------------

insert into public.portfolio_project_categories (project_id, category_code)
values
  ('b1111111-1111-4111-8111-111111111111', 'complete-interiors'),
  ('b1111111-1111-4111-8111-111111111111', 'kitchen'),
  ('b1111111-1111-4111-8111-111111111111', 'hall'),
  ('b1111111-1111-4111-8111-111111111111', 'bedroom');

select results_eq(
  $$select count(*)::integer from public.portfolio_project_categories
     where project_id = 'b1111111-1111-4111-8111-111111111111'$$,
  array[4],
  'ONE project holds all four room categories at once'
);

insert into public.portfolio_project_categories (project_id, category_code)
values ('b2222222-2222-4222-8222-222222222222', 'kitchen');

select results_eq(
  $$select count(distinct project_id)::integer
      from public.portfolio_project_categories where category_code = 'kitchen'$$,
  array[2],
  'and two different projects share the kitchen category'
);

-- Each of the four filters finds the whole-home project exactly once. This is
-- the listing behaviour: a project mapped to several categories must not appear
-- twice within one of them.
select results_eq(
  $$select count(*)::integer from public.portfolio_project_categories
     where project_id = 'b1111111-1111-4111-8111-111111111111'
       and category_code = 'hall'$$,
  array[1],
  'a multi-category project appears exactly once within a single category'
);

-- ---------------------------------------------------------------------------
-- 4. The allowlist
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('b3333333-3333-4333-8333-333333333333', 'complete-interiors')$$,
  'complete-interiors is accepted'
);
select lives_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('b3333333-3333-4333-8333-333333333333', 'bedroom')$$,
  'bedroom is accepted'
);

select throws_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('b3333333-3333-4333-8333-333333333333', 'balcony')$$,
  '23514',
  null,
  'an unknown category is refused by the check constraint'
);

-- Service codes are NOT category codes. They are different dimensions and the
-- constraint has to say so, or a copy-paste puts a service in the room column.
select throws_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('b3333333-3333-4333-8333-333333333333', 'modular_kitchens')$$,
  '23514',
  null,
  'a SERVICE code is refused in the category column'
);

select throws_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('b1111111-1111-4111-8111-111111111111', 'kitchen')$$,
  '23505',
  null,
  'a duplicate project/category pair is refused'
);

-- ---------------------------------------------------------------------------
-- 5. The atomic replacement RPC
-- ---------------------------------------------------------------------------

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'replace_portfolio_project_categories'),
  false,
  'the replacement RPC is SECURITY INVOKER — RLS stays the authority'
);

select ok(
  (select array_to_string(proconfig, ',') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'replace_portfolio_project_categories')
    like '%search_path=%',
  'and still pins search_path'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

select lives_ok(
  $$select public.replace_portfolio_project_categories(
      'b1111111-1111-4111-8111-111111111111',
      array['kitchen', 'hall']
    )$$,
  'a manager may replace the category set'
);

select results_eq(
  $$select category_code::text from public.portfolio_project_categories
     where project_id = 'b1111111-1111-4111-8111-111111111111'
     order by category_code$$,
  array['hall', 'kitchen'],
  'unchecked categories are removed and checked ones kept — it REPLACES'
);

select lives_ok(
  $$select public.replace_portfolio_project_categories(
      'b1111111-1111-4111-8111-111111111111',
      array[]::text[]
    )$$,
  'an EMPTY set is valid: a project may be unclassified'
);

select results_eq(
  $$select count(*)::integer from public.portfolio_project_categories
     where project_id = 'b1111111-1111-4111-8111-111111111111'$$,
  array[0],
  'and the mappings are gone'
);

select throws_ok(
  $$select public.replace_portfolio_project_categories(
      'b1111111-1111-4111-8111-111111111111',
      array['kitchen', 'balcony']
    )$$,
  '23514',
  null,
  'an unknown code is REFUSED, not silently dropped'
);

-- A repeated code in one request is harmless, not a unique violation.
select lives_ok(
  $$select public.replace_portfolio_project_categories(
      'b1111111-1111-4111-8111-111111111111',
      array['kitchen', 'kitchen']
    )$$,
  'a repeated code in the request is tolerated'
);

-- The service mappings are untouched by any of this.
select results_eq(
  $$select count(*)::integer from public.portfolio_project_services
     where project_id = 'b1111111-1111-4111-8111-111111111111'$$,
  array[0],
  'category mutations never touch the service dimension'
);

-- ---------------------------------------------------------------------------
-- 6. Authorization containment
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);

select throws_ok(
  $$select public.replace_portfolio_project_categories(
      'b1111111-1111-4111-8111-111111111111',
      array['bedroom']
    )$$,
  '42501',
  null,
  'a staff user without portfolio.manage cannot replace categories'
);

select throws_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('b1111111-1111-4111-8111-111111111111', 'bedroom')$$,
  '42501',
  null,
  'nor write the table directly'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('b1111111-1111-4111-8111-111111111111', 'bedroom')$$,
  '42501',
  null,
  'anonymous callers have no write access at all'
);

select results_eq(
  $$select count(*)::integer from public.portfolio_project_categories
     where project_id = 'b3333333-3333-4333-8333-333333333333'$$,
  array[0],
  'and cannot read a DRAFT project''s classification'
);

select results_eq(
  $$select count(*)::integer from public.portfolio_project_categories
     where project_id = 'b2222222-2222-4222-8222-222222222222'$$,
  array[1],
  'but can read a published one'
);

-- ---------------------------------------------------------------------------
-- 7. Cascade
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

delete from public.portfolio_projects
where id = 'b2222222-2222-4222-8222-222222222222';

select results_eq(
  $$select count(*)::integer from public.portfolio_project_categories
     where project_id = 'b2222222-2222-4222-8222-222222222222'$$,
  array[0],
  'deleting a project cascades its category mappings'
);

-- ---------------------------------------------------------------------------
-- 8. The cut from the scalar
-- ---------------------------------------------------------------------------
--
-- The migration's backfill already ran against whatever this database held. Re-
-- running its exact statement here proves the RULE rather than the row count:
-- a non-null scalar produces a mapping, a null one produces nothing.

insert into public.portfolio_projects (
  id, slug, title, summary, status, portfolio_category_code, created_by, updated_by
) values (
  'b4444444-4444-4444-8444-444444444444',
  'legacy-scalar-project-fixture',
  'Legacy Scalar Project Fixture',
  'A synthetic legacy fixture summary that also comfortably exceeds twenty characters.',
  'draft',
  'bedroom',
  'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111'
), (
  'b5555555-5555-4555-8555-555555555555',
  'unclassified-project-fixture',
  'Unclassified Project Fixture',
  'A synthetic unclassified fixture summary that also exceeds twenty characters here.',
  'draft',
  null,
  'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.portfolio_project_categories (project_id, category_code)
select p.id, p.portfolio_category_code
from public.portfolio_projects p
where p.portfolio_category_code is not null
on conflict (project_id, category_code) do nothing;

select results_eq(
  $$select category_code::text from public.portfolio_project_categories
     where project_id = 'b4444444-4444-4444-8444-444444444444'$$,
  array['bedroom'],
  'an existing scalar classification is carried into the join table'
);

select results_eq(
  $$select count(*)::integer from public.portfolio_project_categories
     where project_id = 'b5555555-5555-4555-8555-555555555555'$$,
  array[0],
  'a NULL scalar creates no mapping — unclassified stays unclassified'
);

-- The deprecated column is still there. Dropping it would make historical rows
-- unreadable, which is the one thing the compatibility promise forbids.
select has_column(
  'public', 'portfolio_projects', 'portfolio_category_code',
  'the deprecated scalar column still exists for backward compatibility'
);

select * from finish();
rollback;
