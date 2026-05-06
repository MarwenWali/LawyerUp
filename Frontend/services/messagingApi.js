import { api } from '@/services/api';

export const messagingApi = {
  getFirstAdminUser: async () => {
    const data = await api.get('/api/users/admin');
    if (!data?.id) {
      throw new Error('No admin account found');
    }
    return data;
  },

  createConversation: (typeOrTargetUserId, maybeTargetUserId) => {
    const targetUserId = maybeTargetUserId || typeOrTargetUserId;
    return api.post('/api/conversations', {
      participantId: targetUserId,
    });
  },

  listConversations: () =>
    api.get('/api/conversations'),

  listMessages: (conversationId, { page = 1, limit = 30 } = {}) =>
    api.get(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`),

  sendMessage: ({ conversationId, content, clientMessageId = null }) =>
    api.post(`/api/conversations/${conversationId}/messages`, {
      content,
      clientMessageId,
    }),

  markConversationRead: (conversationId) =>
    api.patch(`/api/conversations/${conversationId}/read`, {}),
};
