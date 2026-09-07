-- ONEDECORE -- a real room/category taxonomy for the public portfolio.
--
-- THE PROBLEM THIS FIXES
--
-- The homepage offers four portfolio categories: Complete Interiors, Kitchen,
-- Hall / Living Room and Bedroom. Only the first two exist in the data.
-- `portfolio_projects.service_code` records the SERVICE a project was sold as
-- -- complete_home_interiors, modular_kitchens, custom_wardrobes -- and a hall
-- is not a service. Hall and Bedroom were therefore aliased onto the
-- complete-home listing, so two chips returned a third chip's results.
--
-- Overloading `service_code` with room values was the other option and is
-- worse: it would corrupt the field CRM and lead matching read, to make a
-- navigation control look right.
--
-- WHAT THIS ADDS
--
-- A separate, nullable `portfolio_category_code`. Separate because a project
-- has BOTH a service and a room focus and they answer different questions;
-- nullable because the honest state for an unclassified project is "not yet
-- classified", not a guess.
--
-- NOTHING IS BACKFILLED BY THIS MIGRATION. A guessed category is worse than an
-- absent one: it puts a bedroom label on a project nobody looked at, and the
-- portfolio page then shows it to somebody who asked for bedrooms. Classifying
-- is an editorial act and belongs in the CMS, not in a DDL script.
--
-- `service_code` is untouched.

alter table public.portfolio_projects
  add column if not exists portfolio_category_code text;

comment on column public.portfolio_projects.portfolio_category_code is
  'Room/space category for public portfolio navigation (complete-interiors, kitchen, hall, bedroom). Null until an editor classifies the project. Independent of service_code, which records the service sold.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'chk_portfolio_project_category_code'
  ) then
    alter table public.portfolio_projects
      add constraint chk_portfolio_project_category_code
      check (
        portfolio_category_code is null
        or portfolio_category_code in
          ('complete-interiors', 'kitchen', 'hall', 'bedroom')
      );
  end if;
end
$$;

-- The public listing filters on this column, so it needs an index. Partial:
-- unclassified rows are never selected BY category, and excluding them keeps
-- the index proportional to the classified set rather than the whole table.
create index if not exists idx_portfolio_projects_category
  on public.portfolio_projects (portfolio_category_code)
  where portfolio_category_code is not null;
