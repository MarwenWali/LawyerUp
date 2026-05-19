# LawyerUp

## Description
LawyerUp is a comprehensive legal platform designed to connect users with qualified lawyers in Tunisia. It features a mobile application for end-users, an admin dashboard for management, and an AI-powered engine (`ai_iss`) to assist with legal processes.

## Badges
![Pipeline Status](https://gitlab.com/mediterranean-institute-of-technology/iss-projects/2026/lawyerup/badges/main/pipeline.svg)

## Visuals
*(Screenshots or GIFs of the mobile app and admin dashboard can be added here in the future)*

### Prerequisites
- Node.js v18+
- Python 3.10+ (for `ai_iss`)
- Supabase project (for managed Postgres)
- Expo CLI (`npm install -g expo-cli`) for mobile app

### 1 Backend Setup
```bash
cd backend
npm install
```
Create a `backend/.env` file from `backend/.env.example` and ensure it is configured with your Supabase credentials, JWT secret, and `AI_ENGINE_URL=http://localhost:8000`.

Apply migrations and seed data:
```bash
npm run db:migrate
npm run supabase:migrate
npm run db:seed
```

### 2 AI Engine (`ai_iss`) Setup
```bash
cd ai_iss
python -m venv venv
# Windows: .\venv\Scripts\activate
# Unix/macOS: source venv/bin/activate
pip install -r requirements.txt
```

### 3 Mobile App (Frontend) Setup
```bash
cd Frontend
npm install
```

### 4 Admin Dashboard Setup
```bash
cd admin-dashboard
npm install
```

## Usage

Start the services in this recommended order:

1. **Backend**: `cd backend && npm run dev` (Runs on API: `http://localhost:3000`)
2. **AI Engine**: `cd ai_iss && python main.py` (Runs on Default URL: `http://localhost:8000`)
3. **Mobile App**: `cd Frontend && npm start` (Use Expo Go or a physical device)
4. **Admin Dashboard**: `cd admin-dashboard && npm run dev` (Runs on `http://localhost:5173` or `http://localhost:8080`)

**Troubleshooting:**
- **Port 3000 already in use (Windows):** `netstat -ano | findstr :3000` followed by `taskkill /PID <pid> /F`.
- **Backend cannot connect to DB:** Verify `SUPABASE_DB_URL` in `backend/.env` and keep `DB_SSL=true`.
- **AI assistant unavailable:** Ensure both backend and `ai_iss` are running, and verify `AI_ENGINE_URL` is correct.
- **Failed to create/send chat messages:** Re-run `npm run db:migrate` and `npm run supabase:migrate` in the backend folder.

## Support
For help with this project, please open an issue in the GitLab repository or contact the development team.

## Roadmap
- [ ] Complete mobile application UI stabilization
- [ ] Enhance AI model for more accurate legal advice
- [ ] Implement robust multi-language localization
- [ ] Deploy backend and AI services to production environments

## Contributing
Contributions are welcome! Please follow these steps:
1. Ensure your code passes all linting and tests (configured in `.gitlab-ci.yml`).
2. Follow the directory structure (`Frontend`, `backend`, `admin-dashboard`, `ai_iss`).
3. Open a Merge Request against the `main` branch.

**Useful Backend Scripts for Contributors:**
- `npm run db:migrate` - Apply backend schema SQL
- `npm run supabase:migrate` - Apply Supabase messaging migrations
- `npm run db:seed` - Insert demo data
- `npm run db:reset` - Destructive reset of database

## Authors and acknowledgment
Developed by the Mediterranean Institute of Technology (South Mediterranean University) ISS Projects Team 2026. Special thanks to all contributors who worked on the backend, mobile application, admin dashboard, and AI engine.

## License
MIT

## Project status
Active development.
