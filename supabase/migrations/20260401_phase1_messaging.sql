-- Phase 1 Messaging Migration (Admin <-> Lawyer core)
-- File: 20260401_phase1_messaging.sql

begin;

create extension if not exists pgcrypto;

-- 1) Enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'conversation_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.conversation_type AS ENUM ('admin_lawyer', 'lawyer_user');
  END IF;
END$$;

-- 2) Core tables
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'lawyer', 'user')),
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

-- Legacy compatibility:
-- If the app already has an old "messages" table for case messaging, move it aside.
DO $$
DECLARE
  v_target_table text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'conversation_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'case_messages'
    ) THEN
      v_target_table := 'case_messages';
    ELSIF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'case_messages_legacy'
    ) THEN
      v_target_table := 'case_messages_legacy';
    ELSE
      RAISE EXCEPTION 'Cannot move legacy public.messages table because both case_messages and case_messages_legacy already exist.';
    END IF;

    EXECUTE format('ALTER TABLE public.messages RENAME TO %I', v_target_table);

    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_messages_case_id'
    ) THEN
      EXECUTE format(
        'ALTER INDEX public.idx_messages_case_id RENAME TO %I',
        'idx_' || v_target_table || '_case_id'
      );
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_messages_sender_id'
    ) THEN
      EXECUTE format(
        'ALTER INDEX public.idx_messages_sender_id RENAME TO %I',
        'idx_' || v_target_table || '_sender_id'
      );
    END IF;
  END IF;
END$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  attachment_url text,
  created_at timestamptz not null default now(),
  constraint messages_content_or_attachment_chk
    check (char_length(trim(content)) > 0 or attachment_url is not null)
);

create table if not exists public.message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (message_id, user_id)
);

-- 3) Indexes (required + useful)
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
create index if not exists idx_conv_participants_user_id on public.conversation_participants(user_id);
create index if not exists idx_conv_participants_conversation_id on public.conversation_participants(conversation_id);
create index if not exists idx_message_reads_message_id on public.message_reads(message_id);
create index if not exists idx_message_reads_user_id on public.message_reads(user_id);

-- 4) Helpers
create or replace function public.set_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_set_conversation_updated_at on public.messages;
create trigger trg_set_conversation_updated_at
after insert on public.messages
for each row execute function public.set_conversation_updated_at();

create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

revoke all on function public.is_conversation_participant(uuid, uuid) from public;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated, service_role;

create or replace function public.is_conversation_admin(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = coalesce(p_user_id, auth.uid())
      and cp.role = 'admin'
  );
$$;

revoke all on function public.is_conversation_admin(uuid, uuid) from public;
grant execute on function public.is_conversation_admin(uuid, uuid) to authenticated, service_role;

