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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists price_history (
  id bigserial primary key,
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price numeric(14,2) not null,
  stock text not null,
  currency text,
  scraped_at timestamptz not null default now(),
  unique(tracked_product_id, scraped_at)
);

create table if not exists scrape_logs (
  id bigserial primary key,
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  attempt integer not null,
  status text not null check (status in ('success','retried','failed')),
  message text,
  http_status integer,
  duration_ms integer,
  scraped_at timestamptz not null default now()
);

create index if not exists price_history_product_time_idx on price_history(tracked_product_id, scraped_at desc);
create index if not exists scrape_logs_product_time_idx on scrape_logs(tracked_product_id, scraped_at desc);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists tracked_products_updated_at on tracked_products;
create trigger tracked_products_updated_at before update on tracked_products
for each row execute function set_updated_at();

alter table tracked_products enable row level security;
alter table price_history enable row level security;
alter table scrape_logs enable row level security;

-- The backend uses the Supabase service role. Public browser access is through Express only.
