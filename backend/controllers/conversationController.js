import pool from '../config/database.js';

let conversationsHasTypeColumnCache = null;

function isCitizenRole(role) {
  return role === 'citizen' || role === 'user';
}

function normalizeRoleLabel(role) {
  if (!role) return 'citizen';
  const normalized = String(role).toLowerCase();
  return normalized === 'user' ? 'citizen' : normalized;
}

function buildParticipant(userRow, extras = {}) {
  if (!userRow) return null;

  return {
    id: userRow.id,
    name: userRow.full_name,
    full_name: userRow.full_name,
    role: normalizeRoleLabel(userRow.role),
    profile_photo_url: userRow.profile_photo_url || null,
    initials: (userRow.full_name || '?')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    ...extras,
  };
}

function buildConversationShape(row) {
  const currentUserRole = normalizeRoleLabel(row.current_user_role);
  const currentIsLawyer = currentUserRole === 'lawyer';

  const citizen = buildParticipant(
    {
      id: row.citizen_id,
      full_name: row.citizen_name,
      role: row.citizen_role,
      profile_photo_url: row.citizen_photo,
    },
    {
      is_available: null,
      specialization: null,
    }
  );

  const lawyer = buildParticipant(
    {
      id: row.lawyer_id,
      full_name: row.lawyer_name,
      role: row.lawyer_role,
      profile_photo_url: row.lawyer_photo,
    },
    {
      specialization: row.lawyer_specialization || null,
      is_available: typeof row.lawyer_is_available === 'boolean' ? row.lawyer_is_available : null,
    }
  );

  const otherParticipant = currentIsLawyer ? citizen : lawyer;

  return {
    id: row.id,
    citizen_id: row.citizen_id,
    lawyer_id: row.lawyer_id,
    status: row.status,
    created_at: row.created_at,
    last_message_at: row.last_message_at,
    unread_count: Number(row.unread_count || 0),
    last_message: row.last_message_id
      ? {
        id: row.last_message_id,
        conversation_id: row.id,
        sender_id: row.last_message_sender_id,
        content: row.last_message_content,
        created_at: row.last_message_created_at,
      }
      : null,
    last_message_preview: row.last_message_preview || '',
    citizen,
    lawyer,
    other_participant: otherParticipant,
  };
}

function buildConversationQuery(whereClause) {
  return `
    SELECT
      c.id,
      c.citizen_id,
      c.lawyer_id,
      c.created_at,
      c.last_message_at,
      c.status,
      citizen.full_name AS citizen_name,
      citizen.role AS citizen_role,
      citizen.profile_photo_url AS citizen_photo,
      lawyer.full_name AS lawyer_name,
      lawyer.role AS lawyer_role,
      lawyer.profile_photo_url AS lawyer_photo,
      lp.specialization AS lawyer_specialization,
      lp.is_available AS lawyer_is_available,
      last_message.id AS last_message_id,
      last_message.sender_id AS last_message_sender_id,
      last_message.content AS last_message_content,
      last_message.created_at AS last_message_created_at,
      CASE
        WHEN last_message.message_type = 'image' THEN '📷 Photo'
        WHEN last_message.message_type = 'file'  THEN '📄 Document'
        WHEN last_message.content IS NULL THEN ''
        WHEN char_length(last_message.content) > 120 THEN left(last_message.content, 120) || '...'
        ELSE last_message.content
      END AS last_message_preview,
      COALESCE(unread.unread_count, 0)::int AS unread_count,
      $1::text AS current_user_role
    FROM conversations c
    JOIN users citizen ON citizen.id = c.citizen_id
    JOIN users lawyer ON lawyer.id = c.lawyer_id
    LEFT JOIN lawyer_profiles lp ON lp.user_id = lawyer.id
    LEFT JOIN LATERAL (
      SELECT m.id, m.sender_id, m.content, m.created_at, m.message_type, m.attachment_name
      FROM messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 1
    ) last_message ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS unread_count
      FROM messages m
      WHERE m.conversation_id = c.id
        AND m.sender_id <> $2
        AND m.is_read = FALSE
    ) unread ON true
    ${whereClause}
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.created_at DESC
  `;
}

