import pool from '../config/database.js';

function getPaginationParams(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function logActivity(userId, userName, action, details, type = 'info') {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, user_name, action, details, type)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, userName, action, details, type]
    );
  } catch (_) { /* non-blocking */ }
}

export async function getStats(req, res) {
  try {
    const [users, lawyers, casesMonth, pending, newUsers, pendingLawyers] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'user'"),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'lawyer' AND is_verified = true"),
      pool.query("SELECT COUNT(*) FROM cases WHERE created_at >= date_trunc('month', NOW())"),
      pool.query("SELECT COUNT(*) FROM cases WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('month', NOW())"),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'lawyer' AND is_verified = false"),
    ]);

    res.json({
      totalUsers: parseInt(users.rows[0].count),
      activeLawyers: parseInt(lawyers.rows[0].count),
      casesThisMonth: parseInt(casesMonth.rows[0].count),
      pendingCases: parseInt(pending.rows[0].count),
      newUsersThisMonth: parseInt(newUsers.rows[0].count),
      pendingLawyerVerifications: parseInt(pendingLawyers.rows[0].count),
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

export async function getLogs(req, res) {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const [countResult, result] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM activity_logs'),
      pool.query(
        'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    res.json({
      logs: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
}

export async function getUsers(req, res) {
  try {
    const { page, limit, offset } = getPaginationParams(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });

    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE role != 'admin'`),
      pool.query(
        `SELECT
          u.id, u.email, u.full_name, u.phone_number, u.role,
          u.is_verified, u.status, u.created_at,
          lp.specialization, lp.experience_years, lp.rating,
          lp.cases_handled, lp.is_available, lp.diploma_url
        FROM users u
        LEFT JOIN lawyer_profiles lp ON u.id = lp.user_id
        WHERE u.role != 'admin'
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE users SET status = $1 WHERE id = $2
       RETURNING id, email, full_name, role, status`,
      [status, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    await logActivity(
      req.user.id, req.user.full_name,
      status === 'suspended' ? 'Account Suspended' : 'Account Activated',
      `User ${user.full_name} was ${status === 'suspended' ? 'suspended' : 'activated'} by admin`,
      status === 'suspended' ? 'warning' : 'info'
    );

    res.json({ user });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    const userRes = await pool.query('SELECT full_name FROM users WHERE id = $1', [id]);
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    if (userRes.rows.length > 0) {
      await logActivity(
        req.user.id, req.user.full_name, 'User Deleted',
        `User ${userRes.rows[0].full_name} was deleted by admin`, 'warning'
      );
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

export async function verifyLawyer(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!['verify', 'reject', 'revoke'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use: verify, reject, or revoke' });
    }

    const isVerified = action === 'verify';
    const status =
      action === 'verify' ? 'active' :
      action === 'reject' ? 'rejected' :
      'pending';

    const result = await pool.query(
      `UPDATE users SET is_verified = $1, status = $2
       WHERE id = $3 AND role = 'lawyer'
       RETURNING id, email, full_name, is_verified, role, status`,
      [isVerified, status, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Lawyer not found' });

    const lawyer = result.rows[0];
    const actionLabels = { verify: 'Verified', reject: 'Rejected', revoke: 'Unverified' };
    await logActivity(
      req.user.id, req.user.full_name,
      `Lawyer ${actionLabels[action]}`,
      `Lawyer ${lawyer.full_name} was ${action}ed by admin`,
      action === 'reject' ? 'warning' : 'info'
    );

    res.json({ user: lawyer });
  } catch (error) {
    console.error('Verify lawyer error:', error);
    res.status(500).json({ error: 'Failed to update lawyer verification' });
  }
}
