# LawyerUp

A legal platform connecting users with lawyers in Tunisia.

## Project Structure

```
LawyerUp/
|-- backend/          # Node.js + Express REST API (port 3000)
|-- Frontend/         # React Native / Expo mobile app
|-- admin-dashboard/  # Vite + React web admin panel (port 8080)
```

## Prerequisites

- Node.js v18+
- Supabase project (for managed Postgres)
- Expo CLI (`npm install -g expo-cli`) for mobile app

## 1. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` from `backend/.env.example` and configure:

```env
# Server
PORT=3000
NODE_ENV=development

# Supabase Postgres (recommended)
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT
JWT_SECRET=your_super_secret_jwt_key
```

Run migrations and seed demo data:

```bash
npm run db:migrate
npm run db:seed
```

Start backend:

```bash
npm run dev
```

API: `http://localhost:3000`

## 2. Admin Dashboard

```bash
cd admin-dashboard
npm install
npm run dev
```

Open `http://localhost:8080`.

## 3. Mobile App (Frontend)

```bash
cd Frontend
npm install
npm start
```

If testing on a physical device, set API URL to your LAN IP (not `localhost`).

## Useful Backend Scripts

- `npm run db:migrate` - Apply schema migrations
- `npm run db:seed` - Seed demo users and cases
- `npm run db:reset` - Drop/recreate DB tables (destructive)
- `npm run dev` - Start backend with nodemon
- `npm start` - Start backend in normal mode

## Troubleshooting

Backend cannot connect to DB:
- Verify `SUPABASE_DB_URL` in `backend/.env`.
- Keep `DB_SSL=true` for Supabase (default in `.env.example`).

Port 3000 already in use:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```
