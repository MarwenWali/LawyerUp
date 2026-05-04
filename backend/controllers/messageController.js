import pool from '../config/database.js';
import path from 'path';
import { supabaseAdmin, isSupabaseAdminConfigured } from '../config/supabase.js';
import { buildConversationShape, fetchConversationRow, normalizeRoleLabel } from './conversationController.js';

// ── Supabase Storage bucket name ─────────────────────────────────────────────
const BUCKET = 'chat-attachments';

/**
 * Ensure the Supabase Storage bucket exists (called lazily on first upload).
 * Uses upsert semantics — safe to call multiple times.
 */
let bucketEnsured = false;
async function ensureBucket() {
  if (bucketEnsured || !isSupabaseAdminConfigured) return;
  try {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
      ],
      fileSizeLimit: 10485760, // 10 MB
    });
    // 'already exists' is not an error — just continue
    if (error && !error.message?.includes('already exists')) {
      console.warn('[Storage] Could not create bucket:', error.message);
    } else {
      bucketEnsured = true;
    }
  } catch (e) {
    console.warn('[Storage] ensureBucket error:', e.message);
  }
}

/**
 * Upload a file buffer to Supabase Storage and return the permanent public URL.
 * Falls back to null if Supabase is not configured (will cause 400 — no attachment).
 */
async function uploadToSupabase(buffer, originalname, mimetype) {
  await ensureBucket();
  const ext = path.extname(originalname) || '';
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const storagePath = `messages/${unique}${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;  // permanent public Supabase CDN URL
}

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
    // Attachment fields
    message_type: row.message_type || 'text',
    attachment_url: row.attachment_url || null,
    attachment_name: row.attachment_name || null,
    attachment_type: row.attachment_type || null,
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
  // Attachment fields (optional)
  attachmentUrl = null,
  attachmentName = null,
  attachmentType = null,
}) {
  const conversation = await ensureConversationAccess(conversationId, senderId);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.status = 404;
    throw error;
  }

  const sanitizedContent = sanitizeMessageContent(content);
  const hasAttachment = Boolean(attachmentUrl);

  // Require either text content or an attachment
  if (!sanitizedContent && !hasAttachment) {
    const error = new Error('Message content or attachment is required');
    error.status = 400;
    throw error;
  }

  if (sanitizedContent.length > 5000) {
    const error = new Error('Message content is too long');
    error.status = 400;
    throw error;
  }

  const messageType = hasAttachment
    ? (attachmentType && attachmentType.startsWith('image/') ? 'image' : 'file')
    : 'text';

  const insertResult = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, is_read, message_type, attachment_url, attachment_name, attachment_type)
     VALUES ($1, $2, $3, FALSE, $4, $5, $6, $7)
     RETURNING id, conversation_id, sender_id, content, is_read, created_at, message_type, attachment_url, attachment_name, attachment_type`,
    [
      conversation.id,
      senderId,
      sanitizedContent || '',
      messageType,
      attachmentUrl,
      attachmentName,
      attachmentType,
    ]
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
    // Attachment fields
    message_type: row.message_type || 'text',
    attachment_url: row.attachment_url || null,
    attachment_name: row.attachment_name || null,
    attachment_type: row.attachment_type || null,
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
          last_message_preview: row.content || (hasAttachment ? '📎 Attachment' : ''),
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
    if (!['citizen', 'lawyer', 'admin'].includes(currentRole)) {
      return res.status(403).json({ error: 'Only citizens, lawyers, and admins can view messages' });
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
           m.message_type,
           m.attachment_url,
           m.attachment_name,
           m.attachment_type,
           u.full_name AS sender_name,
           u.role AS sender_role,
           u.profile_photo_url AS sender_photo
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at ASC, m.id ASC
         LIMIT $2 OFFSET $3`,
        [conversation.id, limit, offset]
      ),
    ]);

    const total = countResult.rows[0]?.total || 0;
    const messages = messagesResult.rows.map((row) => buildMessageShape(row, req.user.id));

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
    if (!['citizen', 'lawyer', 'admin'].includes(currentRole)) {
      return res.status(403).json({ error: 'Only citizens, lawyers, and admins can send messages' });
    }

    const io = req.app.get('io');

    // Handle file attachment if present
    let attachmentUrl = null;
    let attachmentName = null;
    let attachmentType = null;

    if (req.file) {
      // Upload to Supabase Storage → permanent public URL (no localhost dependency)
      attachmentUrl = await uploadToSupabase(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      attachmentName = req.file.originalname;
      attachmentType = req.file.mimetype;
    }

    const message = await createConversationMessage({
      conversationId: req.params.id,
      senderId: req.user.id,
      content: req.body?.content || '',
      clientMessageId: req.body?.clientMessageId || req.body?.client_message_id || null,
      io,
      attachmentUrl,
      attachmentName,
      attachmentType,
    });

    return res.status(201).json({ message });
  } catch (error) {
    console.error('sendConversationMessage error:', error);
    const status = error.status || 500;
    const message = error.message || 'Failed to send message';
    return res.status(status).json({ error: message, details: error.message });
  }
}

export { buildMessageShape, ensureConversationAccess, sanitizeMessageContent };
