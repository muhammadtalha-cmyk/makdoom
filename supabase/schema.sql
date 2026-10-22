-- Makhdoom Fragrances — Supabase schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query → Run.
-- Then run supabase/seed.sql to load the 5 starting products.
-- Safe to re-run at any time (every statement is idempotent), which is also how you upgrade an existing install.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type order_status as enum ('pending', 'confirmed', 'dispatched', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------- helper: updated_at ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- products ----------
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  inspired_by       text,
  gender            text not null check (gender in ('men','women','unisex','couple')),
  price             integer not null check (price > 0),            -- PKR
  compare_at_price  integer check (compare_at_price is null or compare_at_price > 0),
  tagline           text not null default '',
  short_description text not null default '',
  description       text not null default '',
  scent_family      text[] not null default '{}',
  accent            text not null default '#d9a441',
  is_bundle         boolean not null default false,
  bundle_slugs      text[] not null default '{}',
  image             text not null,
  gallery           text[] not null default '{}',
  in_stock          boolean not null default true,
  featured          boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists products_updated on products;
create trigger products_updated before update on products for each row execute function set_updated_at();

-- ---------- orders (guest checkout, cash on delivery only) ----------
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,                 -- e.g. MF-7K2QXD
  status          order_status not null default 'pending',
  customer_name   text not null,
  phone           text not null,                        -- normalised 03XXXXXXXXX
  email           text,
  city            text not null,
  address         text not null,
  notes           text,
  subtotal        integer not null,
  shipping_fee    integer not null default 0,
  total           integer not null,
  payment_method  text not null default 'cod' check (payment_method = 'cod'),
  owner_notified  boolean not null default false,       -- owner email sent?
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_phone_idx on orders (phone);
create index if not exists orders_status_idx on orders (status);
drop trigger if exists orders_updated on orders;
create trigger orders_updated before update on orders for each row execute function set_updated_at();

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_slug  text not null,
  product_name  text not null,
  unit_price    integer not null,
  quantity      integer not null check (quantity > 0),
  line_total    integer not null
);
create index if not exists order_items_order_idx on order_items (order_id);

-- ---------- newsletter + contact ----------
create table if not exists subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  message    text not null,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- The website writes orders/messages/subscribers ONLY through server routes using the
-- service-role key (which bypasses RLS). The public (anon) key can only READ products.
alter table products    enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table subscribers enable row level security;
alter table messages    enable row level security;

drop policy if exists "Public can read products" on products;
create policy "Public can read products" on products for select to anon, authenticated using (true);
-- No policies on the other tables = no access for anon/authenticated. Keep it that way.


-- =====================================================================================================
-- PRODUCTION HARDENING (v2)
-- =====================================================================================================

-- ---------- idempotent checkout ----------
alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_idx on orders (idempotency_key) where idempotency_key is not null;
create index if not exists orders_order_phone_idx on orders (order_number, phone);

-- data integrity the application relies on
do $$ begin
  alter table orders add constraint orders_total_matches check (total = subtotal + shipping_fee);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table orders add constraint orders_phone_format check (phone ~ '^03[0-9]{9}$');
exception when duplicate_object then null; end $$;

-- inbox: let the owner mark messages as handled
alter table messages add column if not exists handled boolean not null default false;
create index if not exists messages_created_idx on messages (created_at desc);
create index if not exists subscribers_created_idx on subscribers (created_at desc);

-- ---------- atomic order creation ----------
-- Order + items are written in ONE transaction. If anything fails nothing is stored (no half-orders).
create or replace function create_order(p_order jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_created timestamptz;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order has no items';
  end if;
  insert into orders (order_number, customer_name, phone, email, city, address, notes, subtotal, shipping_fee, total, payment_method, idempotency_key)
  values (
    p_order->>'order_number', p_order->>'customer_name', p_order->>'phone', nullif(p_order->>'email',''), p_order->>'city', p_order->>'address',
    nullif(p_order->>'notes',''), (p_order->>'subtotal')::int, (p_order->>'shipping_fee')::int, (p_order->>'total')::int, 'cod',
    nullif(p_order->>'idempotency_key','')
  ) returning id, created_at into v_id, v_created;

  insert into order_items (order_id, product_slug, product_name, unit_price, quantity, line_total)
  select v_id, i->>'slug', i->>'name', (i->>'unit_price')::int, (i->>'quantity')::int, (i->>'line_total')::int
  from jsonb_array_elements(p_items) i;

  return jsonb_build_object('id', v_id, 'created_at', v_created);
end $$;
revoke all on function create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function create_order(jsonb, jsonb) to service_role;

-- ---------- shared rate limiter (works across every serverless instance) ----------
create table if not exists rate_limits (
  key      text primary key,
  count    integer not null,
  reset_at timestamptz not null
);
alter table rate_limits enable row level security;

create or replace function rl_hit(p_key text, p_limit int, p_window_s int)
returns table (allowed boolean, retry_after int)
language plpgsql security definer set search_path = public as $$
declare v_count int; v_reset timestamptz;
begin
  insert into rate_limits as r (key, count, reset_at) values (p_key, 1, now() + make_interval(secs => p_window_s))
  on conflict (key) do update set
    count    = case when r.reset_at < now() then 1 else r.count + 1 end,
    reset_at = case when r.reset_at < now() then now() + make_interval(secs => p_window_s) else r.reset_at end
  returning r.count, r.reset_at into v_count, v_reset;

  if random() < 0.01 then delete from rate_limits where reset_at < now() - interval '1 hour'; end if; -- opportunistic cleanup

  return query select v_count <= p_limit, greatest(1, ceil(extract(epoch from (v_reset - now())))::int);
end $$;
revoke all on function rl_hit(text, int, int) from public, anon, authenticated;
grant execute on function rl_hit(text, int, int) to service_role;

-- ---------- admin audit trail ----------
create table if not exists audit_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  action  text not null,
  target  text,
  meta    jsonb not null default '{}'::jsonb,
  ip_hash text
);
create index if not exists audit_log_at_idx on audit_log (at desc);
alter table audit_log enable row level security;

-- ---------- least privilege ----------
-- anon/authenticated may only read products (policy above). Revoke everything else explicitly, in case defaults change.
revoke all on orders, order_items, subscribers, messages, rate_limits, audit_log from anon, authenticated;
grant select on products to anon, authenticated;


-- =====================================================================================================
-- ADMIN CATALOGUE MANAGER (v3): hover picture + picture storage
-- =====================================================================================================

-- second catalogue picture shown when a shopper hovers a product card
alter table products add column if not exists hover_image text;

-- public bucket for pictures uploaded from the owner dashboard (the dashboard also creates it on first upload if missing)
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('product-images', 'product-images', true, 4194304, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do update set public = true, file_size_limit = 4194304, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
  end if;
end $$;
