import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '../lib/api.js';
import { messagingAPI } from '../lib/messagingApi.js';
import { useAuth } from '../hooks/useAuth.js';

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function shortId(value) {
  const raw = String(value || '');
  if (!raw) return '';
  return `${raw.slice(0, 8)}...`;
}

export default function Messages() {
  const { user: admin } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);

  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  const loadLawyers = useCallback(async () => {
    try {
      const data = await adminAPI.getUsers();
      const users = Array.isArray(data?.users) ? data.users : [];
      const onlyLawyers = users
        .filter((u) => u.role === 'lawyer')
        .map((u) => ({ id: u.id, name: u.full_name || u.email || u.id }));
      setLawyers(onlyLawyers);
      if (!selectedLawyerId && onlyLawyers[0]?.id) {
        setSelectedLawyerId(onlyLawyers[0].id);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load lawyers');
    }
  }, [selectedLawyerId]);

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    try {
      const payload = await messagingAPI.listConversations('admin_lawyer');
      const rows = Array.isArray(payload?.conversations) ? payload.conversations : [];
      setConversations(rows);
      if (!selectedConversationId && rows[0]?.id) {
        setSelectedConversationId(rows[0].id);
      }
    } catch (error) {
      if (!silent) {
        toast.error(error.message || 'Failed to load conversations');
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [selectedConversationId]);

  const loadMessages = useCallback(async (conversationId, { silent = false } = {}) => {
    if (!conversationId) {
      setMessages([]);
      setInitialMessagesLoaded(false);
      return;
    }

    if (!silent || !initialMessagesLoaded) {
      setLoadingMessages(true);
    }
    try {
      const payload = await messagingAPI.listMessages(conversationId, 50);
      const rows = Array.isArray(payload?.messages) ? payload.messages : [];
      const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setMessages(sorted);
      setInitialMessagesLoaded(true);
      await messagingAPI.markRead(conversationId);
    } catch (error) {
      if (!silent) {
        toast.error(error.message || 'Failed to load messages');
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [initialMessagesLoaded]);

  useEffect(() => {
    loadLawyers();
    loadConversations();
  }, [loadLawyers, loadConversations]);

  useEffect(() => {
    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversationId]);

  useEffect(() => {
    const id = setInterval(async () => {
      await loadConversations({ silent: true });
      if (selectedConversationId) {
        await loadMessages(selectedConversationId, { silent: true });
      }
    }, 6000);

    return () => clearInterval(id);
  }, [loadConversations, loadMessages, selectedConversationId]);

  async function handleCreateConversation() {
    if (!selectedLawyerId || creatingConversation) return;
    setCreatingConversation(true);

    try {
      const payload = await messagingAPI.createConversation(selectedLawyerId);
      const conversationId = payload?.conversation?.id;
      await loadConversations();
      if (conversationId) {
        setSelectedConversationId(conversationId);
        await loadMessages(conversationId);
      }
      toast.success('Conversation ready');
    } catch (error) {
      toast.error(error.message || 'Failed to start conversation');
    } finally {
      setCreatingConversation(false);
    }
  }

  async function handleSendMessage() {
    const content = draft.trim();
    if (!selectedConversationId || !content || sending) return;

    setSending(true);
    setDraft('');
    try {
      await messagingAPI.sendMessage(selectedConversationId, content);
      await loadMessages(selectedConversationId, { silent: true });
      await loadConversations({ silent: true });
    } catch (error) {
      toast.error(error.message || 'Failed to send message');
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#14213D', fontFamily: '"Playfair Display", Georgia, serif' }}>
          Messages
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Admin to lawyer in-app conversations</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
        <div className="bg-white rounded-2xl shadow-card p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Start New Chat</label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none"
                value={selectedLawyerId}
                onChange={(e) => setSelectedLawyerId(e.target.value)}
              >
                {lawyers.map((lawyer) => (
                  <option key={lawyer.id} value={lawyer.id}>{lawyer.name}</option>
                ))}
              </select>
              <button
                onClick={handleCreateConversation}
                disabled={!selectedLawyerId || creatingConversation}
                className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: '#14213D' }}
              >
                {creatingConversation ? '...' : 'Start'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Conversations</p>
            <button
              onClick={loadConversations}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              title="Refresh conversations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {loadingConversations ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="text-sm text-gray-400">No conversations yet</div>
            ) : conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className="w-full text-left rounded-xl border px-3 py-3 transition"
                style={{
                  borderColor: selectedConversationId === conv.id ? '#D4A03C' : '#E5E7EB',
                  backgroundColor: selectedConversationId === conv.id ? 'rgba(212,160,60,0.12)' : '#fff',
                }}
              >
                <p className="text-xs text-gray-500">
                  {conv.other_participant?.role === 'lawyer' ? 'Lawyer' : 'Participant'}{' '}
                  {shortId(conv.other_participant?.id)}
                </p>
                <p className="text-sm font-medium text-gray-800 mt-0.5 line-clamp-1">
                  {conv.last_message_preview || conv.last_message?.content || 'No messages yet'}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{formatTime(conv.last_message_at || conv.created_at)}</span>
                  {Number(conv.unread_count || 0) > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#14213D', color: '#fff' }}>
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card flex flex-col min-h-[65vh]">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
              <MessageSquare className="w-4 h-4" />
              Select or start a conversation
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">
                  {selectedConversation?.other_participant?.role === 'lawyer' ? 'Lawyer Conversation' : 'Conversation'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">ID: {selectedConversationId}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/50">
                {loadingMessages ? (
                  <div className="text-sm text-gray-400">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-gray-400">No messages yet</div>
                ) : messages.map((msg) => {
                  const isAdminMessage = msg.sender_id === admin?.id;
                  return (
                    <div key={msg.id} className={`flex ${isAdminMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-xl px-4 py-2 ${isAdminMessage
                          ? 'bg-[#14213D] text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-900 rounded-bl-none'
                        }`}>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p className={`text-[11px] mt-1 text-right ${isAdminMessage ? 'text-white/70' : 'text-gray-600'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-gray-100 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Reply to Lawyer</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gray-300"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!draft.trim() || sending}
                    className="px-3 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1"
                    style={{ backgroundColor: '#14213D' }}
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
