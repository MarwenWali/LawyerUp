import { getSupabaseAccessToken } from './storage.js';

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;

  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getFunctionsBaseUrl() {
  const token = getSupabaseAccessToken();
  if (!token) {
    throw new Error('Missing Supabase session. Sign out and sign in again.');
  }

  const payload = decodeJwtPayload(token);
  const iss = payload?.iss;
  if (!iss) {
    throw new Error('Invalid Supabase access token');
  }

  const hostname = new URL(iss).hostname;
  const projectRef = hostname.split('.')[0];
  return {
    token,
    base: `https://${projectRef}.functions.supabase.co`,
  };
}

async function request(path, { method = 'GET', body, query } = {}) {
  const { token, base } = getFunctionsBaseUrl();
  const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const qs = new URLSearchParams(query || {}).toString();
  const url = `${base}/${path}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(apikey ? { apikey } : {}),
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  if (!res.ok) {
    throw new Error(payload.error || `Messaging request failed (${res.status})`);
  }

  return payload;
}

export const messagingAPI = {
  listConversations: (type = 'admin_lawyer') =>
    request('conversations-list', { method: 'GET', query: { type } }),

  createConversation: (targetUserId) =>
    request('conversations-create', {
      method: 'POST',
      body: { type: 'admin_lawyer', target_user_id: targetUserId },
    }),

  listMessages: (conversationId, limit = 50) =>
    request('conversations-messages', {
      method: 'GET',
      query: { conversation_id: conversationId, limit },
    }),

  sendMessage: (conversationId, content) =>
    request('send-message', {
      method: 'POST',
      body: { conversation_id: conversationId, content },
    }),

  markRead: (conversationId) =>
    request('conversations-read', {
      method: 'POST',
      body: { conversation_id: conversationId },
    }),
};
