import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

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

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      `SELECT id, email, full_name, role, status, is_verified
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    const accountError = getAccountAccessError(result.rows[0]);
    if (accountError) {
      return res.status(403).json({ error: accountError });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
