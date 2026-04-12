<<<<<<< HEAD
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import { initializeSocket } from './socket/socketHandler.js';

// Import database
import pool from './config/database.js';
import {
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
} from './config/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

// Middleware
const allowedOrigins = [
  'http://localhost:8080', // Admin dashboard
  'http://localhost:5173', // Vite alternative port
  'http://localhost:3000',
  'http://localhost:19006', // Expo web
  'http://localhost:8081', // Expo Metro
];

const isAllowedOrigin = (origin) => (
  !origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost')
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an origin header (mobile apps, curl, Postman)
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  },
});

app.set('io', io);
initializeSocket(io);

// Serve static files (uploads)
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
const server = httpServer.listen(PORT, () => {
  console.log('\nLawyerUp backend server is running');
  console.log(`Port: ${PORT}`);
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
  console.log('\nReady to accept connections.\n');
});

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

// Trigger nodemon restart

// Restart for conversationController 
=======
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../admin-dashboard/.env') });

const app = express();
const PORT = 3001;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../admin-dashboard/public')));

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const toLawyerPayload = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  role: 'lawyer',
  status: row.status,
  specialization: row.specialization,
  experience: row.experience_years,
  fees: row.fees,
  rating: row.rating,
  totalReviews: row.total_reviews,
  licenseNumber: row.license_number,
  barAssociation: row.bar_association,
  bio: row.bio,
  profileImageUrl: row.profile_image_url,
  submittedAt: row.created_at,
  approvedAt: row.approved_at,
  rejectedAt: row.rejected_at,
  approvedBy: row.approved_by
});

const toCitizenPayload = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Sign Up
app.post('/api/signup', wrap(async (req, res) => {
  const { name, email, phone, type, specialization, diploma } = req.body;

  if (!name || !email || !type) {
    return res.status(400).json({ error: 'name, email, and type are required' });
  }

  const existing = await pool.query(
    `SELECT 1 FROM (
       SELECT email FROM citizens WHERE email = $1
       UNION ALL
       SELECT email FROM lawyers WHERE email = $1
     ) AS emails
     LIMIT 1`,
    [email]
  );

  if (existing.rows.length) {
    return res.status(400).json({ error: 'User already exists' });
  }

  if (type === 'lawyer') {
    const specializationArray = Array.isArray(specialization)
      ? specialization
      : [specialization || 'General'];

    const result = await pool.query(
      `INSERT INTO lawyers
        (name, email, password_hash, phone, specialization, experience_years, status, profile_image_url, created_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, 'pending', $7, now())
       RETURNING *`,
      [name, email, 'placeholder', phone || null, specializationArray, null, diploma || null]
    );

    return res.json({ message: 'User created', user: toLawyerPayload(result.rows[0]) });
  }

  const citizenResult = await pool.query(
    `INSERT INTO citizens (name, email, password_hash, phone, created_at)
     VALUES ($1, $2, $3, $4, now())
     RETURNING *`,
    [name, email, 'placeholder', phone || null]
  );

  res.json({ message: 'User created', user: citizenResult.rows[0] });
}));

// Get all pending lawyer applications
app.get('/api/pending-lawyers', wrap(async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM lawyers WHERE status = $1 ORDER BY created_at DESC`,
    ['pending']
  );
  res.json(result.rows.map(toLawyerPayload));
}));

// Get all approved lawyers
app.get('/api/approved-lawyers', wrap(async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM lawyers WHERE status = $1 ORDER BY approved_at DESC NULLS LAST`,
    ['approved']
  );
  res.json(result.rows.map(toLawyerPayload));
}));

