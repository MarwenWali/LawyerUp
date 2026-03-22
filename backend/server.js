import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Import routes
import authRoutes from './routes/auth.js';
import lawyersRoutes from './routes/lawyers.js';
import casesRoutes from './routes/cases.js';
import usersRoutes from './routes/users.js';
import contactsRoutes from './routes/contacts.js';
import reviewsRoutes from './routes/reviews.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import notificationsRoutes from './routes/notifications.js';

// Import database
import pool from './config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Allow requests from the mobile Expo dev server and the admin dashboard
const allowedOrigins = [
  'http://localhost:8080',   // Admin dashboard (vite dev)
  'http://localhost:5173',   // Vite alternative port
  'http://localhost:3000',
  'http://localhost:19006',  // Expo web
  'http://localhost:8081',   // Expo Metro
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman) or whitelisted origins
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/lawyers', lawyersRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Free the port if something is already using it (prevents EADDRINUSE on restart)
function freePort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port} "`, { encoding: 'utf8' });
    const pids = [...new Set(
      out.trim().split('\n')
        .map(l => l.trim().split(/\s+/).pop())
        .filter(p => p && p !== '0' && /^\d+$/.test(p))
    )];
    for (const p of pids) {
      try { execSync(`taskkill /PID ${p} /F`, { stdio: 'ignore' }); } catch {}
    }
    if (pids.length) console.log(`🔄 Freed port ${port} (killed PID${pids.length > 1 ? 's' : ''} ${pids.join(', ')})`);
  } catch {}
}

freePort(PORT);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 LawyerUp Backend Server is running!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📚 API Endpoints:`);
  console.log(`   GET  /health                  - Health check`);
  console.log(`   POST /api/auth/register       - Register new user`);
  console.log(`   POST /api/auth/login          - Login`);
  console.log(`   GET  /api/auth/verify         - Verify token`);
  console.log(`   GET  /api/lawyers             - Get all lawyers`);
  console.log(`   GET  /api/lawyers/:id         - Get lawyer by ID`);
  console.log(`   GET  /api/cases               - Get cases`);
  console.log(`   POST /api/cases               - Create case`);
  console.log(`\n💡 Setup Instructions:`);
  console.log(`   1. Create PostgreSQL database: lawyerup`);
  console.log(`   2. Copy .env.example to .env and configure`);
  console.log(`   3. Run migrations: npm run db:migrate`);
  console.log(`   4. Seed demo data: npm run db:seed`);
  console.log(`\n✨ Ready to accept connections!\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, closing server...');
  await pool.end();
  process.exit(0);
});
