# LawyerUp Backend API

Backend API for LawyerUp - A legal platform connecting users with lawyers in Tunisia.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup PostgreSQL database**
   ```bash
   # Login to PostgreSQL
   psql -U postgres

   # Create database
   CREATE DATABASE lawyerup;
   
   # Exit psql
   \q
   ```

3. **Configure environment**
   ```bash
   # Copy example env file
   cp .env.example .env
   
   # Edit .env with your database credentials
   ```

4. **Run migrations**
   ```bash
   npm run db:migrate
   ```

5. **Seed demo data (optional)**
   ```bash
   npm run db:seed
   ```

6. **Start server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user/lawyer
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify JWT token

### Lawyers
- `GET /api/lawyers` - Get all verified lawyers (supports filtering)
- `GET /api/lawyers/:id` - Get lawyer details
- `PUT /api/lawyers/profile` - Update lawyer profile (requires auth)

### Cases
- `GET /api/cases` - Get cases (filtered by user role)
- `POST /api/cases` - Create new case (users only)
- `GET /api/cases/:id` - Get case details
- `PATCH /api/cases/:id/status` - Update case status (lawyers only)

### Health Check
- `GET /health` - Server and database health status

## 🗄️ Database Schema

### Tables
- `users` - User accounts (users, lawyers, admins)
- `lawyer_profiles` - Additional lawyer information
- `cases` - Legal cases
- `messages` - Case communications
- `contact_requests` - User-lawyer contact requests
- `reviews` - Lawyer reviews
- `guest_prompts` - AI chat usage tracking

## 🔧 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Populate database with demo data
- `npm run db:reset` - Drop all tables (destructive!)

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in requests:

```
Authorization: Bearer <your-token>
```

### Demo Accounts (after seeding)

**User Account:**
- Email: `user@demo.com`
- Password: `password123`

**Lawyer Account:**
- Email: `gharbi@lawyer.tn`
- Password: `password123`

## 📁 Project Structure

```
backend/
├── config/
│   ├── database.js       # PostgreSQL connection
│   └── schema.sql        # Database schema
├── middleware/
│   ├── auth.js           # JWT authentication
│   └── upload.js         # File upload handling
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── lawyers.js        # Lawyer endpoints
│   └── cases.js          # Case management endpoints
├── scripts/
│   ├── migrate.js        # Migration runner
│   ├── seed.js           # Demo data seeder
│   └── reset.js          # Database reset
├── uploads/              # Uploaded files (diplomas, etc.)
├── .env.example          # Environment variables template
├── server.js             # Express server setup
└── package.json          # Dependencies

```

## 🌐 Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/lawyerup
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lawyerup
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=7d

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
```

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation
- SQL injection prevention (parameterized queries)
- File upload restrictions
- CORS configuration

## 📝 License

ISC
