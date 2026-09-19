-- Owner mobile push notification device registry.
--
-- Tokens are accepted only through the authenticated mobile API, which applies
-- the canonical CRM owner permission gate. Native clients never receive direct
-- table privileges and never receive service-role credentials.

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null,
  project_id uuid not null,
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  last_error_code text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_tokens_platform_chk
    check (platform in ('android', 'ios')),
  constraint mobile_push_tokens_expo_token_chk
    check (
      expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
    )
);

create index if not exists idx_mobile_push_tokens_active_project
  on public.mobile_push_tokens (project_id, user_id)
  where enabled = true;

alter table public.mobile_push_tokens enable row level security;

revoke all on table public.mobile_push_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.mobile_push_tokens to service_role;

comment on table public.mobile_push_tokens is
  'Owner-app Expo push tokens. Written only by the server after canonical mobile owner authorization; never directly by the native client.';
comment on column public.mobile_push_tokens.expo_push_token is
  'Expo push token used only for owner operational notifications.';

