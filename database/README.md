# LAWYERUP — `database/`

This folder versions **Supabase-aligned PostgreSQL** artifacts in Git: platform DDL, RLS, views, and **optional** seed data. [Supabase](https://supabase.com/) remains the **runtime** host (Postgres, Auth, Storage); these files are the **reproducible blueprint** for fresh environments and code review.

---

## Files and purpose

| File | Purpose |
|------|---------|
| **`01_schema.sql`** | **Legal aid platform schema** — structural DDL only: extensions, types/enums, tables, constraints, indexes, and schema-related functions/triggers. No RLS policies; no `CREATE VIEW`; no seed `INSERT`s. |
| **`02_rls.sql`** | **Row Level Security** — `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, and any small auth helper SQL that belongs with policies. Depends on tables from `01_schema.sql`. |
| **`03_views.sql`** | **Lawyer directory (and related views)** — `CREATE VIEW` / `CREATE OR REPLACE VIEW` definitions that sit on top of the platform schema. Depends on `01_schema.sql`; apply after RLS so behavior matches how the app expects secured data. |
| **`seed.sql`** | **Optional reference data only** — lookup rows (e.g. `INSERT … ON CONFLICT DO NOTHING`). **Not** structural SQL; safe to skip in environments that already have production-like reference data. |
| **`README.md`** | Conventions, execution order, and how this folder relates to hosted Supabase. |

---

## Execution order (required)

Apply to a **fresh** database (or a new Supabase project SQL editor) in this order:

1. **`01_schema.sql`** — create the legal aid platform structure.
2. **`02_rls.sql`** — enable and define RLS policies.
3. **`03_views.sql`** — create the lawyer directory view (and any bundled views).
4. **`seed.sql`** — optional: load reference / lookup data **after** all structure, policies, and views exist.

Skipping steps breaks dependencies: policies need tables; views need underlying tables (and typically RLS in place before you validate access patterns); seeds need tables and any constraints your inserts rely on.

---

## Cloud database vs Git-tracked SQL

- **Supabase (cloud)** is the live database: real users, Auth identities, Storage, and day-to-day changes via dashboard or CLI.
- **`01_schema.sql` / `02_rls.sql` / `03_views.sql`** are **declarative snapshots** split by concern so diffs stay readable (schema vs security vs reporting shape).
- Splitting **structure**, **RLS**, and **views** matches how teams reason about changes: migrations touch tables; security reviews touch policies; product/analytics touch views — without one giant file.

**Reproducibility:** new developers, staging projects, and recovery flows can replay the same ordered scripts instead of re-clicking the dashboard. Pull requests show **what** changed in each layer.

---

## Keeping `seed.sql` separate

- **`seed.sql` must not** create or alter tables, policies, or views. It is **data only** for optional reference catalogs (with idempotent patterns like `ON CONFLICT DO NOTHING` where appropriate).
- Structural changes belong in **`01_schema.sql`**, **`02_rls.sql`**, or **`03_views.sql`** so schema drift never hides inside data scripts.

---

## Suggested repository layout (monorepo)

```text
project-root/
  mobile-app-code/     # e.g. `Frontend/` in this repo
  database/            # this folder — numbered SQL + seed + README
  supabase/            # optional: Supabase CLI, generated migrations, config.toml
  backend/             # optional: API or services outside Supabase-only hosting
  README.md
```

---

## Related assets

- **`backend/config/schema.sql`** — legacy Node-oriented schema. Prefer **`database/01_schema.sql`** (and companions) as the canonical Supabase-aligned source, or merge and delete duplicates deliberately so one blueprint remains.

---

## Populating this folder from Supabase

Paste your three exports into:

- Legal aid platform DDL → **`01_schema.sql`** (below the header comment)
- RLS policies → **`02_rls.sql`**
- Lawyer directory view → **`03_views.sql`**

Then commit so Git history tracks each concern independently.

---

## Engineering notes (9/10 bar)

- **`lawyer_directory`** uses `security_invoker = false` so the view owner (run SQL as `postgres`) can expose **only** listed columns without opening `profiles` phone/email to arbitrary `SELECT` on the table API.
- **Party immutability** on `cases` and `appointments` is enforced with **BEFORE UPDATE triggers**; RLS alone cannot express “`lawyer_id` may change only from NULL → X” safely.
- **RAG** tables have RLS enabled and **no** client policies — ingest and search should use **service role** / Edge Functions.
- **Storage** (`case-files`) still needs **Storage RLS** in the Supabase dashboard (not in this folder).
- **Re-applying `02_rls.sql`** on an existing project will fail with “policy already exists”; use the Supabase migration workflow or `DROP POLICY` per object before recreating.

---

## Upgrading from an older `02_rls.sql`

If you previously created policies with the same names, drop them (or reset the branch DB) before applying the new file. Policy names to reconcile include `profiles_select_own`, `cases_update_participants`, `appointments_update_participants`, `citizen_upsert_own`, `lawyer_private_upsert_own`, etc.
