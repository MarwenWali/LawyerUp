/*
================================================================================
LAWYERUP — Optional reference data ONLY (not structural SQL)
================================================================================

This file contains **INSERT** statements for optional lookup / reference rows.
It does **not** create tables, policies, or views.

EXECUTION ORDER (required)
--------------------------
  Run **only after**:

    1. `01_schema.sql`  — platform DDL
    2. `02_rls.sql`     — RLS policies
    3. `03_views.sql`   — views (e.g. lawyer directory)
    4. `seed.sql`       — this file (optional)

TARGET TABLE (from `01_schema.sql`)
-------------------------------------
  - `public.specialties` — `name text not null unique`, optional `description`.
    Uses `ON CONFLICT (name) DO NOTHING` so re-runs are safe.

NOT SEEDED HERE
---------------
  - `lawyer_specialties` — needs real `lawyer_id` UUIDs from `auth.users` /
    `profiles`; assign in app or a dedicated dev script after test users exist.
  - `rag_documents` / `rag_chunks` — corpus + embeddings; load via a separate
    ingestion pipeline, not this lookup seed.

Run as **postgres** in the SQL editor (or **service role**); those roles bypass
RLS. `specialties` has RLS with **SELECT** for `anon`/`authenticated` only —
no client **INSERT** on specialties, so reference rows are added via SQL or
service role.

================================================================================
*/

begin;

insert into public.specialties (name, description)
values
  ('Administrative law', 'Challenges against public authorities, permits, and administrative decisions.'),
  ('Banking and finance', 'Loans, guarantees, regulatory compliance, and financial disputes.'),
  ('Civil law', 'General civil obligations, liability, and private disputes.'),
  ('Commercial and corporate law', 'Companies, contracts, mergers, and business transactions.'),
  ('Constitutional and human rights', 'Fundamental rights, constitutional review, and related litigation.'),
  ('Consumer protection', 'Unfair practices, warranties, and disputes with traders or service providers.'),
  ('Contract law', 'Drafting, interpretation, breach, and enforcement of agreements.'),
  ('Criminal law', 'Defense and representation in criminal proceedings.'),
  ('Data protection and privacy', 'GDPR-style rights, consent, and processing agreements.'),
  ('Employment and labor law', 'Hiring, termination, workplace disputes, and collective relations.'),
  ('Environmental law', 'Permits, compliance, pollution, and environmental liability.'),
  ('Family law', 'Marriage, divorce, custody, alimony, and succession matters.'),
  ('Immigration and nationality', 'Residence permits, nationality, and cross-border status.'),
  ('Insurance law', 'Coverage disputes, claims, and policy interpretation.'),
  ('Intellectual property', 'Trademarks, patents, copyrights, and unfair competition.'),
  ('Maritime and transport law', 'Shipping, carriage, and related commercial disputes.'),
  ('Mediation and arbitration', 'Alternative dispute resolution outside standard courts.'),
  ('Notarial and property formalities', 'Authentic acts, transfers, and land registration support.'),
  ('Public procurement', 'Tenders, appeals, and contracts with public entities.'),
  ('Real estate and construction', 'Sales, leases, construction contracts, and co-ownership.'),
  ('Startups and SMEs', 'Founding teams, cap tables, and early-stage commercial deals.'),
  ('Tax law', 'Tax planning, audits, assessments, and disputes with tax authorities.'),
  ('Torts and personal injury', 'Damages, negligence, and compensation claims.')
on conflict (name) do nothing;

commit;
