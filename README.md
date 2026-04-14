# LawyerUp

LawyerUp is a legal platform that connects users with lawyers in Tunisia.

## Project Structure

```text
LawyerUp/
|- backend/          Node.js + Express API (port 3000)
|- Frontend/         Expo React Native mobile app
|- admin-dashboard/  Vite React admin web app (port 5173)
|- ai_iss/           Python AI assistant runtime
```

## Prerequisites

- Node.js 18+
- Python 3.10+ (for `ai_iss`)
- A Supabase project

## Quick Start (Recommended)

### 1) Backend

```bash
cd backend
npm install
```

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

### 2) AI Service (required for AI assistant chat)

```bash
cd ai_iss
python -m venv mistral_env
source mistral_env/Scripts/activate
pip install -r requirements.txt
PYTHONUTF8=1 uvicorn api_server:app --host 0.0.0.0 --port 8000
```

If using PowerShell instead of Git Bash:

```powershell
cd ai_iss
python -m venv mistral_env
.\mistral_env\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONUTF8=1
uvicorn api_server:app --host 0.0.0.0 --port 8000
```

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

```bash
cd admin-dashboard
npm install
npm run dev
```

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
