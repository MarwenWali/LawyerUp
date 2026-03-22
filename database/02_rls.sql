-- Row Level Security — LAWYERUP
-- Run after 01_schema.sql. Replaces weaker update checks and fills tables that
-- had RLS enabled without policies (which effectively denied all access).

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.citizen_profiles enable row level security;
alter table public.lawyer_profiles enable row level security;
alter table public.lawyer_private enable row level security;
alter table public.lawyer_specialties enable row level security;
alter table public.lawyer_availability enable row level security;
alter table public.lawyer_services enable row level security;
alter table public.specialties enable row level security;
alter table public.cases enable row level security;
alter table public.case_messages enable row level security;
alter table public.case_attachments enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;

-- ---------------------------------------------------------------------------
-- Reference data: specialties (read-only for clients; mutate via service role / SQL)
-- ---------------------------------------------------------------------------
create policy "specialties_select_all"
on public.specialties for select
to authenticated, anon
using (true);

-- ---------------------------------------------------------------------------
-- RAG corpus: no client policies — Edge Functions / service role only
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Profiles: own row read/update (directory uses lawyer_directory view, not table)
-- ---------------------------------------------------------------------------
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Citizen profile: own only
-- ---------------------------------------------------------------------------
create policy "citizen_select_own"
on public.citizen_profiles for select
using (user_id = auth.uid());

create policy "citizen_insert_own"
on public.citizen_profiles for insert
with check (user_id = auth.uid());

create policy "citizen_update_own"
on public.citizen_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lawyer profiles: public read; lawyer edits own
-- ---------------------------------------------------------------------------
create policy "lawyer_public_read"
on public.lawyer_profiles for select
using (true);

create policy "lawyer_insert_own"
on public.lawyer_profiles for insert
with check (user_id = auth.uid());

create policy "lawyer_update_own"
on public.lawyer_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lawyer private: lawyer; citizen with active relationship
-- ---------------------------------------------------------------------------
create policy "lawyer_private_select_lawyer"
on public.lawyer_private for select
using (user_id = auth.uid());

create policy "lawyer_private_select_related_citizen"
on public.lawyer_private for select
using (
  exists (
    select 1 from public.appointments a
    where a.lawyer_id = lawyer_private.user_id
      and a.citizen_id = auth.uid()
      and a.status in ('confirmed', 'completed')
  )
  or exists (
    select 1 from public.cases c
    where c.lawyer_id = lawyer_private.user_id
      and c.citizen_id = auth.uid()
  )
);

create policy "lawyer_private_insert_own"
on public.lawyer_private for insert
with check (user_id = auth.uid());

create policy "lawyer_private_update_own"
on public.lawyer_private for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lawyer specialties / availability / services: public read; lawyer owns writes
-- ---------------------------------------------------------------------------
create policy "lawyer_specialties_select_all"
on public.lawyer_specialties for select
using (true);

create policy "lawyer_specialties_write_own"
on public.lawyer_specialties for insert
with check (lawyer_id = auth.uid());

create policy "lawyer_specialties_delete_own"
on public.lawyer_specialties for delete
using (lawyer_id = auth.uid());

create policy "lawyer_availability_select_all"
on public.lawyer_availability for select
using (true);

create policy "lawyer_availability_insert_own"
on public.lawyer_availability for insert
with check (lawyer_id = auth.uid());

create policy "lawyer_availability_update_own"
on public.lawyer_availability for update
using (lawyer_id = auth.uid())
with check (lawyer_id = auth.uid());

create policy "lawyer_availability_delete_own"
on public.lawyer_availability for delete
using (lawyer_id = auth.uid());

create policy "lawyer_services_select_all"
on public.lawyer_services for select
using (true);

create policy "lawyer_services_insert_own"
on public.lawyer_services for insert
with check (lawyer_id = auth.uid());

create policy "lawyer_services_update_own"
on public.lawyer_services for update
using (lawyer_id = auth.uid())
with check (lawyer_id = auth.uid());

