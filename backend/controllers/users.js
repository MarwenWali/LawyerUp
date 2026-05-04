import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { syncSupabasePasswordForPublicUser } from '../services/supabaseAuthBridge.js';

function getPaginationParams(query, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name AS name, u.phone_number, u.role, u.is_verified, u.status, u.created_at,
              u.profile_photo_url,
              lp.specialization, lp.bio, lp.experience_years, lp.rating,
              lp.cases_handled, lp.is_available, lp.consultation_fee, lp.office_address, lp.bar_number
       FROM users u
       LEFT JOIN lawyer_profiles lp ON u.id = lp.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

export async function updateMe(req, res) {
  try {
    const { full_name, phone_number, bio, specialization, experience_years } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;
    if (full_name !== undefined)   { updates.push(`full_name = $${idx++}`);    params.push(full_name); }
    if (phone_number !== undefined) { updates.push(`phone_number = $${idx++}`); params.push(phone_number); }
    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(req.user.id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    }

    if (req.user.role === 'lawyer' && (bio !== undefined || specialization !== undefined || experience_years !== undefined)) {
      const lpUpdates = [];
      const lpParams = [];
      let lpIdx = 1;
      if (bio !== undefined)              { lpUpdates.push(`bio = $${lpIdx++}`);               lpParams.push(bio); }
      if (specialization !== undefined)   { lpUpdates.push(`specialization = $${lpIdx++}`);   lpParams.push(specialization); }
      if (experience_years !== undefined) { lpUpdates.push(`experience_years = $${lpIdx++}`); lpParams.push(experience_years); }
      lpParams.push(req.user.id);
      await pool.query(
        `UPDATE lawyer_profiles SET ${lpUpdates.join(', ')} WHERE user_id = $${lpIdx}`,
        lpParams
      );
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name AS name, u.phone_number, u.role, u.is_verified, u.status,
              u.profile_photo_url,
              lp.specialization, lp.bio, lp.experience_years, lp.rating, lp.is_available
       FROM users u
       LEFT JOIN lawyer_profiles lp ON u.id = lp.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changePassword(req, res) {
  let client;

  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const r = await client.query(
      'SELECT id, email, full_name, role, password FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );
    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const match = await bcrypt.compare(currentPassword, r.rows[0].password);
    if (!match) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await client.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashed, req.user.id]
    );

    await syncSupabasePasswordForPublicUser({
      publicUserId: r.rows[0].id,
      email: r.rows[0].email,
      role: r.rows[0].role,
      fullName: r.rows[0].full_name,
      password: newPassword,
      db: client,
    });

    await client.query('COMMIT');
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  } finally {
    client?.release();
  }
}

export async function uploadPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
    const photoUrl = `/uploads/${req.file.filename}`;
    await pool.query(
      'UPDATE users SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [photoUrl, req.user.id]
    );
    res.json({ message: 'Photo updated successfully', profile_photo_url: photoUrl });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
}

export async function getAllUsers(req, res) {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);

    const [countResult, result] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query(
        `SELECT
          u.id, u.email, u.full_name, u.phone_number, u.role, u.is_verified, u.created_at, u.updated_at,
          lp.specialization, lp.experience_years, lp.rating, lp.cases_handled, lp.is_available, lp.diploma_url
        FROM users u
        LEFT JOIN lawyer_profiles lp ON u.id = lp.user_id
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const users = result.rows.map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone_number: user.phone_number,
      role: user.role,
      is_verified: user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      specialization: user.specialization,
      experience_years: user.experience_years,
      rating: user.rating,
      cases_handled: user.cases_handled,
      is_available: user.is_available,
      diploma_url: user.diploma_url,
    }));

    const total = parseInt(countResult.rows[0].count, 10);
    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.full_name, u.phone_number, u.role, u.is_verified, u.created_at, u.updated_at,
        lp.specialization, lp.experience_years, lp.rating, lp.cases_handled, lp.is_available, lp.diploma_url
      FROM users u
      LEFT JOIN lawyer_profiles lp ON u.id = lp.user_id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone_number: user.phone_number,
      role: user.role,
      is_verified: user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      specialization: user.specialization,
      experience_years: user.experience_years,
      rating: user.rating,
      cases_handled: user.cases_handled,
      is_available: user.is_available,
      diploma_url: user.diploma_url,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { full_name, phone_number, role, is_verified, specialization } = req.body;

    const userUpdates = [];
    const userParams = [];
    let paramCount = 1;

    if (full_name !== undefined)   { userUpdates.push(`full_name = $${paramCount++}`);    userParams.push(full_name); }
    if (phone_number !== undefined) { userUpdates.push(`phone_number = $${paramCount++}`); userParams.push(phone_number); }
    if (role !== undefined)         { userUpdates.push(`role = $${paramCount++}`);         userParams.push(role); }
    if (is_verified !== undefined)  { userUpdates.push(`is_verified = $${paramCount++}`);  userParams.push(is_verified); }

    if (userUpdates.length > 0) {
      userUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
      userParams.push(id);
      await pool.query(
        `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${paramCount}`,
        userParams
      );
    }

    if (role === 'lawyer' && specialization !== undefined) {
      await pool.query(
        `UPDATE lawyer_profiles SET specialization = $1 WHERE user_id = $2`,
        [specialization, id]
      );
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

export async function getFirstAdmin(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No admin account found' });
    const admin = result.rows[0];
    res.json({ id: admin.id, full_name: admin.full_name, email: admin.email });
  } catch (error) {
    console.error('getFirstAdmin error:', error);
    res.status(500).json({ error: 'Failed to fetch admin user' });
  }
}

export async function getVaultFiles(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         m.id,
         m.message_type,
         m.attachment_name,
         m.attachment_url,
         m.created_at,
         'lawyer' AS source,
         u.full_name AS receiver_name
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       JOIN users u ON ((c.lawyer_id = u.id AND c.citizen_id = $1) OR (c.citizen_id = u.id AND c.lawyer_id = $1)) AND u.id != $1
       WHERE m.sender_id = $1 AND m.message_type IN ('file', 'image') AND m.attachment_url IS NOT NULL
       
       UNION ALL
       
       SELECT
         cm.id,
         cm.message_type,
         cm.attachment_name,
         cm.attachment_url,
         cm.created_at,
         'ai' AS source,
         'AI' AS receiver_name
       FROM chat_messages cm
       JOIN chat_sessions cs ON cm.session_id = cs.id
       WHERE cs.user_id = $1 AND cm.sender = 'user' AND cm.message_type IN ('file', 'image') AND cm.attachment_url IS NOT NULL
       
       UNION ALL
       
       SELECT
         vf.id,
         CASE WHEN vf.file_type LIKE 'image/%' THEN 'image' ELSE 'file' END AS message_type,
         vf.file_name AS attachment_name,
         vf.file_url AS attachment_url,
         vf.created_at,
         'vault' AS source,
         NULL AS receiver_name
       FROM vault_files vf
       WHERE vf.user_id = $1
       
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ files: result.rows });
  } catch (error) {
    console.error('getVaultFiles error:', error);
    res.status(500).json({ error: 'Failed to fetch vault files' });
  }
}

import { uploadToSupabase } from './messageController.js';

export async function uploadVaultFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    const result = await pool.query(
      `INSERT INTO vault_files (user_id, file_name, file_url, file_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, req.file.originalname, fileUrl, req.file.mimetype]
    );
    res.status(201).json({ file: result.rows[0] });
  } catch (error) {
    console.error('uploadVaultFile error:', error);
    res.status(500).json({ error: 'Failed to upload vault file' });
  }
}
export async function getAppointments(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.*, u.full_name AS lawyer_name 
       FROM appointments a
       LEFT JOIN users u ON a.lawyer_id = u.id
       WHERE a.user_id = $1
       ORDER BY a.date ASC`,
      [req.user.id]
    );
    res.json({ appointments: result.rows });
  } catch (error) {
    console.error('getAppointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
}

export async function createAppointment(req, res) {
  try {
    const { title, type, date, location, lawyer_id } = req.body;
    const result = await pool.query(
      `INSERT INTO appointments (user_id, title, type, date, location, lawyer_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, title, type, date, location || null, lawyer_id || null]
    );
    res.status(201).json({ appointment: result.rows[0] });
  } catch (error) {
    console.error('createAppointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
}
