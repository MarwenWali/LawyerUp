-- Auth Bridge Rollback
-- File: 20260401_auth_user_links_down.sql

begin;

drop trigger if exists trg_auth_user_links_updated_at on public.auth_user_links;
drop function if exists public.set_auth_user_links_updated_at();
drop table if exists public.auth_user_links;

commit;