import pool from '../config/database.js';
import { createNotification } from './notifications.js';

export async function getContacts(req, res) {
  try {
    let query, params;

    if (req.user.role === 'lawyer') {
      query = `
        SELECT cr.*, u.full_name as requester_name, u.email as requester_email, u.phone_number as requester_phone
        FROM contact_requests cr
        JOIN users u ON cr.user_id = u.id
        WHERE cr.lawyer_id = $1
        ORDER BY cr.created_at DESC
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT cr.*, u.full_name as lawyer_name
        FROM contact_requests cr
        JOIN users u ON cr.lawyer_id = u.id
        WHERE cr.user_id = $1
        ORDER BY cr.created_at DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contact requests' });
  }
}

export async function createContact(req, res) {
  try {
    const { lawyerId, message } = req.body;

    if (!lawyerId || !message?.trim()) {
      return res.status(400).json({ error: 'Lawyer ID and message are required' });
    }

    const lawyerCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'lawyer' AND is_verified = true",
      [lawyerId]
    );
    if (lawyerCheck.rows.length === 0) return res.status(404).json({ error: 'Lawyer not found' });

    const result = await pool.query(
      `INSERT INTO contact_requests (user_id, lawyer_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, lawyerId, message.trim()]
    );

    const userResult = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [req.user.id]);
    const userName = userResult.rows[0]?.full_name || 'A user';
    await createNotification(pool, {
      userId: lawyerId,
      type: 'contact_request',
      title: 'New Contact Request',
      body: `${userName} has sent you a contact request.`,
      data: { contactRequestId: result.rows[0].id },
    });

    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact request' });
  }
}

export async function updateContact(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE contact_requests SET status = $1
       WHERE id = $2 AND lawyer_id = $3
       RETURNING *`,
      [status, id, req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact request not found' });

    const cr = result.rows[0];
    const lawyerResult = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [req.user.id]);
    const lawyerName = `Maître ${lawyerResult.rows[0]?.full_name?.replace(/^Ma[iî]tre\s+/i, '') || 'the lawyer'}`;
    await createNotification(pool, {
      userId: cr.user_id,
      type: status === 'accepted' ? 'contact_accepted' : 'contact_rejected',
      title: status === 'accepted' ? 'Contact Request Accepted' : 'Contact Request Rejected',
      body: status === 'accepted'
        ? `${lawyerName} accepted your contact request. You can now coordinate directly.`
        : `${lawyerName} has declined your contact request.`,
      data: { contactRequestId: cr.id },
    });

    res.json({ request: result.rows[0] });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact request' });
  }
}
