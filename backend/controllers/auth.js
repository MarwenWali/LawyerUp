import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import pool from '../config/database.js';

export async function register(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, phoneNumber, role, specialization, bio, experienceYears } = req.body;

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isVerified = role !== 'lawyer';
    const initialStatus = role === 'lawyer' ? 'pending' : 'active';

    const userResult = await pool.query(
      `INSERT INTO users (email, password, full_name, phone_number, role, is_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, role`,
      [email, hashedPassword, fullName, phoneNumber, role, isVerified, initialStatus]
    );

    const user = userResult.rows[0];

    if (role === 'lawyer') {
      const diplomaUrl = req.file ? `/uploads/${req.file.filename}` : null;
      await pool.query(
        `INSERT INTO lawyer_profiles (user_id, specialization, bio, diploma_url, experience_years)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, specialization || 'General', bio || '', diplomaUrl, parseInt(experienceYears) || 0]
      );
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Registration successful',
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
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
      'SELECT id, email, password, full_name, role, is_verified, profile_photo_url FROM users WHERE email = $1',
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

    if (!user.is_verified && user.role === 'lawyer') {
      return res.status(403).json({ error: 'Account pending verification' });
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
      'SELECT id, email, full_name AS name, role, profile_photo_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    res.json({ user: userResult.rows[0] });
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}