async function fetchConversationRow(conversationId, userId, currentRole) {
  const { rows } = await pool.query(
    buildConversationQuery('WHERE c.id = $3 AND (c.citizen_id = $2 OR c.lawyer_id = $2)'),
    [normalizeRoleLabel(currentRole), userId, conversationId]
  );

  return rows[0] || null;
}

async function hasConversationTypeColumn() {
  if (typeof conversationsHasTypeColumnCache === 'boolean') {
    return conversationsHasTypeColumnCache;
  }

  try {
    const { rows } = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'conversations'
         AND column_name = 'type'
       LIMIT 1`
    );

    conversationsHasTypeColumnCache = rows.length > 0;
  } catch {
    conversationsHasTypeColumnCache = false;
  }

  return conversationsHasTypeColumnCache;
}

async function fetchConversationPair(citizenId, lawyerId, type, options = {}) {
  const hasTypeCol = typeof options.hasTypeCol === 'boolean'
    ? options.hasTypeCol
    : await hasConversationTypeColumn();

  // Match on type when supported, otherwise fall back to any pair.
  if (hasTypeCol && type) {
    const { rows } = await pool.query(
      'SELECT * FROM conversations WHERE citizen_id = $1 AND lawyer_id = $2 AND type = $3 LIMIT 1',
      [citizenId, lawyerId, type]
    );
    if (rows[0]) return rows[0];
  }
  const { rows } = await pool.query(
    'SELECT * FROM conversations WHERE citizen_id = $1 AND lawyer_id = $2 LIMIT 1',
    [citizenId, lawyerId]
  );
  return rows[0] || null;
}

export async function startConversation(req, res) {
  try {
    const currentRole = normalizeRoleLabel(req.user.role);
    if (!['citizen', 'lawyer', 'admin'].includes(currentRole)) {
      return res.status(403).json({ error: 'Only citizens, lawyers, and admins can start conversations' });
    }

    const participantId =
      req.body.participantId ||
      req.body.participant_id ||
      req.body.lawyerId ||
      req.body.lawyer_id ||
      req.body.citizenId ||
      req.body.citizen_id;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }

    if (participantId === req.user.id) {
      return res.status(400).json({ error: 'You cannot start a conversation with yourself' });
    }

    const targetResult = await pool.query(
      'SELECT id, full_name, role FROM users WHERE id = $1 LIMIT 1',
      [participantId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = targetResult.rows[0];
    const targetRole = normalizeRoleLabel(targetUser.role);

    if (currentRole === 'citizen' && targetRole !== 'lawyer') {
      return res.status(400).json({ error: 'Citizens can only start conversations with lawyers' });
    }

    if (currentRole === 'lawyer' && targetRole !== 'citizen' && targetRole !== 'admin') {
      return res.status(400).json({ error: 'Lawyers can only start conversations with citizens or admins' });
    }

    if (currentRole === 'admin' && targetRole !== 'lawyer') {
      return res.status(400).json({ error: 'Admins can only start conversations with lawyers' });
    }

    // Determine type: admin<->lawyer chats use 'admin_lawyer', citizen<->lawyer use 'lawyer_user'
    const convType = (currentRole === 'admin' || targetRole === 'admin') ? 'admin_lawyer' : 'lawyer_user';

    // In all conversation rows, lawyer_id must always be the lawyer participant.
    // citizen_id holds either a citizen user (lawyer_user) or an admin user (admin_lawyer).
    const isAdminConversation = convType === 'admin_lawyer';
    const citizenId = isAdminConversation
      ? (currentRole === 'admin' ? req.user.id : targetUser.id)
      : (currentRole === 'citizen' ? req.user.id : targetUser.id);
    const lawyerId = currentRole === 'lawyer' ? req.user.id : targetUser.id;

    if (citizenId === lawyerId) {
      return res.status(400).json({ error: 'Invalid conversation participants' });
    }

    const hasTypeCol = await hasConversationTypeColumn();
    const conversationTypeForLookup = hasTypeCol ? convType : null;

    let conversation = await fetchConversationPair(citizenId, lawyerId, conversationTypeForLookup, { hasTypeCol });
    const wasCreated = !conversation;

    if (!conversation) {
      const insertQuery = hasTypeCol
        ? `INSERT INTO conversations (citizen_id, lawyer_id, type)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING id, citizen_id, lawyer_id, status, created_at, last_message_at`
        : `INSERT INTO conversations (citizen_id, lawyer_id)
           VALUES ($1, $2)
           ON CONFLICT (citizen_id, lawyer_id) DO NOTHING
           RETURNING id, citizen_id, lawyer_id, status, created_at, last_message_at`;
      const insertParams = hasTypeCol ? [citizenId, lawyerId, convType] : [citizenId, lawyerId];

      const insertResult = await pool.query(insertQuery, insertParams);

      if (insertResult.rows.length > 0) {
        conversation = insertResult.rows[0];
      } else {
        conversation = await fetchConversationPair(citizenId, lawyerId, conversationTypeForLookup, { hasTypeCol });
      }
    }

    if (!conversation) {
      return res.status(500).json({ error: 'Failed to start conversation' });
    }

    const conversationRow = await fetchConversationRow(conversation.id, req.user.id, currentRole);
    const io = req.app.get('io');

    if (io && conversationRow) {
      const payload = { conversation: buildConversationShape(conversationRow) };
      io.to(`user:${citizenId}`).emit('conversation_updated', payload);
      io.to(`user:${lawyerId}`).emit('conversation_updated', payload);
    }

    return res.status(wasCreated ? 201 : 200).json({
      message: 'Conversation started successfully',
      conversation: conversationRow ? buildConversationShape(conversationRow) : null,
    });
  } catch (error) {
    console.error('startConversation error:', error);
    return res.status(500).json({ error: 'Failed to start conversation' });
  }
}

export async function listConversations(req, res) {
  try {
    const currentRole = normalizeRoleLabel(req.user.role);
    if (!['citizen', 'lawyer', 'admin'].includes(currentRole)) {
      return res.status(403).json({ error: 'Only citizens, lawyers, and admins can view conversations' });
    }

    const { rows } = await pool.query(
      buildConversationQuery('WHERE c.citizen_id = $2 OR c.lawyer_id = $2'),
      [normalizeRoleLabel(req.user.role), req.user.id]
    );

    return res.json({
      conversations: rows.map(buildConversationShape),
    });
  } catch (error) {
    console.error('listConversations error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}

export async function markConversationRead(req, res) {
  try {
    const currentRole = normalizeRoleLabel(req.user.role);
    if (!['citizen', 'lawyer', 'admin'].includes(currentRole)) {
      return res.status(403).json({ error: 'Only citizens, lawyers, and admins can mark conversations read' });
    }

    const conversationResult = await pool.query(
      'SELECT id, citizen_id, lawyer_id FROM conversations WHERE id = $1 AND (citizen_id = $2 OR lawyer_id = $2) LIMIT 1',
      [req.params.id, req.user.id]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = conversationResult.rows[0];
    const unreadResult = await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE conversation_id = $1
         AND sender_id <> $2
         AND is_read = FALSE
       RETURNING id, sender_id, created_at`,
      [conversation.id, req.user.id]
    );

    const updatedCount = unreadResult.rowCount || 0;
    const io = req.app.get('io');

    if (updatedCount > 0 && io) {
      const readPayload = {
        conversationId: conversation.id,
        readerId: req.user.id,
        messageIds: unreadResult.rows.map((row) => row.id),
        readAt: new Date().toISOString(),
      };

      io.to(`conversation:${conversation.id}`).emit('message_read', readPayload);
      io.to(`user:${conversation.citizen_id}`).emit('conversation_read', readPayload);
      io.to(`user:${conversation.lawyer_id}`).emit('conversation_read', readPayload);
    }

    return res.json({
      message: 'Conversation marked as read',
      updatedCount,
    });
  } catch (error) {
    console.error('markConversationRead error:', error);
    return res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
}

export { buildConversationShape, fetchConversationRow, isCitizenRole, normalizeRoleLabel };
