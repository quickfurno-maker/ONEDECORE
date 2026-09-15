-- ONEDECORE E-commerce launch closeout: immutable checkout policy acceptance.
-- COD-only. No payment provider, no M38 payment surface.

create table public.commerce_order_policy_acceptances (
  order_id uuid primary key references public.commerce_orders(id) on delete restrict,
  bundle_version text not null,
  terms_version text not null,
  shipping_delivery_version text not null,
  cancellation_version text not null,
  returns_refunds_version text not null,
  product_warranty_version text not null,
  acceptance_source text not null default 'shop_checkout',
  accepted_at timestamptz not null default now(),
  constraint chk_commerce_policy_bundle_version check (length(bundle_version) between 1 and 128),
  constraint chk_commerce_policy_terms_version check (length(terms_version) between 1 and 128),
  constraint chk_commerce_policy_shipping_version check (length(shipping_delivery_version) between 1 and 128),
  constraint chk_commerce_policy_cancellation_version check (length(cancellation_version) between 1 and 128),
  constraint chk_commerce_policy_returns_version check (length(returns_refunds_version) between 1 and 128),
  constraint chk_commerce_policy_warranty_version check (length(product_warranty_version) between 1 and 128),
  constraint chk_commerce_policy_acceptance_source check (acceptance_source = 'shop_checkout')
);

create trigger trg_commerce_order_policy_acceptances_immutable
  before update or delete on public.commerce_order_policy_acceptances
  for each row execute function private.commerce_forbid_row_mutation();

alter table public.commerce_order_policy_acceptances enable row level security;
alter table public.commerce_order_policy_acceptances force row level security;

create policy commerce_order_policy_acceptances_read
  on public.commerce_order_policy_acceptances
  for select to authenticated
  using ((select public.authorize('commerce.read')));

revoke all privileges on table public.commerce_order_policy_acceptances from public, anon, authenticated, service_role;
grant select on table public.commerce_order_policy_acceptances to authenticated;

create or replace function public.create_public_commerce_cod_order_v2(
  p_lines jsonb,
  p_customer jsonb,
  p_delivery jsonb,
  p_policy_acceptance jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt jsonb;
  order_id_value uuid;
  existing public.commerce_order_policy_acceptances%rowtype;
begin
  if jsonb_typeof(coalesce(p_policy_acceptance, 'null'::jsonb)) <> 'object'
     or coalesce(p_policy_acceptance->>'accepted', '') <> 'true'
     or p_policy_acceptance->>'bundle_version' <> 'commerce-policy-bundle-v1.0'
     or p_policy_acceptance->>'terms_version' <> 'terms-of-use-v1.0'
     or p_policy_acceptance->>'shipping_delivery_version' <> 'commerce-shipping-delivery-v1.0'
     or p_policy_acceptance->>'cancellation_version' <> 'commerce-cancellation-v1.0'
     or p_policy_acceptance->>'returns_refunds_version' <> 'commerce-returns-refunds-v1.0'
     or p_policy_acceptance->>'product_warranty_version' <> 'commerce-product-warranty-v1.0'
  then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;

  receipt := public.create_public_commerce_cod_order(
    p_lines,
    p_customer,
    p_delivery,
    p_idempotency_key
  );

  select o.id into order_id_value
  from public.commerce_orders o
  where o.order_reference = receipt->>'order_reference';

  if order_id_value is null then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;

  select * into existing
  from public.commerce_order_policy_acceptances a
  where a.order_id = order_id_value;

  if found then
    if existing.bundle_version <> p_policy_acceptance->>'bundle_version'
       or existing.terms_version <> p_policy_acceptance->>'terms_version'
       or existing.shipping_delivery_version <> p_policy_acceptance->>'shipping_delivery_version'
       or existing.cancellation_version <> p_policy_acceptance->>'cancellation_version'
       or existing.returns_refunds_version <> p_policy_acceptance->>'returns_refunds_version'
       or existing.product_warranty_version <> p_policy_acceptance->>'product_warranty_version'
    then
      perform private.commerce_order_raise('IDEMPOTENCY_KEY_REUSED');
    end if;
    return receipt;
  end if;

  insert into public.commerce_order_policy_acceptances (
    order_id,
    bundle_version,
    terms_version,
    shipping_delivery_version,
    cancellation_version,
    returns_refunds_version,
    product_warranty_version
  ) values (
    order_id_value,
    p_policy_acceptance->>'bundle_version',
    p_policy_acceptance->>'terms_version',
    p_policy_acceptance->>'shipping_delivery_version',
    p_policy_acceptance->>'cancellation_version',
    p_policy_acceptance->>'returns_refunds_version',
    p_policy_acceptance->>'product_warranty_version'
  );

  return receipt;
end;
$$;

revoke all on function public.create_public_commerce_cod_order_v2(jsonb,jsonb,jsonb,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.create_public_commerce_cod_order_v2(jsonb,jsonb,jsonb,jsonb,uuid)
  to service_role;

comment on table public.commerce_order_policy_acceptances is
  'Immutable server-recorded policy-version acceptance for /shop checkout orders.';
comment on function public.create_public_commerce_cod_order_v2(jsonb,jsonb,jsonb,jsonb,uuid) is
  'COD checkout v2: requires current commerce policy bundle acceptance and atomically records its versions.';