// Get all rejected lawyers
app.get('/api/rejected-lawyers', wrap(async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM lawyers WHERE status = $1 ORDER BY rejected_at DESC NULLS LAST`,
    ['rejected']
  );
  res.json(result.rows.map(toLawyerPayload));
}));

// Get dashboard statistics
app.get('/api/stats', wrap(async (req, res) => {
  const totalCitizens = await pool.query(`SELECT COUNT(*) FROM citizens`);
  const approvedLawyers = await pool.query(
    `SELECT COUNT(*) FROM lawyers WHERE status = $1`,
    ['approved']
  );
  const pendingApplications = await pool.query(
    `SELECT COUNT(*) FROM lawyers WHERE status = $1`,
    ['pending']
  );
  const rejectedApplications = await pool.query(
    `SELECT COUNT(*) FROM lawyers WHERE status = $1`,
    ['rejected']
  );

  const totalCitizensCount = Number(totalCitizens.rows[0].count);
  const approvedCount = Number(approvedLawyers.rows[0].count);
  const pendingCount = Number(pendingApplications.rows[0].count);
  const rejectedCount = Number(rejectedApplications.rows[0].count);

  res.json({
    totalCitizens: totalCitizensCount,
    totalLawyers: approvedCount,
    pendingApplications: pendingCount,
    rejectedApplications: rejectedCount,
    totalUsers: totalCitizensCount + approvedCount
  });
}));

// Approve a lawyer
app.post('/api/approve-lawyer/:id', wrap(async (req, res) => {
  const lawyerId = req.params.id;
  const { fees, rating, approved_by } = req.body || {};

  const result = await pool.query(
    `UPDATE lawyers
     SET status = 'approved',
         fees = COALESCE($2, fees),
         rating = COALESCE($3, rating),
         approved_at = now(),
         approved_by = $4
     WHERE id = $1
     RETURNING *`,
    [lawyerId, fees || null, rating || null, approved_by || null]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Lawyer not found' });
  }

  res.json({ message: 'Lawyer approved', lawyer: toLawyerPayload(result.rows[0]) });
}));

const { getAiResponse } = require('./ai_service');

// Chat with AI
app.post('/api/chat', wrap(async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const aiResponse = await getAiResponse(message);
  res.json(aiResponse);
}));

// Reject a lawyer
app.post('/api/reject-lawyer/:id', wrap(async (req, res) => {
  const lawyerId = req.params.id;

  const result = await pool.query(
    `UPDATE lawyers
     SET status = 'rejected',
         rejected_at = now()
     WHERE id = $1
     RETURNING *`,
    [lawyerId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Lawyer not found' });
  }

  res.json({ message: 'Lawyer rejected', lawyer: toLawyerPayload(result.rows[0]) });
}));

// CRUD: create lawyer
app.post('/api/lawyers', wrap(async (req, res) => {
  const {
    name,
    email,
    phone,
    specialization,
    experience,
    fees,
    rating,
    licenseNumber,
    barAssociation,
    bio,
    profileImageUrl,
    status
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const existing = await pool.query(`SELECT 1 FROM lawyers WHERE email = $1 LIMIT 1`, [email]);
  if (existing.rows.length) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const specializationArray = Array.isArray(specialization)
    ? specialization
    : [specialization || 'General'];

  const result = await pool.query(
    `INSERT INTO lawyers
      (name, email, password_hash, phone, specialization, experience_years, status, fees, rating, license_number, bar_association, bio, profile_image_url, created_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
     RETURNING *`,
    [
      name,
      email,
      'placeholder',
      phone || null,
      specializationArray,
      experience || null,
      status || 'pending',
      fees || null,
      rating || 0,
      licenseNumber || null,
      barAssociation || null,
      bio || null,
      profileImageUrl || null
    ]
  );

  res.status(201).json(toLawyerPayload(result.rows[0]));
}));

// CRUD: read lawyer
app.get('/api/lawyers/:id', wrap(async (req, res) => {
  const result = await pool.query(`SELECT * FROM lawyers WHERE id = $1`, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(toLawyerPayload(result.rows[0]));
}));

// CRUD: update lawyer
app.put('/api/lawyers/:id', wrap(async (req, res) => {
  const allowed = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    specialization: 'specialization',
    experience: 'experience_years',
    fees: 'fees',
    rating: 'rating',
    licenseNumber: 'license_number',
    barAssociation: 'bar_association',
    bio: 'bio',
    profileImageUrl: 'profile_image_url',
    status: 'status',
    approvedAt: 'approved_at',
    rejectedAt: 'rejected_at'
  };

  const keys = Object.keys(allowed).filter((k) =>
    Object.prototype.hasOwnProperty.call(req.body, k)
  );

  if (!keys.length) return res.status(400).json({ error: 'No fields to update' });

  const sets = [];
  const values = [];
  let idx = 1;

  for (const key of keys) {
    let value = req.body[key];
    if (key === 'specialization') {
      value = Array.isArray(value) ? value : [value || 'General'];
    }
    sets.push(`${allowed[key]} = $${idx}`);
    values.push(value);
    idx += 1;
  }

  values.push(req.params.id);

  const result = await pool.query(
    `UPDATE lawyers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`,
    values
  );

  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(toLawyerPayload(result.rows[0]));
}));

// CRUD: delete lawyer
app.delete('/api/lawyers/:id', wrap(async (req, res) => {
  const result = await pool.query(
    `DELETE FROM lawyers WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true, lawyer: toLawyerPayload(result.rows[0]) });
}));

// List citizens for admin review
app.get('/api/citizens', wrap(async (req, res) => {
  const result = await pool.query(`SELECT * FROM citizens ORDER BY created_at DESC`);
  res.json(result.rows.map(toCitizenPayload));
}));

// CRUD: create citizen
app.post('/api/citizens', wrap(async (req, res) => {
  const { name, email, phone, isActive } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const existing = await pool.query(
    `SELECT 1 FROM (
       SELECT email FROM citizens WHERE email = $1
       UNION ALL
       SELECT email FROM lawyers WHERE email = $1
     ) AS emails
     LIMIT 1`,
    [email]
  );
  if (existing.rows.length) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const result = await pool.query(
    `INSERT INTO citizens (name, email, password_hash, phone, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     RETURNING *`,
    [name, email, 'placeholder', phone || null, isActive !== undefined ? isActive : true]
  );

  res.status(201).json(toCitizenPayload(result.rows[0]));
}));

// CRUD: read citizen
app.get('/api/citizens/:id', wrap(async (req, res) => {
  const result = await pool.query(`SELECT * FROM citizens WHERE id = $1`, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(toCitizenPayload(result.rows[0]));
}));

// CRUD: update citizen
app.put('/api/citizens/:id', wrap(async (req, res) => {
  const allowed = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    isActive: 'is_active'
  };

  const keys = Object.keys(allowed).filter((k) =>
    Object.prototype.hasOwnProperty.call(req.body, k)
  );

  if (!keys.length) return res.status(400).json({ error: 'No fields to update' });

  const sets = [];
  const values = [];
  let idx = 1;

  for (const key of keys) {
    sets.push(`${allowed[key]} = $${idx}`);
    values.push(req.body[key]);
    idx += 1;
  }

  values.push(req.params.id);

  const result = await pool.query(
    `UPDATE citizens SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`,
    values
  );

  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(toCitizenPayload(result.rows[0]));
}));

// CRUD: delete citizen
app.delete('/api/citizens/:id', wrap(async (req, res) => {
  const result = await pool.query(
    `DELETE FROM citizens WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true, citizen: toCitizenPayload(result.rows[0]) });
}));

// Serve the HTML dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-dashboard/public', 'index.html'));
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Admin Dashboard running on http://localhost:${PORT}`);
});
>>>>>>> ac06b9d385fe69f171134b1ac0df934904a576d2
