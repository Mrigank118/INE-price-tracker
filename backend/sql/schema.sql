-- create extension if not exists pgcrypto;

-- create table if not exists tracked_products (
--   id uuid primary key default gen_random_uuid(),
--   source_url text not null unique,
--   external_key text,
--   name text not null,
--   image_url text,
--   currency text,
--   last_price numeric(14,2),
--   last_stock text,
--   last_scraped_at timestamptz,
--   structure_signature text,
--   structure_changed boolean not null default false,
--   structure_changed_at timestamptz,  
--   scrape_interval_minutes integer not null default 120,
-- scrape_interval_minutes integer not null default 120,
-- structure_signature text,
-- structure_changed boolean not null default false,
-- structure_changed_at timestamptz,
-- created_at timestamptz not null default now(),
-- updated_at timestamptz not null default now(),
-- );
-- alter table tracked_products
-- add constraint tracked_products_scrape_interval_check
-- check (scrape_interval_minutes in (120, 240, 360, 720, 1440));

-- create table if not exists price_history (
--   id bigserial primary key,
--   tracked_product_id uuid not null references tracked_products(id) on delete cascade,
--   price numeric(14,2) not null,
--   stock text not null,
--   currency text,
--   scraped_at timestamptz not null default now(),
--   unique(tracked_product_id, scraped_at)
-- );

-- create table if not exists scrape_logs (
--   id bigserial primary key,
--   tracked_product_id uuid not null references tracked_products(id) on delete cascade,
--   attempt integer not null,
--   status text not null check (status in ('success','retried','failed')),
--   message text,
--   http_status integer,
--   duration_ms integer,
--   scraped_at timestamptz not null default now()
-- );

-- create index if not exists price_history_product_time_idx on price_history(tracked_product_id, scraped_at desc);
-- create index if not exists scrape_logs_product_time_idx on scrape_logs(tracked_product_id, scraped_at desc);

-- create or replace function set_updated_at()
-- returns trigger
-- language plpgsql
-- as $$
-- begin
--   new.updated_at = now();
--   return new;
-- end;
-- $$;

-- drop trigger if exists tracked_products_updated_at on tracked_products;
-- create trigger tracked_products_updated_at before update on tracked_products
-- for each row execute function set_updated_at();

-- alter table tracked_products enable row level security;
-- alter table price_history enable row level security;
-- alter table scrape_logs enable row level security;

-- -- The backend uses the Supabase service role. Public browser access is through Express only.
create extension if not exists pgcrypto;

create table if not exists tracked_products (
  id uuid primary key default gen_random_uuid(),

  source_url text not null unique,
  external_key text,
  name text not null,
  image_url text,

  currency text,
  last_price numeric(14,2),
  last_stock text,
  last_scraped_at timestamptz,

  scrape_enabled boolean not null default true,

  scrape_interval_minutes integer not null default 120
    check (scrape_interval_minutes in (120, 240, 360, 720, 1440)),

  structure_signature text,
  structure_changed boolean not null default false,
  structure_changed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists price_history (
  id bigserial primary key,

  tracked_product_id uuid not null
    references tracked_products(id)
    on delete cascade,

  price numeric(14,2) not null,
  stock text not null,
  currency text,

  scraped_at timestamptz not null default now(),

  unique(tracked_product_id, scraped_at)
);

create table if not exists scrape_logs (
  id bigserial primary key,

  tracked_product_id uuid not null
    references tracked_products(id)
    on delete cascade,

  attempt integer not null,

  status text not null
    check (status in ('success', 'retried', 'failed')),

  message text,
  http_status integer,
  duration_ms integer,

  scraped_at timestamptz not null default now()
);

create index if not exists price_history_product_time_idx
  on price_history(tracked_product_id, scraped_at desc);

create index if not exists scrape_logs_product_time_idx
  on scrape_logs(tracked_product_id, scraped_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracked_products_updated_at
on tracked_products;

create trigger tracked_products_updated_at
before update on tracked_products
for each row
execute function set_updated_at();

alter table tracked_products enable row level security;
alter table price_history enable row level security;
alter table scrape_logs enable row level security;

-- The backend uses the Supabase service role.
-- Public browser access is through Express only.
alter table tracked_products
add column if not exists scrape_enabled boolean not null default true;

alter table tracked_products
add column if not exists scrape_interval_minutes integer not null default 120;

alter table tracked_products
add column if not exists structure_signature text;

alter table tracked_products
add column if not exists structure_changed boolean not null default false;

alter table tracked_products
add column if not exists structure_changed_at timestamptz;

update tracked_products
set scrape_interval_minutes = 120
where scrape_interval_minutes is null;

alter table tracked_products
drop constraint if exists tracked_products_scrape_interval_check;

alter table tracked_products
add constraint tracked_products_scrape_interval_check
check (scrape_interval_minutes in (120, 240, 360, 720, 1440));