create or replace function public.find_direct_conversation(
  p_type public.conversation_type,
  p_user_a uuid,
  p_user_b uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.conversations c
  join public.conversation_participants cp_a
    on cp_a.conversation_id = c.id and cp_a.user_id = p_user_a
  join public.conversation_participants cp_b
    on cp_b.conversation_id = c.id and cp_b.user_id = p_user_b
  where c.type = p_type
    and (
      select count(*)
      from public.conversation_participants cp_count
      where cp_count.conversation_id = c.id
    ) = 2
  order by c.updated_at desc
  limit 1;
$$;

revoke all on function public.find_direct_conversation(public.conversation_type, uuid, uuid) from public;
grant execute on function public.find_direct_conversation(public.conversation_type, uuid, uuid) to authenticated, service_role;

create or replace function public.has_accepted_lawyer_user_relationship(
  p_lawyer_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.cases c
      where c.user_id = p_user_id
        and c.lawyer_id = p_lawyer_id
        and c.status in ('accepted', 'completed')
    )
    or exists (
      select 1
      from public.contact_requests cr
      where cr.user_id = p_user_id
        and cr.lawyer_id = p_lawyer_id
        and cr.status = 'accepted'
    );
$$;

revoke all on function public.has_accepted_lawyer_user_relationship(uuid, uuid) from public;
grant execute on function public.has_accepted_lawyer_user_relationship(uuid, uuid) to authenticated, service_role;

-- Handy read API for mobile inbox
create or replace function public.list_conversations_for_user(
  p_type public.conversation_type default null
)
returns table (
  conversation_id uuid,
  conversation_type public.conversation_type,
  updated_at timestamptz,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count bigint,
  other_participant_id uuid,
  other_participant_role text
)
language sql
security definer
set search_path = public
as $$
with my_conversations as (
  select c.id, c.type, c.updated_at
  from public.conversations c
  join public.conversation_participants cp
    on cp.conversation_id = c.id
  where cp.user_id = auth.uid()
    and (p_type is null or c.type = p_type)
),
last_message as (
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.content,
    m.created_at,
    m.sender_id
  from public.messages m
  join my_conversations mc on mc.id = m.conversation_id
  order by m.conversation_id, m.created_at desc
),
unread as (
  select
    m.conversation_id,
    count(*)::bigint as unread_count
  from public.messages m
  join my_conversations mc on mc.id = m.conversation_id
  where m.sender_id <> auth.uid()
    and not exists (
      select 1
      from public.message_reads mr
      where mr.message_id = m.id
        and mr.user_id = auth.uid()
    )
  group by m.conversation_id
),
other_participant as (
  select
    cp.conversation_id,
    cp.user_id,
    cp.role,
    row_number() over (partition by cp.conversation_id order by cp.joined_at asc) as rn
  from public.conversation_participants cp
  join my_conversations mc on mc.id = cp.conversation_id
  where cp.user_id <> auth.uid()
)
select
  mc.id as conversation_id,
  mc.type as conversation_type,
  mc.updated_at,
  lm.content as last_message,
  lm.created_at as last_message_at,
  lm.sender_id as last_sender_id,
  coalesce(u.unread_count, 0) as unread_count,
  op.user_id as other_participant_id,
  op.role as other_participant_role
from my_conversations mc
left join last_message lm on lm.conversation_id = mc.id
left join unread u on u.conversation_id = mc.id
left join other_participant op on op.conversation_id = mc.id and op.rn = 1
order by coalesce(lm.created_at, mc.updated_at) desc;
$$;

revoke all on function public.list_conversations_for_user(public.conversation_type) from public;
grant execute on function public.list_conversations_for_user(public.conversation_type) to authenticated, service_role;

create or replace function public.list_messages_for_conversation(
  p_conversation_id uuid,
  p_limit integer default 50,
  p_before timestamptz default null
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  attachment_url text,
  created_at timestamptz,
  read_by_me boolean,
  read_by_all boolean,
  read_count bigint
)
language sql
security definer
set search_path = public
as $$
with participant_guard as (
  select public.is_conversation_participant(p_conversation_id, auth.uid()) as allowed
),
participant_counts as (
  select count(*)::bigint as participant_count
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
),
base as (
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    m.content,
    m.attachment_url,
    m.created_at
  from public.messages m
  join participant_guard g on g.allowed = true
  where m.conversation_id = p_conversation_id
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
)
select
  b.id,
  b.conversation_id,
  b.sender_id,
  b.content,
  b.attachment_url,
  b.created_at,
  exists (
    select 1
    from public.message_reads mr
    where mr.message_id = b.id
      and mr.user_id = auth.uid()
  ) as read_by_me,
  (
    select count(*)
    from public.message_reads mr
    where mr.message_id = b.id
      and mr.user_id <> b.sender_id
  ) >= greatest((select pc.participant_count - 1 from participant_counts pc), 0) as read_by_all,
  (
    select count(*)::bigint
    from public.message_reads mr
    where mr.message_id = b.id
  ) as read_count
from base b
order by b.created_at desc;
$$;

revoke all on function public.list_messages_for_conversation(uuid, integer, timestamptz) from public;
grant execute on function public.list_messages_for_conversation(uuid, integer, timestamptz) to authenticated, service_role;

create or replace function public.mark_conversation_read(
  p_conversation_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted bigint := 0;
begin
  if not public.is_conversation_participant(p_conversation_id, auth.uid()) then
    raise exception 'Not a participant in conversation %', p_conversation_id using errcode = '42501';
  end if;

  insert into public.message_reads (message_id, user_id)
  select m.id, auth.uid()
  from public.messages m
  where m.conversation_id = p_conversation_id
    and m.sender_id <> auth.uid()
    and not exists (
      select 1
      from public.message_reads mr
      where mr.message_id = m.id
        and mr.user_id = auth.uid()
    )
  on conflict (message_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;

-- 5) RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

drop policy if exists conversations_select_participants on public.conversations;
create policy conversations_select_participants
on public.conversations
for select
to authenticated
using (public.is_conversation_participant(id, auth.uid()));

drop policy if exists conversations_insert_authenticated on public.conversations;
create policy conversations_insert_authenticated
on public.conversations
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists conversations_update_participants on public.conversations;
create policy conversations_update_participants
on public.conversations
for update
to authenticated
using (public.is_conversation_participant(id, auth.uid()))
with check (public.is_conversation_participant(id, auth.uid()));

drop policy if exists participants_select_conversation_members on public.conversation_participants;
create policy participants_select_conversation_members
on public.conversation_participants
for select
to authenticated
using (public.is_conversation_participant(conversation_id, auth.uid()));

drop policy if exists participants_insert_self_or_admin on public.conversation_participants;
create policy participants_insert_self_or_admin
on public.conversation_participants
for insert
to authenticated
with check (
  auth.uid() is not null
  and (
    user_id = auth.uid()
    or public.is_conversation_admin(conversation_id, auth.uid())
  )
);

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants
on public.messages
for select
to authenticated
using (public.is_conversation_participant(conversation_id, auth.uid()));

drop policy if exists messages_insert_sender_participant on public.messages;
create policy messages_insert_sender_participant
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id, auth.uid())
);

