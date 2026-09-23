alter table public.categories
  add column if not exists subscription_phone text not null default '';
