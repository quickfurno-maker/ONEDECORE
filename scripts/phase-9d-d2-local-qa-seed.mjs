/**
 * Local-only commerce browser QA seed for Phase 9D-D2.
 * Inserts one published ready-stock SKU with primary media and serviceable pincode 411001.
 * Requires local Supabase (npm run db:reset first). Never targets managed Supabase.
 *
 * Public get_public_commerce_product does not require media, but M35 publish readiness
 * does (active primary public_path). Seed matches that contract for realistic QA.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const CONTAINER = "supabase_db_OneDecore";
const SKU = "d2-qa-oak-bed";
const SLUG = "d2-qa-oak-bed";
const PINCODE = "411001";

function psql(sql) {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { stdio: "inherit" }
  );
}

try {
  execFileSync("docker", ["inspect", CONTAINER], { stdio: "ignore" });
} catch {
  console.error(
    `Local container ${CONTAINER} is required. Run npm run db:start && npm run db:reset first.`
  );
  process.exit(1);
}

const suffix = Date.now().toString().slice(-6);
const actor = "9d111111-1111-1111-1111-111111111111";
const mediaId = randomUUID();

psql(`
insert into auth.users (id, instance_id, email, aud, role)
values ('${actor}', '00000000-0000-0000-0000-000000000000', 'd2-qa-${suffix}@onedecore.local', 'authenticated', 'authenticated')
on conflict (id) do nothing;
update public.profiles set status = 'active' where id = '${actor}';

insert into public.commerce_tax_rates (id, code, name, rate_basis_points, is_active, created_by)
select gen_random_uuid(), 'GST18D2${suffix}', 'GST 18 D2 QA', 1800, true, '${actor}'
where not exists (select 1 from public.commerce_tax_rates where code = 'GST18D2${suffix}');

with tax as (
  select id from public.commerce_tax_rates where code = 'GST18D2${suffix}' limit 1
), cat as (
  insert into public.commerce_categories (id, category_reference, name, slug, status, created_by)
  values (gen_random_uuid(), 'OD-CC-2026-${suffix}', 'D2 QA Beds', 'd2-qa-beds-${suffix}', 'active', '${actor}')
  on conflict do nothing
  returning id
), cat_id as (
  select id from cat
  union all
  select id from public.commerce_categories where slug = 'd2-qa-beds-${suffix}' limit 1
)
insert into public.commerce_products (
  id, product_reference, category_id, name, slug, status, tax_rate_id, created_by, published_at, short_description
)
select gen_random_uuid(), 'OD-P-2026-${suffix}', cat_id.id, 'D2 QA Oak Bed', '${SLUG}', 'published', tax.id, '${actor}', now(), 'Local QA only'
from cat_id, tax
on conflict (slug) do update set status = 'published', published_at = now(), tax_rate_id = excluded.tax_rate_id;

insert into public.commerce_product_variants (
  id, product_id, sku, option_values, display_name, selling_price_paise, compare_at_price_paise, status, availability_mode, sort_order, created_by
)
select gen_random_uuid(), p.id, '${SKU}', '{"color":"oak"}'::jsonb, 'Oak', 118000, 130000, 'active', 'ready_stock', 0, '${actor}'
from public.commerce_products p
where p.slug = '${SLUG}'
on conflict (sku) do update set status = 'active', selling_price_paise = 118000;

insert into public.commerce_inventory (variant_id, stock_on_hand, reserved_qty, updated_by)
select v.id, 5, 0, '${actor}'
from public.commerce_product_variants v
where v.sku = '${SKU}'
on conflict (variant_id) do update set stock_on_hand = greatest(public.commerce_inventory.stock_on_hand, 5);

insert into public.commerce_product_media (
  id, product_id, original_path, public_path, alt_text, is_primary, status, sort_order, created_by
)
select
  '${mediaId}'::uuid,
  p.id,
  p.id::text || '/${mediaId}/original',
  p.id::text || '/${mediaId}/derivative.webp',
  'D2 QA Oak Bed primary',
  true,
  'active',
  0,
  '${actor}'
from public.commerce_products p
where p.slug = '${SLUG}'
  and not exists (
    select 1
    from public.commerce_product_media m
    where m.product_id = p.id and m.is_primary and m.status = 'active'
  );

insert into public.commerce_pincodes (pincode, serviceable, zone_code, eta_min_days, eta_max_days, updated_by)
values ('${PINCODE}', true, 'Pune', 3, 7, '${actor}')
on conflict (pincode) do update
  set serviceable = true,
      zone_code = excluded.zone_code,
      eta_min_days = excluded.eta_min_days,
      eta_max_days = excluded.eta_max_days,
      updated_by = excluded.updated_by;

update public.commerce_shipping_settings
set cod_enabled_global = true, updated_by = '${actor}'
where id = 1;
`);

console.log(`D2 local QA seed ready: /shop/product/${SLUG} | SKU ${SKU} | pincode ${PINCODE}`);
