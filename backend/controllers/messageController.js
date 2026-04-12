import pool from '../config/database.js';
import { buildConversationShape, fetchConversationRow, normalizeRoleLabel } from './conversationController.js';

function sanitizeMessageContent(content) {
  if (typeof content !== 'string') return '';

  return content
    .normalize('NFKC')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function buildMessageShape(row, currentUserId) {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: row.content,
    is_read: row.is_read,
    created_at: row.created_at,
    sender: {
      id: row.sender_id,
      name: row.sender_name,
      full_name: row.sender_name,
      role: normalizeRoleLabel(row.sender_role),
      profile_photo_url: row.sender_photo || null,
    },
    is_own_message: row.sender_id === currentUserId,
  };
}

async function ensureConversationAccess(conversationId, userId) {
  const { rows } = await pool.query(
    'SELECT id, citizen_id, lawyer_id, status, created_at, last_message_at FROM conversations WHERE id = $1 AND (citizen_id = $2 OR lawyer_id = $2) LIMIT 1',
    [conversationId, userId]
  );

  return rows[0] || null;
}

export async function createConversationMessage({
  conversationId,
  senderId,
  content,
  clientMessageId = null,
  io = null,
}) {
  const conversation = await ensureConversationAccess(conversationId, senderId);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.status = 404;
    throw error;
  }

  const sanitizedContent = sanitizeMessageContent(content);
  if (!sanitizedContent) {
    const error = new Error('Message content is required');
    error.status = 400;
    throw error;
  }

  if (sanitizedContent.length > 5000) {
    const error = new Error('Message content is too long');
    error.status = 400;
    throw error;
  }

  const insertResult = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, is_read)
     VALUES ($1, $2, $3, FALSE)
     RETURNING id, conversation_id, sender_id, content, is_read, created_at`,
    [conversation.id, senderId, sanitizedContent]
  );

  await pool.query(
    `UPDATE conversations
     SET last_message_at = CURRENT_TIMESTAMP,
         status = 'active'
     WHERE id = $1`,
    [conversation.id]
  );

  const senderResult = await pool.query(
    'SELECT id, full_name, role, profile_photo_url FROM users WHERE id = $1 LIMIT 1',
    [senderId]
  );

  const sender = senderResult.rows[0];
  const row = insertResult.rows[0];
  const message = {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: row.content,
    is_read: row.is_read,
    created_at: row.created_at,
    client_message_id: clientMessageId,
    sender: sender
      ? {
          id: sender.id,
          name: sender.full_name,
          full_name: sender.full_name,
          role: normalizeRoleLabel(sender.role),
          profile_photo_url: sender.profile_photo_url || null,
        }
      : null,
  };

  if (io) {
    const senderRole = sender?.role || 'citizen';
    const payload = {
      conversationId: conversation.id,
      message,
      conversation: buildConversationShape(
        (await fetchConversationRow(conversation.id, senderId, senderRole)) || {
          id: conversation.id,
          citizen_id: conversation.citizen_id,
          lawyer_id: conversation.lawyer_id,
          status: conversation.status,
          created_at: conversation.created_at,
          last_message_at: new Date().toISOString(),
          citizen_name: '',
          citizen_role: 'citizen',
          citizen_photo: null,
          lawyer_name: '',
          lawyer_role: 'lawyer',
          lawyer_photo: null,
          lawyer_specialization: null,
          lawyer_is_available: null,
          unread_count: 0,
          current_user_role: senderRole,
          last_message_id: row.id,
          last_message_sender_id: row.sender_id,
          last_message_content: row.content,
          last_message_created_at: row.created_at,
          last_message_preview: row.content,
        }
      ),
    };

    io.to(`conversation:${conversation.id}`).emit('new_message', payload);
    io.to(`user:${conversation.citizen_id}`).emit('conversation_updated', payload);
    io.to(`user:${conversation.lawyer_id}`).emit('conversation_updated', payload);
  }

  return message;
}

export async function getConversationMessages(req, res) {
  try {
    const currentRole = normalizeRoleLabel(req.user.role);
    if (!['citizen', 'lawyer'].includes(currentRole)) {
      return res.status(403).json({ error: 'Only citizens and lawyers can view messages' });
    }

    const conversation = await ensureConversationAccess(req.params.id, req.user.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const offset = (page - 1) * limit;

    const [countResult, messagesResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM messages WHERE conversation_id = $1', [conversation.id]),
      pool.query(
        `SELECT
           m.id,
           m.conversation_id,
           m.sender_id,
           m.content,
           m.is_read,
           m.created_at,
           u.full_name AS sender_name,
           u.role AS sender_role,
           u.profile_photo_url AS sender_photo
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $2 OFFSET $3`,
        [conversation.id, limit, offset]
      ),
    ]);

    const total = countResult.rows[0]?.total || 0;
    const messages = messagesResult.rows
      .slice()
      .reverse()
      .map((row) => buildMessageShape(row, req.user.id));

    return res.json({
      conversation: buildConversationShape(
        (await fetchConversationRow(conversation.id, req.user.id, req.user.role)) || conversation
      ),
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasMore: offset + messagesResult.rows.length < total,
      },
    });
  } catch (error) {
    console.error('getConversationMessages error:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

export async function sendConversationMessage(req, res) {
  try {
    const currentRole = normalizeRoleLabel(req.user.role);
    if (!['citizen', 'lawyer'].includes(currentRole)) {
      return res.status(403).json({ error: 'Only citizens and lawyers can send messages' });
    }

    const io = req.app.get('io');
    const message = await createConversationMessage({
      conversationId: req.params.id,
      senderId: req.user.id,
      content: req.body?.content,
      clientMessageId: req.body?.clientMessageId || req.body?.client_message_id || null,
      io,
    });

    return res.status(201).json({ message });
  } catch (error) {
    const status = error.status || 500;
    console.error('sendConversationMessage error:', error);
    return res.status(status).json({ error: error.message || 'Failed to send message' });
  }
}

export { buildMessageShape, ensureConversationAccess, sanitizeMessageContent };
