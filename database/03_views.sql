-- Lawyer directory: public-safe columns only.
--
-- RLS on public.profiles only allows users to read their own row via the table
-- API. The directory must not grant SELECT on all lawyer profile columns (e.g.
-- phone) to every client. This view runs as the owner (postgres in SQL editor),
-- so it bypasses RLS and exposes **only** the columns listed below.
--
-- Requires PostgreSQL 15+ (security_invoker). Supabase projects satisfy this.
create or replace view public.lawyer_directory
with (security_invoker = false)
as
select
  p.id as lawyer_id,
  p.full_name,
  p.city,
  lp.bio,
  lp.years_experience,
  lp.office_address,
  lp.consultation_modes,
  lp.languages,
  lp.base_price_from,
  lp.is_verified
from public.profiles p
join public.lawyer_profiles lp on lp.user_id = p.id
where p.role = 'lawyer';

comment on view public.lawyer_directory is
  'Public lawyer listing; security_invoker=false so RLS on profiles does not block directory reads; keep column list minimal.';

grant select on public.lawyer_directory to anon, authenticated;
