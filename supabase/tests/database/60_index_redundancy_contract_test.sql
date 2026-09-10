-- No index may exactly duplicate another.
--
-- WHY THIS IS AN INVARIANT AND NOT THREE ASSERTIONS
--
-- Lane 6 dropped three plain indexes that a UNIQUE constraint index already
-- covered. Asserting those three names are gone would freeze today's schema and
-- say nothing about the fourth one somebody adds next quarter — and the way all
-- three arose is the same: an index written by hand next to a constraint that
-- already provided it.
--
-- So the assertion is the rule. Two indexes on the same table, with the same
-- columns in the same order, the same predicate and the same method are
-- redundant whatever they are called, and one of them is paid for on every
-- write for nothing.
--
-- Deliberately NOT asserted here: that unused indexes are removed. A zero scan
-- count means a feature has not been used yet on a project holding 66 leads. It
-- is not evidence about the index.

begin;
select plan(5);

-- ---------------------------------------------------------------------------
-- The invariant
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
     from (
       select regexp_replace(pg_get_indexdef(i.indexrelid),
                             '^CREATE (UNIQUE )?INDEX [^ ]+ ON ', '') as shape
         from pg_index i
         join pg_class ic on ic.oid = i.indexrelid
         join pg_namespace n on n.oid = ic.relnamespace
        where n.nspname = 'public'
        group by 1
       having count(*) > 1
     ) duplicated),
  0,
  'no two public indexes cover the same table, columns, order and predicate'
);

-- ---------------------------------------------------------------------------
-- The three constraint indexes that did the covering must still exist, or the
-- drops removed capability rather than duplication.
-- ---------------------------------------------------------------------------

select has_index('public', 'attendance_events', 'uq_attendance_events_staff_idempotency',
  'attendance_events keeps its unique idempotency index');

select has_index('public', 'commerce_order_items', 'commerce_order_items_order_id_line_number_key',
  'commerce_order_items keeps its unique order line index');

select has_index('public', 'lead_import_rows', 'uq_lead_import_rows_batch_row',
  'lead_import_rows keeps its unique batch row index');

-- ---------------------------------------------------------------------------
-- And the uniqueness they enforce is intact — the point of preferring the
-- constraint index over the plain one.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
     from pg_constraint
    where conrelid = 'public.lead_import_rows'::regclass
      and contype = 'u'
      and conname = 'uq_lead_import_rows_batch_row'),
  1,
  'the surviving lead_import_rows index is still a UNIQUE constraint'
);

select * from finish();
rollback;
