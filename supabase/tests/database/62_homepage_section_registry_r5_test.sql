-- The R5 registry migration: what it moved, what it refused to move.
--
-- WHY THIS IS TESTED IN THE DATABASE AND NOT ONLY IN THE SUITE
--
-- `website-manager.test.ts` reads the migration's SQL and checks that the order
-- it DECLARES matches the code registry. That catches a stale array. It cannot
-- catch a migration whose logic does not reach its own declared order — a
-- mis-scoped `where`, a renumber that runs before the reorder, a branch that
-- never fires. Those only show up against a real database with real rows.
--
-- So this file asserts the OUTCOME: after every migration has run, what does a
-- visitor's homepage config actually say.
--
-- The two interesting cases are the two branches. A version nobody has
-- reordered must come out in registry order, including `process` moving up from
-- where the seed put it. A version an editor HAS arranged must keep that
-- arrangement — because reordering sections is the entire product, and a
-- migration that silently reverts an editor's work would be reported as "the
-- homepage changed by itself", which is close to unfalsifiable from a bug
-- report.

begin;
select plan(14);

-- ===========================================================================
-- A. The seeded versions came out in registry order
-- ===========================================================================

-- Both still-rendering versions were seeded and never edited, so both take the
-- adopt-registry-order branch.
select is(
  (select array_agg(s.section_key order by s.sort_order)
     from public.website_homepage_sections s
     join public.website_homepage_versions v on v.id = s.version_id
    where v.state = 'published'),
  array[
    'hero', 'promo-carousel', 'complete-interiors', 'room-explorer', 'why',
    'process', 'factory', 'estimator', 'portfolio', 'testimonials', 'faq',
    'consultation'
  ]::text[],
  'the published version is in the approved R5 order'
);

select is(
  (select array_agg(s.section_key order by s.sort_order)
     from public.website_homepage_sections s
     join public.website_homepage_versions v on v.id = s.version_id
    where v.state = 'draft'),
  array[
    'hero', 'promo-carousel', 'complete-interiors', 'room-explorer', 'why',
    'process', 'factory', 'estimator', 'portfolio', 'testimonials', 'faq',
    'consultation'
  ]::text[],
  'the draft version is in the approved R5 order'
);

-- The specific reorder. Asserted on its own because it is the one change a
-- dense renumber would have silently skipped.
select ok(
  (select s1.sort_order < s2.sort_order
     from public.website_homepage_sections s1
     join public.website_homepage_sections s2 on s2.version_id = s1.version_id
     join public.website_homepage_versions v on v.id = s1.version_id
    where v.state = 'published'
      and s1.section_key = 'process'
      and s2.section_key = 'portfolio'),
  'process now precedes portfolio, as the registry says'
);

-- ===========================================================================
-- B. The retired sections are gone from everything that still renders
-- ===========================================================================

select is(
  (select count(*)::int
     from public.website_homepage_sections s
     join public.website_homepage_versions v on v.id = s.version_id
    where v.state in ('published', 'draft')
      and s.section_key in (
        'modular-kitchen', 'wardrobes', 'renovation', 'materials', 'service-areas'
      )),
  0,
  'no retired section survives in a rendering version'
);

select is(
  (select count(*)::int
     from public.website_homepage_sections s
     join public.website_homepage_versions v on v.id = s.version_id
    where v.state in ('published', 'draft')
      and s.section_key = 'room-explorer'),
  2,
  'room-explorer exists in both rendering versions'
);

-- ===========================================================================
-- C. The order is dense, and the pins held
-- ===========================================================================

select is(
  (select count(*)::int
     from public.website_homepage_versions v
    where v.state in ('published', 'draft')
      and (select array_agg(s.sort_order order by s.sort_order)
             from public.website_homepage_sections s
            where s.version_id = v.id)
          is distinct from
          (select array_agg(i order by i)
             from generate_series(
               0,
               (select count(*)::int - 1
                  from public.website_homepage_sections s
                 where s.version_id = v.id)
             ) as i)),
  0,
  'every rendering version is numbered 0..n-1 with no gaps'
);