drop policy if exists message_reads_select_participants on public.message_reads;
create policy message_reads_select_participants
on public.message_reads
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_reads.message_id
      and public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

drop policy if exists message_reads_insert_self on public.message_reads;
create policy message_reads_insert_self
on public.message_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    where m.id = message_reads.message_id
      and public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

-- 6) Storage bucket + policies for attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists message_attachments_select_participants on storage.objects;
create policy message_attachments_select_participants
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.is_conversation_participant(split_part(name, '/', 1)::uuid, auth.uid())
);

drop policy if exists message_attachments_insert_participants on storage.objects;
create policy message_attachments_insert_participants
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.is_conversation_participant(split_part(name, '/', 1)::uuid, auth.uid())
);

-- 7) Seed data (best effort, only if compatible users exist)
DO $$
declare
  v_admin uuid;
  v_lawyer uuid;
  v_user uuid;
  v_admin_lawyer_conversation uuid;
  v_lawyer_user_conversation uuid;
  v_message_id uuid;
begin
  -- Prefer role-aligned ids using auth_user_links first, then direct id matches.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    select coalesce(aul.auth_user_id, pu.id) into v_admin
    from public.users pu
    left join public.auth_user_links aul on aul.public_user_id = pu.id
    where pu.role = 'admin'
      and exists (
        select 1
        from auth.users au
        where au.id = coalesce(aul.auth_user_id, pu.id)
      )
    order by pu.created_at
    limit 1;

    select coalesce(aul.auth_user_id, pu.id) into v_lawyer
    from public.users pu
    left join public.auth_user_links aul on aul.public_user_id = pu.id
    where pu.role = 'lawyer'
      and coalesce(aul.auth_user_id, pu.id) <> coalesce(v_admin, '00000000-0000-0000-0000-000000000000'::uuid)
      and exists (
        select 1
        from auth.users au
        where au.id = coalesce(aul.auth_user_id, pu.id)
      )
    order by pu.created_at
    limit 1;

    select coalesce(aul.auth_user_id, pu.id) into v_user
    from public.users pu
    left join public.auth_user_links aul on aul.public_user_id = pu.id
    where pu.role = 'user'
      and coalesce(aul.auth_user_id, pu.id) not in (
        coalesce(v_admin, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(v_lawyer, '00000000-0000-0000-0000-000000000000'::uuid)
      )
      and exists (
        select 1
        from auth.users au
        where au.id = coalesce(aul.auth_user_id, pu.id)
      )
    order by pu.created_at
    limit 1;
  end if;

  -- Fallback to any users so migration stays runnable in fresh projects.
  if v_admin is null then
    select id into v_admin from auth.users order by created_at asc limit 1;
  end if;

  if v_lawyer is null then
    select id into v_lawyer
    from auth.users
    where id <> coalesce(v_admin, '00000000-0000-0000-0000-000000000000'::uuid)
    order by created_at asc
    limit 1;
  end if;

  if v_user is null then
    select id into v_user
    from auth.users
    where id not in (
      coalesce(v_admin, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(v_lawyer, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    order by created_at asc
    limit 1;
  end if;

  -- Seed: admin <-> lawyer thread
  if v_admin is not null and v_lawyer is not null then
    select c.id into v_admin_lawyer_conversation
    from public.conversations c
    where c.type = 'admin_lawyer'
      and exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = c.id and cp.user_id = v_admin
      )
      and exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = c.id and cp.user_id = v_lawyer
      )
    limit 1;

    if v_admin_lawyer_conversation is null then
      insert into public.conversations (type)
      values ('admin_lawyer')
      returning id into v_admin_lawyer_conversation;

      insert into public.conversation_participants (conversation_id, user_id, role)
      values
        (v_admin_lawyer_conversation, v_admin, 'admin'),
        (v_admin_lawyer_conversation, v_lawyer, 'lawyer')
      on conflict (conversation_id, user_id) do nothing;
    end if;

    if not exists (
      select 1 from public.messages m
      where m.conversation_id = v_admin_lawyer_conversation
    ) then
      insert into public.messages (conversation_id, sender_id, content)
      values (v_admin_lawyer_conversation, v_admin, 'Welcome to the admin-lawyer channel. Phase 1 seed message.')
      returning id into v_message_id;

      insert into public.message_reads (message_id, user_id)
      values (v_message_id, v_admin)
      on conflict (message_id, user_id) do nothing;
    end if;
  end if;

  -- Seed: lawyer <-> user thread
  if v_lawyer is not null and v_user is not null then
    select c.id into v_lawyer_user_conversation
    from public.conversations c
    where c.type = 'lawyer_user'
      and exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = c.id and cp.user_id = v_lawyer
      )
      and exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = c.id and cp.user_id = v_user
      )
    limit 1;

    if v_lawyer_user_conversation is null then
      insert into public.conversations (type)
      values ('lawyer_user')
      returning id into v_lawyer_user_conversation;

      insert into public.conversation_participants (conversation_id, user_id, role)
      values
        (v_lawyer_user_conversation, v_lawyer, 'lawyer'),
        (v_lawyer_user_conversation, v_user, 'user')
      on conflict (conversation_id, user_id) do nothing;
    end if;

    if not exists (
      select 1 from public.messages m
      where m.conversation_id = v_lawyer_user_conversation
    ) then
      insert into public.messages (conversation_id, sender_id, content)
      values (v_lawyer_user_conversation, v_lawyer, 'Hello, your case has been accepted. We can discuss details here.')
      returning id into v_message_id;

      insert into public.message_reads (message_id, user_id)
      values (v_message_id, v_lawyer)
      on conflict (message_id, user_id) do nothing;
    end if;
  end if;
end$$;

commit;
