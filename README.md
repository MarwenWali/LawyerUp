# LawyerUp

LawyerUp is a legal platform that connects users with lawyers in Tunisia.

## Project Structure

```text
LawyerUp/
|-- backend/          # Node.js + Express REST API (port 3000)
|-- frontend/         # React Native / Expo mobile app
|-- admin-dashboard/  # Vite + React web admin panel (port 8080 or 5173)
|-- ai_iss/           # Python AI assistant runtime (port 8000)
```

## Prerequisites

- Node.js v18+
- Python 3.10+ (for `ai_iss`)
- Supabase project (for managed Postgres)
- Expo CLI (`npm install -g expo-cli`) for mobile app

## Quick Start (Recommended)

### Run Order
Start services in this order:
1. Backend (`backend`)
2. AI runtime (`ai_iss`)
3. Frontend (`frontend`)
4. Admin dashboard (`admin-dashboard`, optional)

### 1) Backend

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
AI_ENGINE_URL=http://localhost:8000
```

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
API: `http://localhost:3000`

### 2) AI Engine (`ai_iss`)

The issuing engine is located in `ai_iss/`.

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

### 3) Mobile App (Frontend)

```bash
cd frontend
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
Open: `http://localhost:5173` or `http://localhost:8080`.

## Useful Backend Scripts

- `npm run dev` - start backend with nodemon
- `npm start` - start backend in normal mode
- `npm run db:migrate` - apply backend schema SQL
- `npm run supabase:migrate` - apply Supabase messaging migrations
- `npm run db:seed` - insert demo data
- `npm run db:reset` - destructive reset

## Troubleshooting

### Port 3000 already in use (Windows)
```bash
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

### Backend cannot connect to DB
- Verify `SUPABASE_DB_URL` in `backend/.env`.
- Keep `DB_SSL=true` for Supabase (default in `.env.example`).

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

## CI/CD and Deployment

This project uses GitLab CI/CD for testing and deployment.
- Tests are configured in `.gitlab-ci.yml` for all components.
- Deployment jobs are available as templates and will need environment-specific credentials to be configured in your GitLab repository settings.

## License
MIT
