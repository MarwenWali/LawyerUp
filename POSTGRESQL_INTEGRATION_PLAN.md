# PostgreSQL Integration Plan for LawyerUp

This document replaces the previous MongoDB plan with instructions for integrating PostgreSQL into the `admin-dashboard` backend. The goal is the same: replace the existing in-memory arrays with a persistent SQL database while keeping the public API routes and response shapes unchanged so the mobile app continues to work.

---

## 1. Current State

| Component       | Location                   | Data today |
|-----------------|-----------------------------|------------------------------------------------------------------------|
| **Backend API** | `admin-dashboard/server.js` | In-memory arrays: `pendingLawyers`, `approvedLawyers`, `rejectedLawyers`, `citizens` |
| **Mobile app**  | `screens/LawyersList.js`    | Fetches from `http://localhost:3001/api/approved-lawyers` |
| **Local state** | `context/AppContext.js`     | AsyncStorage for user + prompt count (stays as-is) |

PostgreSQL will be added **only in the admin-dashboard backend**. The mobile app keeps calling the same API; no change is required there for reading lawyer/citizen data.

---

## 2. High-Level Plan

```
┌─────────────────────┐         HTTP          ┌──────────────────────────┐         ┌─────────────┐
│  LawyerUp (Expo)    │ ◄──────────────────►  │  admin-dashboard/server  │ ◄──────► │ PostgreSQL  │
│  LawyersList, etc.  │   /api/approved-...   │  Express + pg/ORM/knex    │  driver  │  (local/host)│
└─────────────────────┘                       └──────────────────────────┘         └─────────────┘
```

**Steps:**

1. Create a PostgreSQL database (local or hosted).
2. Add a Postgres client or ORM in `admin-dashboard` and connect on startup.
3. Define SQL tables (`lawyers`, `citizens`) and replace in-memory arrays with SQL queries.
4. Keep the same API routes and response shapes so the app keeps working.
5. (Optional) Add environment variable for the connection string and seed script.

---

## 3. Step-by-Step Implementation

### Step 1: Create a PostgreSQL database

- **Option A – Local:** Install PostgreSQL and run it locally; connection string: `postgresql://postgres:password@localhost:5432/lawyerup`.
- **Option B – Cloud (recommended):** Use a hosted provider (ElephantSQL, Railway, Heroku Postgres, AWS RDS). Typical connection string (DATABASE_URL):

```
postgresql://<user>:<password>@<host>:<port>/<database>
```

Use `DATABASE_URL` in `.env` to store the connection string.

### Step 2: Install a Postgres client or ORM in admin-dashboard

You have three solid options — choose one based on preference:

- `pg` (node-postgres): lightweight, raw SQL using parameterized queries.
- `knex`: SQL query builder that supports migrations and seeds.
- `sequelize` or `typeorm`: full-featured ORMs (models, relations, migrations).

Quick install for `pg` + `pg-format` (recommended minimal change):

```bash
cd admin-dashboard
npm install pg
```

Or for `knex` + `pg` (recommended if you want migrations/seeds):

```bash
cd admin-dashboard
npm install knex pg
npx knex init
```

If you prefer an ORM:

```bash
npm install sequelize pg pg-hstore
```

### Step 3: Environment variable for connection string

