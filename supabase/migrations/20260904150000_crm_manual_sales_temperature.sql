-- ONEDECORE CRM — MANUAL SALES TEMPERATURE (M56)
--
-- The salesperson controls the working temperature; the system supplies
-- intelligence, not authority.
--
-- FOUR SEPARATE CONCEPTS, and this migration touches exactly one of them:
--
--   Lifecycle stage        leads.status — authoritative for WON / LOST / HOLD
--   Manual temperature     THIS — human judgement, HOT / WARM / COLD only
--   Advisory system score   deterministic, in TypeScript, unchanged here
--   Milestones             site visit + quotation, unchanged here
--
-- The EFFECTIVE owner-facing bucket is derived, never stored:
--   lifecycle override  >  manual temperature  >  system score fallback
--
-- Storing the effective bucket would let it drift from the lifecycle the moment
-- a lead was closed or parked. Only the human's choice and its audit trail are
-- persisted.
--
-- LOST / WON / HOLD can NEVER be persisted here. They are lifecycle outcomes,
-- and a CHECK constraint enforces that rather than trusting the callers.
--
-- Forward-only. No applied migration is edited, and nothing is backfilled: a
-- lead with no human judgement keeps NULL and uses the system suggestion until
-- someone actually chooses.

-- -----------------------------------------------------------------------------
-- A. Storage
-- -----------------------------------------------------------------------------

alter table public.leads
  add column if not exists manual_sales_temperature text,
  add column if not exists manual_sales_temperature_set_at timestamptz,
  add column if not exists manual_sales_temperature_set_by uuid,
  add column if not exists manual_sales_temperature_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_leads_manual_sales_temperature_set_by'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint fk_leads_manual_sales_temperature_set_by
      foreign key (manual_sales_temperature_set_by)
      references public.profiles (id) on delete set null;
  end if;
end;
$$;

alter table public.leads drop constraint if exists chk_leads_manual_sales_temperature;
alter table public.leads add constraint chk_leads_manual_sales_temperature check (
  manual_sales_temperature is null
  or manual_sales_temperature in ('hot', 'warm', 'cold')
);

comment on column public.leads.manual_sales_temperature is
  'Human sales judgement: hot/warm/cold ONLY. Never lost/won/on_hold — those are lifecycle outcomes read from leads.status. NULL means "use the system suggestion".';

-- Metadata is coherent or absent: a stored temperature always carries who set
-- it and when, and clearing the override clears all of it. Otherwise a cleared
-- lead would keep a stale actor and look manually classified in the audit.
alter table public.leads drop constraint if exists chk_leads_manual_sales_temperature_meta;
alter table public.leads add constraint chk_leads_manual_sales_temperature_meta check (
  (
    manual_sales_temperature is null
    and manual_sales_temperature_set_at is null
    and manual_sales_temperature_set_by is null
    and manual_sales_temperature_reason is null
  )
  or (
    manual_sales_temperature is not null
    and manual_sales_temperature_set_at is not null
  )
);

alter table public.leads drop constraint if exists chk_leads_manual_sales_temperature_reason;
alter table public.leads add constraint chk_leads_manual_sales_temperature_reason check (
  manual_sales_temperature_reason is null
  or length(trim(manual_sales_temperature_reason)) between 1 and 500
);

-- Partial index: the overwhelming majority of rows are NULL (no human override
-- yet), and the only query that needs this column filters for rows that have one.
create index if not exists idx_leads_manual_sales_temperature
  on public.leads (manual_sales_temperature)
  where manual_sales_temperature is not null;

-- -----------------------------------------------------------------------------
-- B. Audit vocabulary
-- -----------------------------------------------------------------------------
--
-- Reuses the canonical append-only `lead_events` ledger rather than inventing a
-- second audit mechanism. One narrow new event type is added; every existing
-- type is reproduced verbatim so nothing already recorded becomes invalid.

alter table public.lead_events drop constraint if exists chk_lead_events_type;
alter table public.lead_events add constraint chk_lead_events_type check (
  event_type in (
    'lead.created',
    'lead.status_changed',
    'lead.assigned',
    'lead.note_added',
    'lead.duplicate_detected',
    'lead.consent_updated',
    'lead.on_hold',
    'lead.resumed',
    'lead.sales_temperature_set'
  )
);

-- -----------------------------------------------------------------------------
-- C. The mutation
-- -----------------------------------------------------------------------------

