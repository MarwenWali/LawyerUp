import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getToken } from '@/services/api';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
} from '@/src/services/socketService';
import { messageService } from '@/src/services/messageService';

const ChatContext = createContext(null);

function sortByDate(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.created_at || a.createdAt || 0).getTime();
    const bTime = new Date(b.created_at || b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function mergeUniqueByKey(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    map.set(keyFn(item), item);
  }
  return sortByDate([...map.values()]);
}

function normalizeConversation(conversation, currentUserId) {
  if (!conversation) return null;

  const normalized = { ...conversation };
  normalized.unread_count = Number(normalized.unread_count || 0);

  const citizen = normalized.citizen || null;
  const lawyer = normalized.lawyer || null;

  const resolveInitials = (participant) => (
    participant?.initials
      || (participant?.name || participant?.full_name || '?')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
  );

  if (citizen && lawyer) {
    const currentIsCitizen = String(currentUserId || '') === String(citizen.id || '');
    const currentIsLawyer = String(currentUserId || '') === String(lawyer.id || '');

    normalized.other_participant = currentIsCitizen
      ? {
          ...lawyer,
          initials: resolveInitials(lawyer),
        }
      : currentIsLawyer
        ? {
            ...citizen,
            initials: resolveInitials(citizen),
          }
        : normalized.other_participant
          ? {
              ...normalized.other_participant,
              initials: resolveInitials(normalized.other_participant),
            }
          : null;
  } else if (normalized.other_participant) {
    normalized.other_participant = {
      ...normalized.other_participant,
      initials: resolveInitials(normalized.other_participant),
    };
  }

  if (normalized.last_message && normalized.last_message.sender_id === currentUserId) {
    normalized.unread_count = Number(normalized.unread_count || 0);
  }

  return normalized;
}

function updateConversationPreview(conversation, message, currentUserId) {
  if (!conversation) {
    return {
      id: message.conversation_id,
      citizen_id: null,
      lawyer_id: null,
      created_at: message.created_at,
      last_message_at: message.created_at,
      status: 'active',
      unread_count: message.sender_id === currentUserId ? 0 : 1,
      last_message: message,
      last_message_preview: message.content,
      other_participant: null,
    };
  }

  const nextUnread = message.sender_id === currentUserId
    ? Number(conversation.unread_count || 0)
    : Number(conversation.unread_count || 0) + 1;

  return normalizeConversation({
    ...conversation,
    last_message_at: message.created_at,
    last_message: message,
    last_message_preview: message.content,
    unread_count: nextUnread,
  }, currentUserId);
}

function updateMessages(messages, incoming) {
  const incomingList = Array.isArray(incoming) ? incoming : [incoming];
  return mergeUniqueByKey([...messages, ...incomingList], (item) => item.client_message_id || item.id);
}