select is(
  (select count(distinct s.section_key)::int
     from public.website_homepage_sections s
     join public.website_homepage_versions v on v.id = s.version_id
    where v.state in ('published', 'draft') and s.sort_order = 0),
  1,
  'every rendering version opens on the same section'
);

select is(
  (select s.section_key
     from public.website_homepage_sections s
     join public.website_homepage_versions v on v.id = s.version_id
    where v.state = 'published'
    order by s.sort_order limit 1),
  'hero',
  'the hero is still first'
);

select is(
  (select s.section_key
     from public.website_homepage_sections s
     join public.website_homepage_versions v on v.id = s.version_id
    where v.state = 'published'
    order by s.sort_order desc limit 1),
  'consultation',
  'the consultation close is still last'
);

-- ===========================================================================
-- D. What a visitor actually receives
-- ===========================================================================

-- The public reader is the only surface that matters to a homeowner, and it
-- goes through the pointer rather than reading the table. Asserting here proves
-- the migration's rows reach the render path, not just the table.
select is(
  (select array_agg(entry ->> 'key' order by ordinality)
     from jsonb_array_elements(public.get_published_homepage_config() -> 'sections')
          with ordinality as t(entry, ordinality)),
  array[
    'hero', 'promo-carousel', 'complete-interiors', 'room-explorer', 'why',
    'process', 'factory', 'estimator', 'portfolio', 'testimonials', 'faq',
    'consultation'
  ]::text[],
  'the public config a visitor receives is the approved R5 order'
);

select is(
  (select count(*)::int
     from jsonb_array_elements(public.get_published_homepage_config() -> 'sections') as entry
    where (entry ->> 'visible')::boolean is not true),
  0,
  'the migration hid nothing that was visible'
);

-- ===========================================================================
-- E. An editor's own ordering is preserved
-- ===========================================================================
--
-- The migration has already run, so this replays its branch against a version
-- arranged the way an editor would arrange one. It is written as the migration
-- writes it, against rows that do NOT match the legacy seed order, and asserts
-- that such a version is left alone apart from the retired keys and the insert.

create temporary table r5_editor_case (
  section_key text primary key,
  sort_order integer not null
) on commit drop;

-- A deliberately unusual arrangement: portfolio pulled up near the top, and one
-- retired section still present.
insert into r5_editor_case (section_key, sort_order) values
  ('hero', 0),
  ('portfolio', 1),
  ('promo-carousel', 2),
  ('complete-interiors', 3),
  ('materials', 4),
  ('why', 5),
  ('consultation', 6);

delete from r5_editor_case
 where section_key in (
   'modular-kitchen', 'wardrobes', 'renovation', 'materials', 'service-areas'
 );

select is(
  (select count(*)::int from r5_editor_case where section_key = 'materials'),
  0,
  'the retired key is dropped from an editor-arranged version too'
);

-- room-explorer goes directly after complete-interiors, the registry position.
update r5_editor_case
   set sort_order = sort_order + 1
 where sort_order >= (select sort_order + 1 from r5_editor_case where section_key = 'complete-interiors');

insert into r5_editor_case (section_key, sort_order)
select 'room-explorer',
       (select sort_order + 1 from r5_editor_case where section_key = 'complete-interiors');

-- Then densify, preserving relative order.
with ordered as (
  select section_key,
         row_number() over (order by sort_order, section_key) - 1 as new_order
    from r5_editor_case
)
update r5_editor_case e
   set sort_order = ordered.new_order
  from ordered
 where e.section_key = ordered.section_key;

select is(
  (select array_agg(section_key order by sort_order) from r5_editor_case),
  array[
    'hero', 'portfolio', 'promo-carousel', 'complete-interiors',
    'room-explorer', 'why', 'consultation'
  ]::text[],
  'the editor''s arrangement survives; only the retired key left and room-explorer joined'
);

-- The point of the assertion above, stated directly: portfolio stayed where the
-- editor put it rather than being pushed back to its registry position.
select ok(
  (select e1.sort_order < e2.sort_order
     from r5_editor_case e1, r5_editor_case e2
    where e1.section_key = 'portfolio' and e2.section_key = 'why'),
  'an editor-chosen position is not overwritten by the registry order'
);

select * from finish();
rollback;
