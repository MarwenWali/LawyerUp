# LawyerUp

LawyerUp is a legal platform that connects users with lawyers in Tunisia.

## Project Structure

```text
LawyerUp/
<<<<<<< HEAD
|-- backend/          # Node.js + Express REST API (port 3000)
|-- Frontend/         # React Native / Expo mobile app
|-- admin-dashboard/  # Vite + React web admin panel (port 8080)
=======
|- backend/          Node.js + Express API (port 3000)
|- Frontend/         Expo React Native mobile app
|- admin-dashboard/  Vite React admin web app (port 5173)
|- ai_iss/           Python AI assistant runtime
>>>>>>> f78499d236a620a1824264420951559984134cfa
```

## Prerequisites

<<<<<<< HEAD
- Node.js v18+
- Supabase project (for managed Postgres)
- Expo CLI (`npm install -g expo-cli`) for mobile app

## 1. Backend Setup
=======
- Node.js 18+
- Python 3.10+ (for `ai_iss`)
- A Supabase project

## Quick Start (Recommended)

### 1) Backend
>>>>>>> f78499d236a620a1824264420951559984134cfa

```bash
cd backend
npm install
```

<<<<<<< HEAD
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
=======
Copy environment file and configure values:

```bash
cp .env.example .env
```

Required variables in `backend/.env`:

- `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `AI_ENGINE_URL` (use `http://localhost:8000` for local AI service)

Apply database setup:

```bash
npm run db:migrate
npm run supabase:migrate
npm run db:seed
```

Start backend:

```bash
npm run dev
```

###iss Engine (AI Core)
The issuing engine is located in `ai_iss/`.
Prerequisites: Python 3.10+, pip, virtualenv.

```bash
cd ai_iss
python -m venv venv
# Windows
.\venv\Scripts\activate
# Unix/macOS
source venv/bin/activate
pip install -r requirements.txt
python main.py
```
Default URL: `http://localhost:8000`

---

### 3) Mobile App (Frontend)

```bash
cd Frontend
npm install
npm start
```

Optional for tunnel/dev network:

- Set `EXPO_PUBLIC_API_URL` if backend is not reachable at local host IP.
- Keep `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` configured.

### 4) Admin Dashboard
>>>>>>> f78499d236a620a1824264420951559984134cfa

```bash
cd admin-dashboard
npm install
npm run dev
```

<<<<<<< HEAD
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
=======
Open: `http://localhost:5173`

## Run Order

Start services in this order:

1. Backend (`backend`)
2. AI runtime (`ai_iss`)
3. Frontend (`Frontend`)
4. Admin dashboard (`admin-dashboard`, optional)

## Useful Backend Scripts

- `npm run dev` - start backend with nodemon
- `npm start` - start backend in normal mode
- `npm run db:migrate` - apply backend schema SQL
- `npm run supabase:migrate` - apply Supabase messaging migrations
- `npm run db:seed` - insert demo data
- `npm run db:reset` - destructive reset

## Troubleshooting

### Failed to create/send chat messages

Run:

```bash
cd backend
npm run db:migrate
npm run supabase:migrate
```

### AI assistant unavailable

Make sure both are running:

1. `backend` API on port `3000`
2. `ai_iss` FastAPI on port `8000`

And verify `AI_ENGINE_URL=http://localhost:8000` in `backend/.env`.
>>>>>>> f78499d236a620a1824264420951559984134cfa
