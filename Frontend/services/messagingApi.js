import { api } from '@/services/api';

export const messagingApi = {
  getFirstAdminUser: async () => {
    const data = await api.get('/api/users/admin');
    if (!data?.id) {
      throw new Error('No admin account found');
    }
    return data;
  },

  createConversation: (type, targetUserId) =>
    api.post('/api/conversations', {
      participantId: targetUserId,
    }),

  listConversations: (type) =>
    api.get(type
      ? `/api/conversations?type=${encodeURIComponent(type)}`
      : '/api/conversations'),

  listMessages: (conversationId, { limit = 30, before } = {}) =>
    api.get(`/api/conversations/${conversationId}/messages?limit=${limit}`),

  sendMessage: ({ conversationId, content }) =>
    api.post(`/api/conversations/${conversationId}/messages`, {
      content,
    }),

  sendMessageWithAttachment: ({ conversationId, content, attachment }) => {
    const formData = new FormData();
    if (content) formData.append('content', content);
    formData.append('attachment', attachment);

    return api.post(`/api/conversations/${conversationId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  markConversationRead: (conversationId) =>
    api.patch(`/api/conversations/${conversationId}/read`, {}),
};
