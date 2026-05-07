import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import { validationResult } from 'express-validator';
import pool from '../config/database.js';
import {
  deleteSupabaseAuthUser,
  ensureSupabaseMessagingIdentity,
} from '../services/supabaseAuthBridge.js';

function toSupabaseSessionPayload(session) {
  if (!session) return null;

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user
      ? {
        id: session.user.id,
        email: session.user.email,
      }
      : null,
  };
}

function getAccountAccessError(user) {
  if (!user) return 'Invalid token';
  if (user.status === 'suspended') return 'Account suspended';
  if (user.status === 'rejected') return 'Account rejected';
  if (user.status === 'pending') {
    return user.role === 'lawyer' ? 'Account pending verification' : 'Account pending approval';
  }
  if (user.role === 'lawyer' && !user.is_verified) {
    return 'Account pending verification';
  }
  return null;
}

export async function register(req, res) {
  let client;
  let authUserForCleanup = null;

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, phoneNumber, role, specialization, bio, experienceYears } = req.body;
    client = await pool.connect();
    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    const isVerified = role !== 'lawyer';
    const initialStatus = role === 'lawyer' ? 'pending' : 'active';

    const userResult = await client.query(
      `INSERT INTO users (email, password, full_name, phone_number, role, is_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, role, is_verified, status`,
      [email, hashedPassword, fullName, phoneNumber, role, isVerified, initialStatus]
    );

    const user = userResult.rows[0];

    if (role === 'lawyer') {
      const diplomaUrl = req.file ? `/uploads/${req.file.filename}` : null;
      await client.query(
        `INSERT INTO lawyer_profiles (user_id, specialization, bio, diploma_url, experience_years)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, specialization || 'General', bio || '', diplomaUrl, parseInt(experienceYears) || 0]
      );
    }

    let bridgeResult = null;
    const bridgePassword = role === 'lawyer' ? undefined : password;
    try {
      bridgeResult = await ensureSupabaseMessagingIdentity({
        publicUserId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        password: bridgePassword,
        db: client,
      });
      if (bridgeResult?.createdAuthUser) {
        authUserForCleanup = bridgeResult.authUserId;
      }
    } catch (bridgeError) {
      console.warn('Supabase messaging integration failed during registration:', bridgeError.message);
    }

    await client.query('COMMIT');
    authUserForCleanup = null;

    // Send automatic welcome message to lawyers
    if (role === 'lawyer') {
      try {
        const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        if (adminResult.rows.length > 0) {
          const adminId = adminResult.rows[0].id;
          const typeColumnCheck = await pool.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'conversations'
               AND column_name = 'type'
             LIMIT 1`
          );
          const hasTypeCol = typeColumnCheck.rows.length > 0;

          const convInsertResult = hasTypeCol
            ? await pool.query(
              `INSERT INTO conversations (citizen_id, lawyer_id, type)
               VALUES ($1, $2, 'admin_lawyer')
               ON CONFLICT DO NOTHING
               RETURNING id`,
              [adminId, user.id]
            )
            : await pool.query(
              `INSERT INTO conversations (citizen_id, lawyer_id)
               VALUES ($1, $2)
               ON CONFLICT (citizen_id, lawyer_id) DO NOTHING
               RETURNING id`,
              [adminId, user.id]
            );

          let convId = convInsertResult.rows[0]?.id || null;
          if (!convId) {
            const existingConvResult = hasTypeCol
              ? await pool.query(
                `SELECT id
                 FROM conversations
                 WHERE citizen_id = $1 AND lawyer_id = $2 AND type = 'admin_lawyer'
                 LIMIT 1`,
                [adminId, user.id]
              )
              : await pool.query(
                `SELECT id
                 FROM conversations
                 WHERE citizen_id = $1 AND lawyer_id = $2
                 LIMIT 1`,
                [adminId, user.id]
              );
            convId = existingConvResult.rows[0]?.id || null;
          }

          if (convId) {
            await pool.query(
              `INSERT INTO messages (conversation_id, sender_id, content)
             VALUES ($1, $2, $3)`,
              [convId, adminId, 'Welcome to the team! If you have any questions just send a message.']
            );
          }
        }
      } catch (msgError) {
        console.error('Failed to send welcome message:', msgError);
      }
    }

    const shouldIssueToken = user.role !== 'lawyer' && user.is_verified && user.status === 'active';
    const response = {
      message: role === 'lawyer' ? 'Registration submitted for verification' : 'Registration successful',
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role },
    };

    if (shouldIssueToken) {
            response.token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );
      response.supabaseSession = toSupabaseSessionPayload(bridgeResult?.session);
    }

    res.status(201).json(response);
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Registration rollback error:', rollbackError);
      }
    }

    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch {
        // Best effort cleanup for uploaded files when registration fails.
      }
    }

    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (authUserForCleanup) {
      try {
        await deleteSupabaseAuthUser(authUserForCleanup);
      } catch (cleanupError) {
        console.error('Supabase auth cleanup error:', cleanupError);
      }
    }

    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client?.release();
  }
}

export async function login(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role } = req.body;

    const userResult = await pool.query(
      'SELECT id, email, password, full_name, role, is_verified, status, profile_photo_url FROM users WHERE email = $1',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (role && user.role !== role) {
      return res.status(401).json({ error: 'Invalid credentials for this role' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Account rejected' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({
        error: user.role === 'lawyer' ? 'Account pending verification' : 'Account pending approval',
      });
    }

    if (!user.is_verified && user.role === 'lawyer') {
      return res.status(403).json({ error: 'Account pending verification' });
    }

    let supabaseSession = null;

    try {
      const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase bridge timeout')), ms));

      const bridgePromise = ensureSupabaseMessagingIdentity({
        publicUserId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        password,
      });

      const bridgeResult = await Promise.race([bridgePromise, timeout(5000)]);
      supabaseSession = toSupabaseSessionPayload(bridgeResult?.session);
    } catch (bridgeError) {
      console.warn('Supabase messaging integration skipped or failed:', bridgeError.message);
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        profile_photo_url: user.profile_photo_url || null,
      },
      token,
      supabaseSession,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function verifyToken(req, res) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await pool.query(
      `SELECT id, email, full_name AS name, role, status, is_verified, profile_photo_url
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    const user = userResult.rows[0];
    const accountError = getAccountAccessError(user);
    if (accountError) {
      return res.status(403).json({ error: accountError });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile_photo_url: user.profile_photo_url || null,
      },
    });
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}
