-- Auth Bridge for Messaging
-- File: 20260401_auth_user_links.sql

begin;

create table if not exists public.auth_user_links (
  public_user_id uuid primary key references public.users(id) on delete cascade,
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auth_user_links_auth_user_id on public.auth_user_links(auth_user_id);

create or replace function public.set_auth_user_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_auth_user_links_updated_at on public.auth_user_links;
create trigger trg_auth_user_links_updated_at
before update on public.auth_user_links
for each row execute function public.set_auth_user_links_updated_at();

-- Best-effort backfill where ids already match.
insert into public.auth_user_links (public_user_id, auth_user_id)
select u.id, u.id
from public.users u
join auth.users au on au.id = u.id
on conflict (public_user_id) do nothing;

commit;