export function ChatProvider({ children }) {
  const { user, isLoading } = useAuth();
  const socketRef = useRef(null);
  const currentUserIdRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [typingByConversation, setTypingByConversation] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastError, setLastError] = useState(null);

  const clearState = useCallback(() => {
    setConversations([]);
    setMessagesByConversation({});
    setTypingByConversation({});
    setOnlineUsers({});
    setLastError(null);
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!user?.id) return [];
    const payload = await messageService.getConversations();
    const next = Array.isArray(payload?.conversations) ? payload.conversations : [];
    setConversations(next.map((conversation) => normalizeConversation(conversation, user.id)));
    return next;
  }, [user?.id]);

  const setConversationMessages = useCallback((conversationId, nextMessages) => {
    if (!conversationId) return;
    
    setMessagesByConversation((prev) => {
      const currentMessages = prev[conversationId] || [];
      const sortedNextMessages = sortByDate(nextMessages || []);
      
      // State guard: prevent update if messages are identical
      const messagesAreIdentical = currentMessages.length === sortedNextMessages.length &&
        currentMessages.every((msg, index) => msg.id === sortedNextMessages[index]?.id);
      
      if (messagesAreIdentical) {
        return prev; // Return previous state to prevent re-render
      }
      
      return {
        ...prev,
        [conversationId]: sortedNextMessages,
      };
    });
  }, []);

  const clearConversationMessages = useCallback((conversationId) => {
    if (!conversationId) return;
    setMessagesByConversation((prev) => {
      const { [conversationId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllMessages = useCallback(() => {
    setMessagesByConversation({});
  }, []);

  const appendConversationMessages = useCallback((conversationId, incomingMessages) => {
    if (!conversationId) return;

    setMessagesByConversation((prev) => {
      const current = prev[conversationId] || [];
      return {
        ...prev,
        [conversationId]: updateMessages(current, incomingMessages || []),
      };
    });
  }, []);

  const replaceTemporaryMessage = useCallback((conversationId, clientMessageId, savedMessage) => {
    if (!conversationId || !clientMessageId || !savedMessage) return;

    setMessagesByConversation((prev) => {
      const current = prev[conversationId] || [];
      let changed = false;
      const next = current.map((item) => {
        if (item.client_message_id === clientMessageId) {
          changed = true;
          return savedMessage;
        }
        return item;
      });

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        [conversationId]: sortByDate(next),
      };
    });
  }, []);

  const removeTemporaryMessage = useCallback((conversationId, clientMessageId) => {
    if (!conversationId || !clientMessageId) return;

    setMessagesByConversation((prev) => {
      const current = prev[conversationId] || [];
      const next = current.filter((item) => item.client_message_id !== clientMessageId);

      if (next.length === current.length) {
        return prev;
      }

      return {
        ...prev,
        [conversationId]: next,
      };
    });
  }, []);

  const markConversationReadLocal = useCallback((conversationId, readerId, messageIds = []) => {
    if (!conversationId) return;

    setMessagesByConversation((prev) => {
      const current = prev[conversationId] || [];
      const idSet = new Set(messageIds.map(String));

      return {
        ...prev,
        [conversationId]: current.map((item) => {
          if (item.sender_id === readerId) return item;
          if (!messageIds.length || idSet.has(String(item.id))) {
            return { ...item, is_read: true };
          }
          return item;
        }),
      };
    });

    if (readerId === currentUserIdRef.current) {
      setConversations((prev) => prev.map((conversation) => (
        conversation.id === conversationId
          ? { ...conversation, unread_count: 0 }
          : conversation
      )));
    }
  }, []);

  const handleNewMessage = useCallback((payload) => {
    const conversationId = String(payload?.conversationId || payload?.conversation?.id || payload?.message?.conversation_id || '');
    const message = payload?.message;
    if (!conversationId || !message) return;

    if (payload?.conversation) {
      const incomingConversation = normalizeConversation(payload.conversation, currentUserIdRef.current);
      setConversations((prev) => {
        const exists = prev.some((item) => item.id === incomingConversation.id);
        const next = exists
          ? prev.map((item) => (item.id === incomingConversation.id ? incomingConversation : item))
          : [incomingConversation, ...prev];

        return next.sort((a, b) => {
          const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
          const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });
      });
    } else {
      setConversations((prev) => {
        const index = prev.findIndex((item) => item.id === conversationId);
        const current = index >= 0 ? prev[index] : null;
        const nextConversation = updateConversationPreview(current, message, currentUserIdRef.current);

        if (index >= 0) {
          const next = [...prev];
          next[index] = nextConversation;
          return next.sort((a, b) => {
            const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
            const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
            return bTime - aTime;
          });
        }

        return [nextConversation, ...prev];
      });
    }

    setMessagesByConversation((prev) => {
      const current = prev[conversationId] || [];

      if (message.client_message_id) {
        const replaced = current.map((item) => (
          item.client_message_id === message.client_message_id ? message : item
        ));
        if (replaced.some((item, index) => item !== current[index])) {
          return {
            ...prev,
            [conversationId]: sortByDate(replaced),
          };
        }
      }

      if (current.some((item) => item.id === message.id)) {
        return prev;
      }

      return {
        ...prev,
        [conversationId]: sortByDate([...current, message]),
      };
    });
  }, []);

  const handleConversationUpdated = useCallback((payload) => {
    const conversation = payload?.conversation;
    if (!conversation?.id) return;

    const conversationId = String(conversation.id);
    const message = payload?.message || null;
    const normalized = normalizeConversation(conversation, currentUserIdRef.current);
    setConversations((prev) => {
      const exists = prev.some((item) => item.id === normalized.id);
      const next = exists
        ? prev.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...prev];

      return next.sort((a, b) => {
        const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
        const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
    });

    if (!message) return;

    setMessagesByConversation((prev) => {
      const current = prev[conversationId] || [];
      if (current.some((item) => item.id === message.id)) {
        return prev;
      }

      return {
        ...prev,
        [conversationId]: sortByDate([...current, message]),
      };
    });
  }, []);

  const handleMessageRead = useCallback((payload) => {
    const conversationId = String(payload?.conversationId || '');
    if (!conversationId) return;
    markConversationReadLocal(conversationId, payload?.readerId, payload?.messageIds || []);
  }, [markConversationReadLocal]);

  const handleConversationRead = useCallback((payload) => {
    const conversationId = String(payload?.conversationId || '');
    if (!conversationId) return;
    markConversationReadLocal(conversationId, payload?.readerId, payload?.messageIds || []);
  }, [markConversationReadLocal]);

  const handleTyping = useCallback((payload) => {
    const conversationId = String(payload?.conversationId || '');
    if (!conversationId) return;

    setTypingByConversation((prev) => ({
      ...prev,
      [conversationId]: Boolean(payload?.isTyping),
    }));
  }, []);

  const handleOnlineStatus = useCallback((payload) => {
    const userId = String(payload?.userId || '');
    if (!userId) return;

    setOnlineUsers((prev) => ({
      ...prev,
      [userId]: Boolean(payload?.isOnline ?? payload?.online),
    }));
  }, []);

  useEffect(() => {
    currentUserIdRef.current = user?.id || null;

    if (isLoading) {
      return;
    }

    if (!user?.id) {
      disconnectSocket();
      socketRef.current = null;
      setConnectionStatus('disconnected');
      clearState();
      return;
    }

    let active = true;

    (async () => {
      try {
        const token = await getToken();
        if (!active || !token) {
          return;
        }

        const socket = connectSocket(token);
        socketRef.current = socket;
        setConnectionStatus(socket.connected ? 'connected' : 'connecting');
        setLastError(null);

        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('new_message');
        socket.off('conversation_updated');
        socket.off('message_read');
        socket.off('conversation_read');
        socket.off('user_typing');
        socket.off('user_online');

        socket.on('connect', () => setConnectionStatus('connected'));
        socket.on('disconnect', () => setConnectionStatus('disconnected'));
        socket.on('connect_error', (error) => {
          setConnectionStatus('error');
          setLastError(error?.message || 'Socket connection failed');
        });
        socket.on('new_message', handleNewMessage);
        socket.on('conversation_updated', handleConversationUpdated);
        socket.on('message_read', handleMessageRead);
        socket.on('conversation_read', handleConversationRead);
        socket.on('user_typing', handleTyping);
        socket.on('user_online', handleOnlineStatus);

        if (!socket.connected) {
          socket.connect();
        }

        refreshConversations().catch((error) => {
          setLastError(error?.message || 'Failed to load conversations');
        });
      } catch (error) {
        setConnectionStatus('error');
        setLastError(error?.message || 'Socket initialization failed');
      }
    })();

    return () => {
      active = false;
      disconnectSocket();
      socketRef.current = null;
    };
  }, [
    clearState,
    handleConversationRead,
    handleConversationUpdated,
    handleMessageRead,
    handleNewMessage,
    handleOnlineStatus,
    handleTyping,
    isLoading,
    refreshConversations,
    user?.id,
  ]);

  const joinConversation = useCallback((conversationId) => {
    const socket = socketRef.current || getSocket();
    if (!socket || !conversationId) {
      return Promise.resolve({ success: false });
    }

    return new Promise((resolve, reject) => {
      socket.emit('join_conversation', { conversationId }, (ack) => {
        if (ack?.error) {
          reject(new Error(ack.error));
          return;
        }
        resolve(ack || { success: true });
      });
    });
  }, []);

  const emitTyping = useCallback((conversationId, isTyping) => {
    const socket = socketRef.current || getSocket();
    if (!socket || !conversationId) return;

    socket.emit(isTyping ? 'typing' : 'stop_typing', {
      conversationId,
      conversation_id: conversationId,
    });
  }, []);

  const value = useMemo(() => ({
    socket: socketRef.current,
    connectionStatus,
    lastError,
    conversations,
    messagesByConversation,
    typingByConversation,
    onlineUsers,
    refreshConversations,
    setConversations,
    setConversationMessages,
    clearConversationMessages,
    clearAllMessages,
    appendConversationMessages,
    replaceTemporaryMessage,
    removeTemporaryMessage,
    markConversationReadLocal,
    joinConversation,
    emitTyping,
  }), [
    appendConversationMessages,
    clearAllMessages,
    clearConversationMessages,
    connectionStatus,
    conversations,
    emitTyping,
    joinConversation,
    lastError,
    markConversationReadLocal,
    messagesByConversation,
    onlineUsers,
    refreshConversations,
    removeTemporaryMessage,
    replaceTemporaryMessage,
    setConversationMessages,
    typingByConversation,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = React.useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
}
