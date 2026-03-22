-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Enums
do $$ begin
  create type public.user_role as enum ('citizen', 'lawyer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.case_status as enum ('draft', 'open', 'active', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('requested', 'confirmed', 'completed', 'canceled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'reviewing', 'resolved', 'rejected');
exception when duplicate_object then null; end $$;

-- Helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Profiles (one per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'citizen',
  full_name text,
  avatar_url text,
  phone text,
  city text,
  preferred_language text, -- 'derja', 'ar', 'fr', 'en'
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Citizens
create table if not exists public.citizen_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_contact text, -- 'chat','call','video'
  budget_min numeric,
  budget_max numeric,
  consent_privacy boolean not null default false,
  consent_ai_disclaimer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_citizen_updated_at on public.citizen_profiles;
create trigger trg_citizen_updated_at
before update on public.citizen_profiles
for each row execute function public.set_updated_at();

-- Lawyers (public fields only)
create table if not exists public.lawyer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  years_experience int,
  office_address text,
  consultation_modes text[] not null default '{}', -- ['chat','call','video','in_person']
  languages text[] not null default '{}',          -- ['ar','fr','en','derja']
  base_price_from numeric,
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_lawyer_updated_at on public.lawyer_profiles;
create trigger trg_lawyer_updated_at
before update on public.lawyer_profiles
for each row execute function public.set_updated_at();

-- Lawyer private contact + professional identifiers (restricted)
create table if not exists public.lawyer_private (
  user_id uuid primary key references public.lawyer_profiles(user_id) on delete cascade,
  bar_registration_number text,
  bar_association text,
  contact_email text,
  contact_phone text,
  verification_status text not null default 'pending', -- pending/approved/rejected
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_lawyer_private_updated_at on public.lawyer_private;
create trigger trg_lawyer_private_updated_at
before update on public.lawyer_private
for each row execute function public.set_updated_at();

-- Specialties
create table if not exists public.specialties (
  id bigserial primary key,
  name text not null unique,
  description text
);

create table if not exists public.lawyer_specialties (
  lawyer_id uuid references public.lawyer_profiles(user_id) on delete cascade,
  specialty_id bigint references public.specialties(id) on delete restrict,
  primary key (lawyer_id, specialty_id)
);

-- Availability
create table if not exists public.lawyer_availability (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.lawyer_profiles(user_id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

-- Services (pricing menu)
create table if not exists public.lawyer_services (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.lawyer_profiles(user_id) on delete cascade,
  service_name text not null,
  pricing_type text not null check (pricing_type in ('fixed','hourly')),
  price numeric not null,
  duration_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_services_updated_at on public.lawyer_services;
create trigger trg_services_updated_at
before update on public.lawyer_services
for each row execute function public.set_updated_at();

-- Cases
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  lawyer_id uuid references public.profiles(id) on delete set null,
  specialty_id bigint references public.specialties(id) on delete set null,
  title text,
  description text,
  urgency int not null default 1 check (urgency between 1 and 5),
  status public.case_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_cases_updated_at on public.cases;
create trigger trg_cases_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

-- Immutability: party columns (RLS cannot compare OLD/NEW; trigger enforces)
create or replace function public.cases_enforce_party_update()
returns trigger language plpgsql as $$
begin
  if new.citizen_id is distinct from old.citizen_id then
    raise exception 'cases.citizen_id is immutable';
  end if;
  if old.lawyer_id is not null and new.lawyer_id is distinct from old.lawyer_id then
    raise exception 'cases.lawyer_id is immutable once assigned';
  end if;
  return new;
end $$;

drop trigger if exists trg_cases_enforce_party on public.cases;
create trigger trg_cases_enforce_party
before update on public.cases
for each row execute function public.cases_enforce_party_update();

-- Case messages (chat)
create table if not exists public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message_text text not null,
  created_at timestamptz not null default now()
);

-- Attachments metadata (actual files in Storage)
create table if not exists public.case_attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'case-files',
  object_path text not null, -- storage.objects.name
  mime_type text,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

-- Appointments
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.lawyer_services(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  mode text not null check (mode in ('chat','call','video','in_person')),
  status public.appointment_status not null default 'requested',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create or replace function public.appointments_enforce_parties()
returns trigger language plpgsql as $$
begin
  if new.citizen_id is distinct from old.citizen_id then
    raise exception 'appointments.citizen_id is immutable';
  end if;
  if new.lawyer_id is distinct from old.lawyer_id then
    raise exception 'appointments.lawyer_id is immutable';
  end if;
  return new;
end $$;

drop trigger if exists trg_appointments_enforce_parties on public.appointments;
create trigger trg_appointments_enforce_parties
before update on public.appointments
for each row execute function public.appointments_enforce_parties();

-- Reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

-- Reports / moderation
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

drop trigger if exists trg_reports_updated_at on public.reports;
create trigger trg_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- AI conversations
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  language text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  sender text not null check (sender in ('user','ai')),
  message_text text not null,
  created_at timestamptz not null default now()
);

-- RAG corpus
create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text,
  jurisdiction text, -- Tunisia / governorate / etc.
  published_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536), -- change dimension if needed
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Query paths (RLS and app filters use these columns heavily)
create index if not exists idx_cases_citizen_id on public.cases (citizen_id);
create index if not exists idx_cases_lawyer_id on public.cases (lawyer_id);
create index if not exists idx_cases_status on public.cases (status);
create index if not exists idx_cases_specialty_id on public.cases (specialty_id);
create index if not exists idx_cases_created_at on public.cases (created_at desc);

create index if not exists idx_case_messages_case_id on public.case_messages (case_id);
create index if not exists idx_case_messages_created_at on public.case_messages (case_id, created_at);

create index if not exists idx_case_attachments_case_id on public.case_attachments (case_id);

create index if not exists idx_appointments_citizen_id on public.appointments (citizen_id);
create index if not exists idx_appointments_lawyer_id on public.appointments (lawyer_id);
create index if not exists idx_appointments_start_at on public.appointments (start_at);

create index if not exists idx_lawyer_availability_lawyer_id on public.lawyer_availability (lawyer_id);
create index if not exists idx_lawyer_services_lawyer_id on public.lawyer_services (lawyer_id);
create index if not exists idx_lawyer_specialties_specialty_id on public.lawyer_specialties (specialty_id);

create index if not exists idx_reviews_lawyer_id on public.reviews (lawyer_id);
create index if not exists idx_reports_reporter on public.reports (reporter_id);
create index if not exists idx_reports_reported on public.reports (reported_user_id);
create index if not exists idx_reports_status on public.reports (status);

create index if not exists idx_notifications_user_unread on public.notifications (user_id) where read_at is null;

create index if not exists idx_ai_conversations_citizen on public.ai_conversations (citizen_id);

create index if not exists idx_rag_documents_jurisdiction on public.rag_documents (jurisdiction);

-- Vector index (create after you have some data)
create index if not exists rag_chunks_embedding_ivfflat
on public.rag_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