- Create `admin-dashboard/.env` (and add `.env` to `.gitignore`):

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/lawyerup
```

- In `server.js`, read it with `process.env.DATABASE_URL` (use `dotenv`: `npm install dotenv` and `require('dotenv').config()` at the top).

### Step 4: Create tables (SQL schema)

Suggested SQL schema (single `lawyers` table with `status`):

```sql
CREATE TABLE lawyers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  specialization TEXT,
  experience INTEGER,
  diploma_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  fees NUMERIC,
  rating NUMERIC,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE citizens (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

If using `knex`, convert the above to migrations; if using `sequelize`, define a `Lawyer` model with the same fields.

### Step 5: Connect to PostgreSQL in `server.js`

Example using `pg` (Pool):

```js
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Postgres connection error', err));

module.exports = pool;
```

Optionally start Express after the DB connection succeeds, or allow reconnection logic.

### Step 6: Replace in-memory data with SQL queries

Map each API route to SQL queries that return the same JSON shape as before (ensure `id` is returned, not `row.id` vs `_id`). Examples using `pg`:

- **GET /api/pending-lawyers**

```js
const res = await pool.query("SELECT * FROM lawyers WHERE status = $1 ORDER BY submitted_at DESC", ['pending']);
return res.rows; // map to expected shape if necessary
```

- **GET /api/approved-lawyers**

```js
const res = await pool.query("SELECT * FROM lawyers WHERE status = $1 ORDER BY approved_at DESC", ['approved']);
```

- **GET /api/rejected-lawyers**

```js
const res = await pool.query("SELECT * FROM lawyers WHERE status = $1", ['rejected']);
```

- **GET /api/stats**

```js
const approved = (await pool.query("SELECT COUNT(*) FROM lawyers WHERE status = $1", ['approved'])).rows[0].count;
const pending = (await pool.query("SELECT COUNT(*) FROM lawyers WHERE status = $1", ['pending'])).rows[0].count;
const rejected = (await pool.query("SELECT COUNT(*) FROM lawyers WHERE status = $1", ['rejected'])).rows[0].count;
const citizens = (await pool.query("SELECT COUNT(*) FROM citizens")).rows[0].count;
```

- **POST /api/approve-lawyer/:id**

```js
const { fees, rating } = req.body;
const id = req.params.id;
const res = await pool.query(
  `UPDATE lawyers SET status=$1, fees=$2, rating=$3, approved_at=now() WHERE id=$4 RETURNING *`,
  ['approved', fees, rating, id]
);
```

- **POST /api/reject-lawyer/:id**

```js
const res = await pool.query(
  `UPDATE lawyers SET status=$1, rejected_at=now() WHERE id=$2 RETURNING *`,
  ['rejected', id]
);
```

Ensure API responses preserve field names expected by the frontend. For example, if the frontend expects `id` and `name` etc., return rows directly (Postgres `id` already matches `id`).

### Step 7: Seed initial data (optional)

Create `admin-dashboard/scripts/seed.js` or a SQL file that inserts sample rows so the dashboard and app have data on first run. Example (psql):

```sql
INSERT INTO lawyers (name, email, phone, specialization, experience, status) VALUES
('Alice Doe','alice@example.com','+1','Family Law',8,'approved'),
('Bob Smith','bob@example.com','+2','Criminal Law',3,'pending');
```

Or run a Node seed script that uses `pool.query(...)` to insert rows.

### Step 8: Keep the app working

- No changes needed in the Expo app for read-only lawyer list: it still requests `GET /api/approved-lawyers`.
- If you later add lawyer registration from the app, add a `POST /api/lawyers` that inserts a new row with `status = 'pending'`.

---

## 4. Suggested file changes summary

| File | Action |
|------|--------|
| `admin-dashboard/package.json` | Add dependency: `pg` (and optionally `knex` or `sequelize`), and `dotenv` if not present |
| `admin-dashboard/.env` | New file: `DATABASE_URL=...` (do not commit real credentials) |
| `admin-dashboard/.gitignore` | Ensure `.env` is ignored |
| `admin-dashboard/db/` | New folder: connection helper (e.g. `pool.js`) and migration/seed SQL or `knexfile.js` if using `knex` |
| `admin-dashboard/migrations/` | New (optional): SQL or knex migrations to create `lawyers` and `citizens` tables |
| `admin-dashboard/models/` | New (optional): JS model wrappers if using an ORM (`Lawyer.js`) |
| `admin-dashboard/server.js` | Connect to PostgreSQL; replace arrays with SQL queries using `pool.query` or ORM methods; keep API routes unchanged |
| `admin-dashboard/scripts/seed.js` | New (optional): seed lawyers + citizens using SQL or programmatic inserts |

---

## 5. Optional extensions later

- **Auth:** Store users in Postgres with hashed passwords; add login/register endpoints and use sessions or JWT.
- **Chat history:** Add a `messages` table (or use JSONB) to persist chat sessions.
- **Analytics:** Add tables for usage metrics and sync AsyncStorage periodic reports to Postgres for cross-device analytics.

---

## 6. Quick start checklist

- [ ] Create PostgreSQL database (local or hosted).
- [ ] `cd admin-dashboard && npm install pg dotenv` (or `knex pg` / `sequelize pg` depending on choice)
- [ ] Add `DATABASE_URL` in `.env`.
- [ ] Add DB helper: `admin-dashboard/db/pool.js` or ORM init.
- [ ] Add migrations or run the `CREATE TABLE` statements above.
- [ ] Replace in-memory arrays in `server.js` with SQL queries (examples above).
- [ ] (Optional) Add `scripts/seed.js` and run it once to populate sample data.
- [ ] Run `node server.js` and open the dashboard; confirm lawyers load.
- [ ] Run the Expo app and confirm the lawyers list still loads from the API.

After this, your project will use PostgreSQL as the database for the admin dashboard and for the data consumed by the LawyerUp app.



#	Step
1	Create a MongoDB database – Local (mongodb://localhost:27017/lawyerup) or free MongoDB Atlas cluster.

2	Install Mongoose – In admin-dashboard: npm install mongoose (and optionally dotenv for env vars).

3	Connection string – Put it in admin-dashboard/.env as MONGODB_URI=... and add .env to .gitignore.

4	Define models – Add admin-dashboard/models/Lawyer.js (and optionally Citizen.js) with Mongoose schemas. Use one Lawyer collection with status: 'pending' | 'approved' | 'rejected'.

5	Connect in server.js – On startup run mongoose.connect(process.env.MONGODB_URI).

6	Replace in-memory data – Swap each array for DB calls: e.g. GET /api/approved-lawyers → Lawyer.find({ status: 'approved' }), approve/reject → Lawyer.findByIdAndUpdate(...), stats → Lawyer.countDocuments(...). Keep the same response shape so the app and dashboard don’t need changes.

7	Optional seed – Add admin-dashboard/scripts/seed.js to insert a few lawyers (and citizens) so you have data on first run.

