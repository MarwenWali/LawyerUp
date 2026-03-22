# LawyerUp

A legal platform connecting users with lawyers in Tunisia.

## Project Structure

```
LawyerUp/
├── backend/          # Node.js + Express REST API (port 3000)
├── frontend/         # React Native / Expo mobile app
├── admin-dashboard/  # Vite + React web admin panel (port 8080)
└── ai-engine/        # AI assistant service
```

---

## Prerequisites

- **Node.js** v18+ — https://nodejs.org
- **PostgreSQL** v14+ — https://www.postgresql.org
- **Expo CLI** — `npm install -g expo-cli` (for mobile app)
- A PostgreSQL client (e.g. `psql` or pgAdmin)

---

## 1. Database Setup

### Create the database

```bash
psql -U postgres
```

```sql
CREATE DATABASE lawyerup;
\q
```

---

## 2. Backend

```bash
cd backend
npm install
```

### Configure environment variables

Create a `.env` file inside `backend/`:

```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lawyerup
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT
JWT_SECRET=your_super_secret_jwt_key
```

### Run migrations and seed demo data

```bash
npm run db:migrate   # create all tables and constraints
npm run db:seed      # insert demo accounts and sample data
```

### Start the backend

```bash
node server.js
```

The API will be available at `http://localhost:3000`.

#### Demo accounts (created by the seed script)

| Role   | Email                   | Password    |
|--------|-------------------------|-------------|
| Admin  | admin@lawyerup.tn       | password123 |
| User   | user@demo.com           | password123 |
| Lawyer | gharbi@lawyer.tn        | password123 |

---

## 3. Admin Dashboard

```bash
cd admin-dashboard
npm install
npm run dev
```

Open `http://localhost:8080` and log in with the **Admin** credentials above.

---

## 4. Mobile App (Frontend)

```bash
cd frontend
npm install
npm start          # starts the Expo dev server
```

- Press **A** to open in an Android emulator
- Press **I** to open in an iOS simulator (macOS only)
- Scan the QR code with the **Expo Go** app on your phone

### Configure the API URL

In `frontend/constants/` (or wherever your API base URL is set), make sure it points to your machine's local IP address instead of `localhost` when running on a physical device:

```js
const API_URL = 'http://192.168.x.x:3000'; // replace with your LAN IP
```

---

## 5. Starting Everything Together

Open three terminals and run each service:

```bash
# Terminal 1 – Backend
cd backend && node server.js

# Terminal 2 – Admin Dashboard
cd admin-dashboard && npm run dev

# Terminal 3 – Mobile App
cd frontend && npm start
```

---

## Useful Backend Scripts

| Command              | Description                              |
|----------------------|------------------------------------------|
| `npm run db:migrate` | Apply all schema migrations              |
| `npm run db:seed`    | Seed demo users, lawyers, and cases      |
| `npm run db:reset`   | Drop and recreate all tables (⚠️ destructive) |
| `node server.js`     | Start in production mode                 |
| `npm run dev`        | Start with nodemon (auto-restart on change) |

---

## Troubleshooting

**Backend fails to connect to PostgreSQL**
- Ensure PostgreSQL is running: `pg_ctl status` or check Services on Windows.
- Double-check `DB_PASSWORD` in `.env` — this is the only required field with no default.

**Port 3000 already in use**
```bash
# Windows
netstat -ano | findstr :3000    # find the PID
taskkill /PID <pid> /F

# macOS / Linux
lsof -ti:3000 | xargs kill
```

**Expo app cannot reach the backend on a physical device**
- Replace `localhost` with your computer's LAN IP address in the frontend API config.
- Ensure your phone and computer are on the same Wi-Fi network.

**`npm run db:migrate` fails**
- Make sure the `lawyerup` database exists in PostgreSQL before running migrations.
