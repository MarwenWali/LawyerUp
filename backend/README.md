# LawyerUp Backend API

Backend API for LawyerUp.

## Quick Start (Supabase)

### Prerequisites
- Node.js 18+
- A Supabase project

### 1. Install
```bash
npm install
```

### 2. Configure Environment
Create `backend/.env` from `backend/.env.example` and set at least:

```env
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=your-secret
```

Notes:
- `SUPABASE_DB_URL` is the DB connection used by this backend.
- `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` are required for `supabase-js` client features.
- `SUPABASE_SERVICE_ROLE_KEY` is optional unless you need admin-level Supabase operations.
- `SUPABASE_ANON_KEY` is still accepted as a legacy fallback.
- SSL is enabled by default for managed DBs. Set `DB_SSL=false` only for local non-SSL Postgres.

### 3. Run Schema And Seed
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start API
```bash
npm run dev
```

## Scripts
- `npm run dev` - Start with nodemon
- `npm start` - Start server
- `npm run db:migrate` - Apply schema from `config/schema.sql`
- `npm run db:seed` - Insert demo data
- `npm run db:reset` - Drop tables (destructive)

## Database Connection Priority
1. `SUPABASE_DB_URL`
2. `DATABASE_URL`
3. `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`

## Supabase Client Usage
Use the shared client from `config/supabase.js`:

```js
import { requireSupabase } from '../config/supabase.js';

const supabase = requireSupabase();
const supabaseAdmin = requireSupabase({ admin: true });
```

## Auth
Use JWT Bearer token:
```http
Authorization: Bearer <token>
```
