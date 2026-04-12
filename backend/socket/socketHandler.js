import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { createConversationMessage } from '../controllers/messageController.js';

const onlineUsers = new Map();

function getTokenFromSocket(socket) {
  const authHeader = socket.handshake.headers.authorization || socket.handshake.auth?.token || socket.handshake.auth?.authorization;

  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return authHeader;
}

async function loadSocketUser(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const { rows } = await pool.query(
    'SELECT id, email, full_name, role, profile_photo_url FROM users WHERE id = $1 LIMIT 1',
    [decoded.userId]
  );

  if (rows.length === 0) {
    throw new Error('Invalid token');
  }

  return rows[0];
}

function markOnline(io, userId) {
  const currentCount = onlineUsers.get(userId) || 0;
  onlineUsers.set(userId, currentCount + 1);

  if (currentCount === 0) {
    io.emit('user_online', {
      userId,
      isOnline: true,
      online: true,
    });
  }
}

function markOffline(io, userId) {
  const currentCount = onlineUsers.get(userId) || 0;

  if (currentCount <= 1) {
    onlineUsers.delete(userId);
    io.emit('user_online', {
      userId,
      isOnline: false,
      online: false,
    });
    return;
  }

  onlineUsers.set(userId, currentCount - 1);
}

async function canJoinConversation(conversationId, userId) {
  const { rows } = await pool.query(
    'SELECT id FROM conversations WHERE id = $1 AND (citizen_id = $2 OR lawyer_id = $2) LIMIT 1',
    [conversationId, userId]
  );

  return rows.length > 0;
}

export function initializeSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const user = await loadSocketUser(token);
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error(error.message || 'Invalid socket authentication'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(`user:${userId}`);
    markOnline(io, userId);

    socket.on('join_conversation', async (payload, ack) => {
      try {
        const conversationId = String(payload?.conversationId || payload?.conversation_id || '');
        if (!conversationId) {
          throw new Error('conversationId is required');
        }

        const allowed = await canJoinConversation(conversationId, userId);
        if (!allowed) {
          throw new Error('Conversation not found');
        }

        socket.join(`conversation:${conversationId}`);

        if (typeof ack === 'function') {
          ack({ success: true, conversationId });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ error: error.message || 'Failed to join conversation' });
        }
      }
    });

    socket.on('send_message', async (payload, ack) => {
      try {
        const conversationId = String(payload?.conversationId || payload?.conversation_id || '');
        const content = payload?.content ?? '';

        if (!conversationId) {
          throw new Error('conversationId is required');
        }

        const message = await createConversationMessage({
          conversationId,
          senderId: userId,
          content,
          clientMessageId: payload?.clientMessageId || payload?.client_message_id || null,
          io,
        });

        if (typeof ack === 'function') {
          ack({ success: true, message });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ error: error.message || 'Failed to send message' });
        }
      }
    });

    const emitTyping = async (payload, isTyping) => {
      const conversationId = String(payload?.conversationId || payload?.conversation_id || '');
      if (!conversationId) return;

      const allowed = await canJoinConversation(conversationId, userId);
      if (!allowed) return;

      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        isTyping,
      });
    };

    socket.on('typing', (payload) => {
      emitTyping(payload, true).catch(() => {});
    });

    socket.on('stop_typing', (payload) => {
      emitTyping(payload, false).catch(() => {});
    });

    socket.on('disconnect', () => {
      markOffline(io, userId);
    });
  });
}
