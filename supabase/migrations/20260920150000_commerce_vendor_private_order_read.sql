-- ONEDECORE vendor-safe order read model.
-- External vendors may see only order lifecycle and their own line items.
-- Customer identity, contact, delivery and actor metadata stay excluded at the DB boundary.

create or replace function public.list_my_vendor_commerce_orders(
  p_limit integer default 50
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vendor uuid := private.commerce_require_vendor();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(x.payload order by x.created_at desc), '[]'::jsonb)
    into v_result
  from (
    select
      o.created_at,
      jsonb_build_object(
        'order_id', o.id,
        'order_reference', o.order_reference,
        'status', o.status,
        'payment_method', o.payment_method,
        'placed_at', o.created_at,
        'processing_at', o.processing_at,
        'shipped_at', o.shipped_at,
        'delivered_at', o.delivered_at,
        'cancelled_at', o.cancelled_at,
        'tracking_reference', o.fulfilment_tracking_reference,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'line_number', i.line_number,
            'product_id', i.product_id,
            'product_reference', i.product_reference,
            'product_name', i.product_name,
            'sku', i.sku,
            'variant_display_name', i.variant_display_name,
            'quantity', i.quantity,
            'selling_unit_price_paise', i.selling_unit_price_paise,
            'line_total_paise', i.line_total_paise,
            'availability_mode', i.availability_mode,
            'primary_image_public_path', i.primary_image_public_path
          ) order by i.line_number)
          from public.commerce_order_items i
          join public.commerce_products p on p.id = i.product_id
          where i.order_id = o.id
            and p.vendor_id = v_vendor
        ), '[]'::jsonb),
        'events', coalesce((
          select jsonb_agg(jsonb_build_object(
            'event_code', e.event_code,
            'from_status', e.from_status,
            'to_status', e.to_status,
            'created_at', e.created_at
          ) order by e.created_at)
          from public.commerce_order_events e
          where e.order_id = o.id
        ), '[]'::jsonb)
      ) as payload
    from public.commerce_orders o
    where exists (
      select 1
      from public.commerce_order_items i
      join public.commerce_products p on p.id = i.product_id
      where i.order_id = o.id
        and p.vendor_id = v_vendor
    )
    order by o.created_at desc
    limit v_limit
  ) x;

  return v_result;
end;
$$;

alter function public.list_my_vendor_commerce_orders(integer) owner to postgres;
revoke all on function public.list_my_vendor_commerce_orders(integer) from public, anon, authenticated;
grant execute on function public.list_my_vendor_commerce_orders(integer) to authenticated;

comment on function public.list_my_vendor_commerce_orders(integer) is
  'Vendor-only order feed: own product lines, quantities and lifecycle timeline; intentionally excludes all customer, delivery, contact and actor identity data.';
