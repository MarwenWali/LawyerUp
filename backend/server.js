import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';

// Import routes
import authRoutes from './routes/auth.js';
import lawyersRoutes from './routes/lawyers.js';
import casesRoutes from './routes/cases.js';
import usersRoutes from './routes/users.js';
import contactsRoutes from './routes/contacts.js';
import reviewsRoutes from './routes/reviews.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import conversationsRoutes from './routes/conversations.js';
import notificationsRoutes from './routes/notifications.js';
import aiRoutes from './routes/ai.js';
import { initializeSocket } from './socket/socketHandler.js';

// Import database
import pool from './config/database.js';
import {
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
} from './config/supabase.js';

// dotenv.config(); // Moved to top

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

// Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(
  cors({
    origin: true, // Allow all origins in development for mobile/network testing
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.set('io', io);
initializeSocket(io);

// Serve static files (uploads) — includes /uploads/messages for chat attachments
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      supabase: {
        urlConfigured: Boolean(process.env.SUPABASE_URL),
        publishableConfigured: isSupabaseConfigured,
        anonConfigured: isSupabaseConfigured,
        serviceRoleConfigured: isSupabaseAdminConfigured,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
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
app.use('/api/conversations', conversationsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/ai', aiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Diploma file is too large. Maximum size is 5MB.',
      });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err?.message?.includes('Only JPEG, PNG, HEIC/HEIF, WEBP images and PDF files are allowed')) {
    return res.status(400).json({ error: err.message });
  }

  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\nLawyerUp backend server is running');
  console.log(`Port: ${PORT}`);
  console.log(`Host: 0.0.0.0 (Accepting all network connections)`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\nAPI endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/auth/register');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/auth/verify');
  console.log('  GET  /api/lawyers');
  console.log('  GET  /api/lawyers/:id');
  console.log('  GET  /api/cases');
  console.log('  POST /api/cases');
  console.log('  GET  /api/conversations');
  console.log('  POST /api/conversations');
  console.log('  POST /api/ai/chat          (AI legal assistant proxy)');
  console.log('  GET  /api/ai/health        (AI engine health check)');
  console.log('\nReady to accept connections.\n');
});

// Increase timeouts for long-running AI requests
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in .env.`);
  } else {
    console.error('Server startup error:', err);
  }
  process.exit(1);
});

async function shutdown(signal) {
  console.log(`\n${signal} received, closing server...`);
  server.close(async () => {
    io.close();
    await pool.end();
    process.exit(0);
  });

  // Force exit if close hangs
  setTimeout(() => process.exit(1), 10000).unref();
}

// Graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
