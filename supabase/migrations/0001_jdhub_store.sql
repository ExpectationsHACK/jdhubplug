-- JDHub store on Supabase (Postgres).
--
-- The app keeps its data as keys, hashes and lists (the same model it uses with
-- Redis), stored in three tables and accessed only through the functions below.
-- Run this once in Supabase → SQL Editor → New query → Run.
--
-- Security: row level security is on with no policies, and every function is
-- executable by the service_role only, so the public anon key can't read or
-- change anything. The app calls these functions with SUPABASE_SERVICE_ROLE_KEY
-- from the server; that key must never be exposed to the browser.

create table if not exists public.jd_kv (
  key text primary key,
  value text not null,
  expires_at timestamptz
);

create table if not exists public.jd_hash (
  key text not null,
  field text not null,
  value text not null,
  primary key (key, field)
);

create table if not exists public.jd_list (
  id bigserial primary key,
  key text not null,
  value text not null
);
create index if not exists jd_list_key_id on public.jd_list (key, id desc);

alter table public.jd_kv enable row level security;
alter table public.jd_hash enable row level security;
alter table public.jd_list enable row level security;

-- ------------------------------------------------------------------ strings

create or replace function public.jd_get(k text) returns text
language sql as $$
  select value from public.jd_kv where key = k and (expires_at is null or expires_at > now());
$$;

create or replace function public.jd_set(k text, v text) returns void
language sql as $$
  insert into public.jd_kv (key, value, expires_at) values (k, v, null)
  on conflict (key) do update set value = excluded.value, expires_at = null;
$$;

create or replace function public.jd_setnx(k text, v text, ttl integer) returns boolean
language plpgsql as $$
declare inserted boolean;
begin
  delete from public.jd_kv where key = k and expires_at is not null and expires_at <= now();
  insert into public.jd_kv (key, value, expires_at)
  values (k, v, now() + make_interval(secs => ttl))
  on conflict (key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.jd_del(k text) returns void
language sql as $$
  delete from public.jd_kv where key = k;
  delete from public.jd_hash where key = k;
  delete from public.jd_list where key = k;
$$;

create or replace function public.jd_incr(k text) returns bigint
language sql as $$
  insert into public.jd_kv (key, value) values (k, '1')
  on conflict (key) do update set value = (public.jd_kv.value::bigint + 1)::text
  returning value::bigint;
$$;

-- ------------------------------------------------------------------- hashes

create or replace function public.jd_hget(k text, f text) returns text
language sql as $$
  select value from public.jd_hash where key = k and field = f;
$$;

create or replace function public.jd_hgetall(k text) returns jsonb
language sql as $$
  select coalesce(jsonb_object_agg(field, value), '{}'::jsonb) from public.jd_hash where key = k;
$$;

create or replace function public.jd_hmget(k text, fields text[]) returns jsonb
language sql as $$
  select coalesce(jsonb_agg(h.value order by f.ord), '[]'::jsonb)
  from unnest(fields) with ordinality as f(field, ord)
  left join public.jd_hash h on h.key = k and h.field = f.field;
$$;

create or replace function public.jd_hset(k text, vals jsonb) returns void
language sql as $$
  insert into public.jd_hash (key, field, value)
  select k, e.key, e.value from jsonb_each_text(vals) e
  on conflict (key, field) do update set value = excluded.value;
$$;

create or replace function public.jd_hdel(k text, fields text[]) returns void
language sql as $$
  delete from public.jd_hash where key = k and field = any(fields);
$$;

create or replace function public.jd_hincrby(k text, f text, by bigint) returns bigint
language sql as $$
  insert into public.jd_hash (key, field, value) values (k, f, by::text)
  on conflict (key, field) do update set value = (public.jd_hash.value::bigint + by)::text
  returning value::bigint;
$$;

-- -------------------------------------------------------------------- lists

create or replace function public.jd_lpush(k text, v text) returns void
language sql as $$
  insert into public.jd_list (key, value) values (k, v);
$$;

-- Keep elements start..stop (0 = newest), like Redis LTRIM. stop = -1 keeps the rest.
create or replace function public.jd_ltrim(k text, start integer, stop integer) returns void
language sql as $$
  delete from public.jd_list l
  using (
    select id, row_number() over (order by id desc) - 1 as pos from public.jd_list where key = k
  ) r
  where l.id = r.id and (r.pos < start or (stop >= 0 and r.pos > stop));
$$;

create or replace function public.jd_lrange(k text, start integer, stop integer) returns jsonb
language sql as $$
  select coalesce(jsonb_agg(value order by id desc), '[]'::jsonb) from (
    select id, value from public.jd_list where key = k order by id desc
    offset start limit case when stop < 0 then null else greatest(stop - start + 1, 0) end
  ) s;
$$;

-- -------------------------------------------------------------------- stock

-- Atomically take stock for every line, or none. Rows are locked in a fixed
-- order so concurrent checkouts can't deadlock. lines = [["product-id", qty], ...]
create or replace function public.jd_reserve(stock_key text, sold_key text, lines jsonb) returns jsonb
language plpgsql as $$
declare
  l record;
  have bigint;
begin
  for l in
    select e->>0 as id, (e->>1)::bigint as qty from jsonb_array_elements(lines) e order by 1
  loop
    select value::bigint into have from public.jd_hash where key = stock_key and field = l.id for update;
    if coalesce(have, 0) < l.qty then
      return jsonb_build_object('ok', false, 'id', l.id, 'available', coalesce(have, 0));
    end if;
  end loop;
  for l in select e->>0 as id, (e->>1)::bigint as qty from jsonb_array_elements(lines) e loop
    update public.jd_hash set value = (value::bigint - l.qty)::text where key = stock_key and field = l.id;
    perform public.jd_hincrby(sold_key, l.id, l.qty);
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

-- Return units to stock (inverse of jd_reserve). Sold never goes below zero.
create or replace function public.jd_release(stock_key text, sold_key text, lines jsonb) returns void
language plpgsql as $$
declare l record;
begin
  for l in select e->>0 as id, (e->>1)::bigint as qty from jsonb_array_elements(lines) e order by 1 loop
    perform public.jd_hincrby(stock_key, l.id, l.qty);
    update public.jd_hash set value = greatest(value::bigint - l.qty, 0)::text where key = sold_key and field = l.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- privileges

do $$
declare fn text;
begin
  foreach fn in array array[
    'jd_get(text)', 'jd_set(text,text)', 'jd_setnx(text,text,integer)', 'jd_del(text)', 'jd_incr(text)',
    'jd_hget(text,text)', 'jd_hgetall(text)', 'jd_hmget(text,text[])', 'jd_hset(text,jsonb)', 'jd_hdel(text,text[])',
    'jd_hincrby(text,text,bigint)', 'jd_lpush(text,text)', 'jd_ltrim(text,integer,integer)', 'jd_lrange(text,integer,integer)',
    'jd_reserve(text,text,jsonb)', 'jd_release(text,text,jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon, authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', fn);
    end if;
  end loop;
end;
$$;

revoke all on public.jd_kv, public.jd_hash, public.jd_list from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.jd_kv, public.jd_hash, public.jd_list from anon, authenticated;
    grant all on public.jd_kv, public.jd_hash, public.jd_list to service_role;
    grant usage on sequence public.jd_list_id_seq to service_role;
  end if;
end;
$$;
