-- Website Manager: bring stored homepage configurations onto the R5 registry.
--
-- WHY THIS MIGRATION EXISTS AT ALL
--
-- Strictly speaking the application does not need it. `resolveHomepageSections`
-- already drops keys it does not recognise and appends registry entries a
-- stored config never mentioned, so a pre-redesign configuration renders the
-- new homepage correctly without any database change. The same is true of the
-- admin: `toSections` filters and backfills identically.
--
-- What that self-healing does NOT do is fix the DATA. Left alone, every stored
-- version keeps rows for five sections that no longer exist, and the next save
-- silently rewrites them away. Until that save, the admin and the database
-- disagree about what the homepage is — which is exactly the kind of quiet
-- drift that makes a later bug impossible to reason about.
--
-- So this aligns the rows with the registry, deliberately and visibly.
--
-- WHAT CHANGES
--
--   removed   modular-kitchen, wardrobes, renovation
--             Three long single-service sections. What they said is now four
--             Interactive Services cards, a sentence each.
--
--   removed   materials
--             Out of the public flow by owner decision. The materials data and
--             imagery are untouched and still used elsewhere.
--
--   removed   service-areas
--             The 26-locality list. Its answer survives as the `areas` FAQ
--             entry, which is one of the five the new FAQ renders.
--
--   added     room-explorer
--             New interactive section, inserted at its registry position.
--
--   moved     process
--             The seed put it after `portfolio`. The registry puts it between
--             `why` and `factory`, which is the approved flow: how the job runs
--             belongs with the reasons to trust it, not after the proof. Only a
--             version nobody has reordered is moved -- see the branch below.
--
-- WHAT IS PRESERVED
--
-- Version history stays valid. Archived versions are deliberately NOT touched:
-- they are immutable snapshots of what the homepage was on the day they were
-- published, and rewriting them would turn the audit trail into fiction. Only
-- the live `published` version and the working `draft` are brought forward,
-- because those are the two that still have to render.
--
-- Visibility choices survive. If an editor had hidden a section that still
-- exists, it stays hidden.

do $$
declare
  v_version record;
  v_current text[];
  v_next_order integer;

  /*
   * The order the CMS seeded on 2026-09-11, taken verbatim from
   * `20260911120000_website_manager_cms.sql`. A version that still matches this
   * exactly has never been reordered by an editor.
   */
  v_legacy constant text[] := array[
    'hero', 'promo-carousel', 'complete-interiors', 'modular-kitchen',
    'wardrobes', 'renovation', 'why', 'factory', 'estimator', 'portfolio',
    'materials', 'process', 'service-areas', 'testimonials', 'faq',
    'consultation'
  ];

  /*
   * The approved R5 order, which must stay identical to
   * `HOMEPAGE_SECTION_REGISTRY` in `src/features/website-manager/homepage-registry.ts`.
   * `website-manager.test.ts` asserts the two agree, so a registry change that
   * forgets this array fails the suite rather than the homepage.
   */
  v_r5 constant text[] := array[
    'hero', 'promo-carousel', 'complete-interiors', 'room-explorer', 'why',
    'process', 'factory', 'estimator', 'portfolio', 'testimonials', 'faq',
    'consultation'
  ];