/**
 * Sets or clears a lead's manual sales temperature.
 *
 * `p_temperature` is 'hot' | 'warm' | 'cold', or NULL to clear the override and
 * return the lead to the system suggestion.
 *
 * Authorization mirrors `transition_lead_status_impl` exactly, and deliberately
 * reuses `leads.transition` rather than inventing a second near-identical
 * permission: the people allowed to move a lead through the pipeline are
 * precisely the people who should be able to classify how hot it is. The caller
 * must ALSO be able to mutate this specific lead under existing CRM scope, so an
 * assignment-scoped executive cannot reclassify someone else's lead.
 *
 * FAILS CLOSED at every gate.
 */
create or replace function private.set_lead_sales_temperature_impl(
  p_lead_id uuid,
  p_temperature text,
  p_reason text default null
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_old text;
  v_new text;
  v_reason text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.transition')) then
    raise exception 'Permission denied to set lead sales temperature' using errcode = '42501';
  end if;

  -- Normalized before validation so 'HOT' and 'hot' behave identically, and an
  -- empty string is treated as "clear", not as an invalid value.
  v_new := nullif(lower(trim(coalesce(p_temperature, ''))), '');

  if v_new is not null and v_new not in ('hot', 'warm', 'cold') then
    -- Names the three that ARE valid rather than echoing the rejected input.
    raise exception 'INVALID_SALES_TEMPERATURE: expected hot, warm or cold'
      using errcode = '22023';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(p_lead_id)) then
    raise exception 'Lead not visible for sales temperature change' using errcode = '42501';
  end if;

  -- A lifecycle override is in effect, so the temperature is not what the
  -- workspace is showing. Editing it here would be invisible and confusing.
  -- The STORED value is left untouched: a lead resumed from hold returns to the
  -- temperature its owner last chose.
  if v_lead.status in ('closed_won', 'closed_lost', 'on_hold') then
    raise exception 'LIFECYCLE_OVERRIDES_TEMPERATURE: % leads are classified by lifecycle, not temperature', v_lead.status
      using errcode = '22023';
  end if;

  v_old := v_lead.manual_sales_temperature;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  -- A no-op must not write misleading history.
  if v_old is not distinct from v_new then
    return v_lead;
  end if;

  update public.leads
  set manual_sales_temperature = v_new,
      manual_sales_temperature_set_at = case when v_new is null then null else now() end,
      manual_sales_temperature_set_by = case when v_new is null then null else v_actor end,
      manual_sales_temperature_reason = case when v_new is null then null else v_reason end,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_events (
    lead_id, event_type, actor_id, actor_type, occurred_at, event_data
  )
  values (
    p_lead_id,
    'lead.sales_temperature_set',
    v_actor,
    'staff',
    -- clock_timestamp(), not the now() default: several temperature changes can
    -- land in ONE transaction, and now() is the transaction timestamp, so they
    -- would share an instant and the history would have no real order.
    clock_timestamp(),
    jsonb_build_object(
      -- Explicit JSON nulls: clearing an override is a real, auditable decision,
      -- and the reader must be able to tell it from a missing field.
      'from', to_jsonb(v_old),
      'to', to_jsonb(v_new),
      'reason', to_jsonb(v_reason),
      'source', case when v_new is null then 'system' else 'manual' end
    )
  );

  return v_lead;
end;
$$;

comment on function private.set_lead_sales_temperature_impl(uuid, text, text) is
  'Sets or clears a lead manual sales temperature (hot/warm/cold). Refuses while a lifecycle override is in effect, and never stores lost/won/on_hold.';

create or replace function public.set_lead_sales_temperature(
  p_lead_id uuid,
  p_temperature text,
  p_reason text default null
)
returns public.leads
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.set_lead_sales_temperature_impl(p_lead_id, p_temperature, p_reason);
end;
$$;

revoke all on function private.set_lead_sales_temperature_impl(uuid, text, text) from public, anon;
revoke all on function public.set_lead_sales_temperature(uuid, text, text) from public, anon;
-- The public wrapper is `security invoker`, so it executes as the CALLER and
-- needs execute on the impl. Mirrors `transition_lead_status_impl`.
grant execute on function private.set_lead_sales_temperature_impl(uuid, text, text) to authenticated;
grant execute on function public.set_lead_sales_temperature(uuid, text, text) to authenticated;

alter function private.set_lead_sales_temperature_impl(uuid, text, text) owner to postgres;
alter function public.set_lead_sales_temperature(uuid, text, text) owner to postgres;
