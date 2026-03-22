import pool from '../config/database.js';
import { createNotification } from './notifications.js';

export async function getAllCases(req, res) {
  try {
    const { status } = req.query;
    let query, params;

    if (req.user.role === 'lawyer') {
      query = `
        SELECT
          c.id, c.subject, c.description, c.category, c.status, c.priority,
          c.created_at, c.updated_at,
          u.id as user_id, u.full_name as user_name, u.email as user_email
        FROM cases c
        JOIN users u ON c.user_id = u.id
        WHERE c.lawyer_id = $1
      `;
      params = [req.user.id];
      if (status) { query += ' AND c.status = $2'; params.push(status); }
    } else {
      query = `
        SELECT
          c.id, c.subject, c.description, c.category, c.status, c.priority,
          c.created_at, c.updated_at,
          l.id as lawyer_id, l.full_name as lawyer_name
        FROM cases c
        LEFT JOIN users l ON c.lawyer_id = l.id
        WHERE c.user_id = $1
      `;
      params = [req.user.id];
      if (status) { query += ' AND c.status = $2'; params.push(status); }
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      cases: result.rows.map(c => ({
        id: c.id,
        subject: c.subject,
        description: c.description,
        category: c.category,
        status: c.status,
        priority: c.priority,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        ...(req.user.role === 'lawyer'
          ? { userName: c.user_name, userEmail: c.user_email }
          : { lawyerId: c.lawyer_id, lawyerName: c.lawyer_name ? `Maître ${c.lawyer_name}` : null }
        ),
      })),
    });
  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
}

export async function createCase(req, res) {
  try {
    const { subject, description, category, priority = 'medium' } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({ error: 'Subject, description, and category are required' });
    }

    const result = await pool.query(
      `INSERT INTO cases (user_id, subject, description, category, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, subject, description, category, priority]
    );

    res.status(201).json({ message: 'Case created successfully', case: result.rows[0] });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
}

export async function updateCaseStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'accepted', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE cases
       SET status = $1, lawyer_id = $2
       WHERE id = $3 AND (lawyer_id IS NULL OR lawyer_id = $2)
       RETURNING *`,
      [status, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found or already assigned' });
    }

    const caseRow = result.rows[0];
    const notifMeta = {
      accepted:  { type: 'case_accepted',  title: 'Case Accepted',  body: `Your case "${caseRow.subject}" has been accepted by a lawyer.` },
      rejected:  { type: 'case_rejected',  title: 'Case Rejected',  body: `Your case "${caseRow.subject}" has been declined.` },
      completed: { type: 'case_completed', title: 'Case Completed', body: `Your case "${caseRow.subject}" has been marked as completed.` },
      pending:   { type: 'case_pending',   title: 'Case Updated',   body: `Your case "${caseRow.subject}" status changed to pending.` },
    };
    const meta = notifMeta[status];
    if (meta) {
      await createNotification(pool, { userId: caseRow.user_id, ...meta, data: { caseId: caseRow.id } });
    }

    res.json({ message: 'Case status updated', case: result.rows[0] });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: 'Failed to update case' });
  }
}

export async function getCaseById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        c.*,
        u.full_name as user_name, u.email as user_email,
        l.full_name as lawyer_name
       FROM cases c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN users l ON c.lawyer_id = l.id
       WHERE c.id = $1 AND (c.user_id = $2 OR c.lawyer_id = $2)`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });

    res.json({ case: result.rows[0] });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
}