begin
  /*
   * Only the versions that still render. `archived` is left exactly as it was.
   */
  for v_version in
    select id from public.website_homepage_versions where state in ('published', 'draft')
  loop
    select array_agg(section_key order by sort_order)
      into v_current
      from public.website_homepage_sections
     where version_id = v_version.id;

    -- 1. Drop the retired keys.
    delete from public.website_homepage_sections
     where version_id = v_version.id
       and section_key in (
         'modular-kitchen', 'wardrobes', 'renovation', 'materials', 'service-areas'
       );

    if v_current = v_legacy then
      /*
       * 2a. NEVER EDITED — adopt the approved order wholesale.
       *
       * This branch is the one that matters, and it exists because deleting the
       * retired keys is not enough. The seeded order put `process` after
       * `portfolio`; the registry puts it between `why` and `factory`. A dense
       * renumber preserves the relative order, so it would have preserved that
       * disagreement — leaving a stored configuration that renders the sections
       * in an order the code says is wrong, and no way to notice short of
       * reading both lists side by side.
       *
       * Positions come from `array_position`, so this is the registry order by
       * construction rather than a hand-numbered copy of it.
       */
      if not exists (
        select 1 from public.website_homepage_sections
         where version_id = v_version.id and section_key = 'room-explorer'
      ) then
        insert into public.website_homepage_sections
          (version_id, section_key, sort_order, is_visible)
        values (
          v_version.id,
          'room-explorer',
          (select coalesce(max(sort_order), -1) + 1
             from public.website_homepage_sections
            where version_id = v_version.id),
          true
        );
      end if;

      update public.website_homepage_sections
         set sort_order = array_position(v_r5, section_key) - 1
       where version_id = v_version.id
         and array_position(v_r5, section_key) is not null
         and sort_order is distinct from array_position(v_r5, section_key) - 1;
    else
      /*
       * 2b. AN EDITOR HAS REORDERED THIS VERSION — their order is preserved.
       *
       * Reordering sections is the whole point of the Website Manager. Rewriting
       * a version someone deliberately arranged would silently undo their work
       * and, worse, make the admin show an order nobody chose. So this branch
       * changes as little as it can: the retired rows are gone, room-explorer is
       * inserted where the registry puts it, and the gaps are closed.
       */
      if not exists (
        select 1 from public.website_homepage_sections
         where version_id = v_version.id and section_key = 'room-explorer'
      ) then
        select coalesce(
                 (select sort_order + 1
                    from public.website_homepage_sections
                   where version_id = v_version.id and section_key = 'complete-interiors'),
                 (select coalesce(max(sort_order), -1) + 1
                    from public.website_homepage_sections
                   where version_id = v_version.id)
               )
          into v_next_order;

        /*
         * Make room. `sort_order` carries no unique constraint — the primary key
         * is (version_id, section_key) — so this is about keeping the ORDER
         * unambiguous, not about avoiding a collision: two rows sharing a
         * sort_order would be sequenced by whatever the tiebreak happened to be.
         */
        update public.website_homepage_sections
           set sort_order = sort_order + 1
         where version_id = v_version.id
           and sort_order >= v_next_order;

        insert into public.website_homepage_sections
          (version_id, section_key, sort_order, is_visible)
        values (v_version.id, 'room-explorer', v_next_order, true);
      end if;

      /*
       * 3. Renumber to a dense 0..n-1 sequence.
       *
       * The deletes above leave gaps. Nothing breaks with gaps — the resolver
       * sorts rather than indexes — but a contiguous order is what an editor sees
       * in the admin, and "3, 4, 7, 8" invites someone to conclude rows are
       * missing.
       */
      with ordered as (
        select section_key,
               row_number() over (order by sort_order, section_key) - 1 as new_order
          from public.website_homepage_sections
         where version_id = v_version.id
      )
      update public.website_homepage_sections s
         set sort_order = ordered.new_order
        from ordered
       where s.version_id = v_version.id
         and s.section_key = ordered.section_key
         and s.sort_order is distinct from ordered.new_order;
    end if;
  end loop;
end;
$$;

/*
 * The hero must still be first and the consultation close still last.
 *
 * Both were already true and neither key was touched, so this is an assertion
 * rather than a repair: if the reordering above ever moves them, the migration
 * fails here instead of publishing a homepage that opens on a FAQ.
 */
do $$
declare
  v_version record;
  v_first text;
  v_last text;
begin
  for v_version in
    select id from public.website_homepage_versions where state in ('published', 'draft')
  loop
    select section_key into v_first
      from public.website_homepage_sections
     where version_id = v_version.id
     order by sort_order limit 1;

    select section_key into v_last
      from public.website_homepage_sections
     where version_id = v_version.id
     order by sort_order desc limit 1;

    if v_first is distinct from 'hero' then
      raise exception 'R5_REGISTRY_HERO_NOT_FIRST: version % starts with %', v_version.id, v_first;
    end if;
    if v_last is distinct from 'consultation' then
      raise exception 'R5_REGISTRY_CLOSE_NOT_LAST: version % ends with %', v_version.id, v_last;
    end if;
  end loop;
end;
$$;
