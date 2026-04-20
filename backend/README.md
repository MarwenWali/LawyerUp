<<<<<<< HEAD
# LawyerUp Backend API

Backend API for LawyerUp.

## Quick Start (Supabase)

### Prerequisites
- Node.js 18+
- A Supabase project

### 1. Install
<<<<<<< HEAD
=======
# LawyerUp Admin Dashboard

This is the admin web dashboard for managing lawyer applications and approvals in the LawyerUp mobile application.

## Features

- View pending lawyer applications
- Approve/reject lawyer applications
- View all approved lawyers
- Real-time statistics

## Setup & Installation

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation Steps

1. Navigate to the admin dashboard directory:
```bash
cd admin-dashboard
```

2. Install dependencies:
>>>>>>> ac06b9d385fe69f171134b1ac0df934904a576d2
```bash
npm install
```

<<<<<<< HEAD
=======
```bash
npm install
```

>>>>>>> f78499d236a620a1824264420951559984134cfa
### 2. Configure environment
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

### 3. Run schema and seed
```bash
npm run db:migrate
npm```

### 4. Start API
<<<<<<< HEAD
=======
3. Start the server:
```bash
npm start
```

The admin dashboard will be available at: **http://localhost:3001**

### Development Mode

For development with auto-reload:
>>>>>>> ac06b9d385fe69f171134b1ac0df934904a576d2
```bash
npm run dev
```

<<<<<<< HEAD
=======
```bash
npm run dev
```

## Scripts
- `npm run dev` - Start with nodemon
- `npm start` - Start server
- `npm run db:migrate` - Apply schema from `config/schema.sql`
- `npm run db:seed` - Insert demo data
- `npm run db:reset` - Drop tables (destructive)

### Database Management
- `npm run db:reset`: Drop all tables and recreate them.
- `npm run db:migrate`: Run the schema script to create/patch tables.
- `npm run db:seed`: Populate the database with test data.

## Database Connection Priority
1. `SUPABASE_DB_URL`
2. `DATABASE_URL`
3. `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`

## Supabase Client Usage
Use the shared client from `config/supabase.js`:

```js
import { requireSupabase } from '../config/supabase.js';

const supabase = requireSupabase(); // uses SUPABASE_PUBLISHABLE_KEY
const supabaseAdmin = requireSupabase({ admin: true }); // uses SUPABASE_SERVICE_ROLE_KEY
```

## Auth
Use JWT Bearer token:
```http
Authorization: Bearer <token>
```
<<<<<<< HEAD
=======
## API Endpoints

### Get Pending Lawyers
```
GET /api/pending-lawyers
```
Returns a list of all pending lawyer applications.

### Get Approved Lawyers
```
GET /api/approved-lawyers
```
Returns a list of all approved lawyers.

### Approve a Lawyer
```
POST /api/approve-lawyer/:id
```
Approves a pending lawyer application by ID.

### Reject a Lawyer
```
POST /api/reject-lawyer/:id
```
Rejects and removes a pending lawyer application by ID.

## How It Works

1. **Pending Applications Tab**: Shows all lawyers awaiting admin approval. Each application displays:
   - Lawyer's name and specialization
   - Contact information (email, phone)
   - Submission date
   - Approve/Reject buttons

2. **Approved Lawyers Tab**: Shows all lawyers who have been approved and are active on the platform.

3. **Approval Workflow**:
   - When a lawyer signs up on the mobile app with their diploma, they appear in the "Pending Applications" tab
   - Admin reviews and approves or rejects the application
   - Approved lawyers can immediately start receiving client inquiries
   - Rejected lawyers are removed from the pending list

## Integration with Mobile App

The mobile app will:
1. Send lawyer signup requests with diploma images to the backend
2. Store the lawyer's `approved: false` status locally until admin approval
3. Check approval status when lawyer tries to log in
4. Show "Awaiting Admin Approval" message if not yet approved

## Database Integration

Currently, the dashboard uses in-memory storage. To persist data permanently:

1. Replace the `pendingLawyers` and `approvedLawyers` arrays with database calls
2. Connect to MongoDB, PostgreSQL, or another database
3. Update the API endpoints to use database operations

Example MongoDB integration (future enhancement):
```javascript
const MongoDB = require('mongodb').MongoClient;
// ... database connection code
```

## Security Considerations

For production deployment:
- Add authentication (JWT, OAuth2)
- Implement HTTPS
- Add rate limiting
- Validate all inputs
- Use environment variables for sensitive data
- Implement CORS properly based on your domain

## Future Enhancements

- File upload for diploma verification
- Admin user management
- Application status history
- Email notifications for approval/rejection
- Search and advanced filtering
- Lawyer profile editing
- Suspension/ban functionality
>>>>>>> ac06b9d385fe69f171134b1ac0df934904a576d2
=======
>>>>>>> f78499d236a620a1824264420951559984134cfa