create policy "lawyer_services_delete_own"
on public.lawyer_services for delete
using (lawyer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Cases: participants + lawyer claim on unassigned open case
-- ---------------------------------------------------------------------------
create policy "cases_insert_citizen"
on public.cases for insert
with check (citizen_id = auth.uid());

create policy "cases_select_participants"
on public.cases for select
using (citizen_id = auth.uid() or lawyer_id = auth.uid());

-- Citizen updates own case; cannot reassign citizen_id away from self
create policy "cases_update_as_citizen"
on public.cases for update
using (citizen_id = auth.uid())
with check (citizen_id = auth.uid());

-- Assigned lawyer updates; cannot point row at another lawyer
create policy "cases_update_as_lawyer"
on public.cases for update
using (lawyer_id = auth.uid())
with check (lawyer_id = auth.uid());

-- Lawyer self-assigns when case is still unassigned (marketplace accept flow)
create policy "cases_lawyer_claim_open"
on public.cases for update
using (
  lawyer_id is null
  and status in ('draft', 'open')
  and exists (select 1 from public.lawyer_profiles lp where lp.user_id = auth.uid())
)
with check (lawyer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Case messages: participants only
-- ---------------------------------------------------------------------------
create policy "case_messages_select_participants"
on public.case_messages for select
using (
  exists (
    select 1 from public.cases c
    where c.id = case_messages.case_id
      and (c.citizen_id = auth.uid() or c.lawyer_id = auth.uid())
  )
);

create policy "case_messages_insert_participants"
on public.case_messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.cases c
    where c.id = case_messages.case_id
      and (c.citizen_id = auth.uid() or c.lawyer_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Case attachments: participants; uploader or citizen may remove file metadata
-- ---------------------------------------------------------------------------
create policy "case_attachments_select_participants"
on public.case_attachments for select
using (
  exists (
    select 1 from public.cases c
    where c.id = case_attachments.case_id
      and (c.citizen_id = auth.uid() or c.lawyer_id = auth.uid())
  )
);

create policy "case_attachments_insert_participants"
on public.case_attachments for insert
with check (
  uploader_id = auth.uid()
  and exists (
    select 1 from public.cases c
    where c.id = case_attachments.case_id
      and (c.citizen_id = auth.uid() or c.lawyer_id = auth.uid())
  )
);

create policy "case_attachments_delete_participants"
on public.case_attachments for delete
using (
  uploader_id = auth.uid()
  or exists (
    select 1 from public.cases c
    where c.id = case_attachments.case_id
      and (c.citizen_id = auth.uid() or c.lawyer_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Appointments: split updates so party columns cannot be reassigned casually
-- ---------------------------------------------------------------------------
create policy "appointments_select_participants"
on public.appointments for select
using (citizen_id = auth.uid() or lawyer_id = auth.uid());

create policy "appointments_insert_citizen"
on public.appointments for insert
with check (citizen_id = auth.uid());

create policy "appointments_update_as_citizen"
on public.appointments for update
using (citizen_id = auth.uid())
with check (citizen_id = auth.uid());

create policy "appointments_update_as_lawyer"
on public.appointments for update
using (lawyer_id = auth.uid())
with check (lawyer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reviews: align with completed appointment + matching lawyer
-- ---------------------------------------------------------------------------
create policy "reviews_insert_completed"
on public.reviews for insert
with check (
  citizen_id = auth.uid()
  and exists (
    select 1 from public.appointments a
    where a.id = reviews.appointment_id
      and a.citizen_id = auth.uid()
      and a.lawyer_id = reviews.lawyer_id
      and a.status = 'completed'
  )
);

create policy "reviews_public_read"
on public.reviews for select
using (true);

-- ---------------------------------------------------------------------------
-- Reports: reporter and reported user can see row; reporter may edit own
-- ---------------------------------------------------------------------------
create policy "reports_insert_as_reporter"
on public.reports for insert
with check (reporter_id = auth.uid());

create policy "reports_select_involved"
on public.reports for select
using (reporter_id = auth.uid() or reported_user_id = auth.uid());

create policy "reports_update_reporter_own"
on public.reports for update
using (reporter_id = auth.uid())
with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notifications: read + mark read (inserts typically service role / backend)
-- ---------------------------------------------------------------------------
create policy "notifications_select_own"
on public.notifications for select
using (user_id = auth.uid());

create policy "notifications_update_own"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AI chat: citizen only
-- ---------------------------------------------------------------------------
create policy "ai_conversations_select_own"
on public.ai_conversations for select
using (citizen_id = auth.uid());

create policy "ai_conversations_insert_own"
on public.ai_conversations for insert
with check (citizen_id = auth.uid());

create policy "ai_messages_select_own"
on public.ai_messages for select
using (
  exists (
    select 1 from public.ai_conversations ac
    where ac.id = ai_messages.conversation_id
      and ac.citizen_id = auth.uid()
  )
);

create policy "ai_messages_insert_own"
on public.ai_messages for insert
with check (
  exists (
    select 1 from public.ai_conversations ac
    where ac.id = ai_messages.conversation_id
      and ac.citizen_id = auth.uid()
  )
);
