create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  description text not null,
  image_path text not null default '',
  sign_up_link text,
  event_type text check (event_type in ('regular', 'potlock picnic', 'weekly meeting')),
  status text not null check (status in ('upcoming', 'past')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

create index if not exists events_status_date_idx on public.events (status, date desc);
