import { api } from '@/services/api';

export const messageService = {
  startConversation: ({ participantId, lawyerId, citizenId } = {}) =>
    api.post('/api/conversations', {
      participantId,
      lawyerId,
      citizenId,
    }),

  getConversations: () => api.get('/api/conversations'),

  getMessages: (conversationId, { page = 1, limit = 30 } = {}) =>
    api.get(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`),

  sendMessage: (conversationId, content, clientMessageId = null) =>
    api.post(`/api/conversations/${conversationId}/messages`, {
      content,
      clientMessageId,
    }),

  markConversationRead: (conversationId) =>
    api.patch(`/api/conversations/${conversationId}/read`, {}),
};
