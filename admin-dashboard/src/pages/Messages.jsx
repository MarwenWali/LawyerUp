import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  MessageSquare, Send, RefreshCw, Search, MoreVertical, 
  Phone, Video, Info, PlusCircle, Camera, Image as ImageIcon, 
  Mic, Globe, Smile, ThumbsUp, Edit 
} from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '../lib/api.js';
import { messagingAPI } from '../lib/messagingApi.js';
import { useAuth } from '../hooks/useAuth.js';
import MessageBubble from '../components/MessageBubble.jsx';
import { format, formatDistanceToNow, isSameDay } from 'date-fns';

export default function Messages() {
  const { user: admin } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [usersData, convsData] = await Promise.all([
        adminAPI.getUsers(),
        messagingAPI.listConversations()
      ]);

      const allUsers = Array.isArray(usersData?.users) ? usersData.users : [];
      const onlyLawyers = allUsers.filter(u => u.role === 'lawyer');
      setLawyers(onlyLawyers);

      const convs = Array.isArray(convsData?.conversations) ? convsData.conversations : [];
      setConversations(convs);

      // Default selection if none
      if (!selectedLawyerId && (convs.length > 0 || onlyLawyers.length > 0)) {
        const firstChat = convs[0];
        if (firstChat) {
          setSelectedLawyerId(firstChat.other_participant?.id);
        } else {
          setSelectedLawyerId(onlyLawyers[0]?.id);
        }
      }
    } catch (error) {
      if (!silent) toast.error('Failed to load messaging data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedLawyerId]);

  const loadMessages = useCallback(async (conversationId, { silent = false } = {}) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const payload = await messagingAPI.listMessages(conversationId, 100);
      const rows = Array.isArray(payload?.messages) ? payload.messages : [];
      const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setMessages(sorted);
      if (!silent) setTimeout(() => scrollToBottom('auto'), 50);
      await messagingAPI.markRead(conversationId);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.other_participant?.id === selectedLawyerId);
  }, [conversations, selectedLawyerId]);

  useEffect(() => {
    if (activeConversation?.id) {
      loadMessages(activeConversation.id);
    } else {
      setMessages([]);
    }
  }, [activeConversation?.id, loadMessages]);

  // Unified List of "Discussions"
  const discussions = useMemo(() => {
    const map = new Map();

    // 1. Add all lawyers as base entries
    lawyers.forEach(l => {
      map.set(l.id, {
        id: `temp-${l.id}`,
        other_participant: {
          id: l.id,
          full_name: l.full_name,
          profile_photo_url: l.profile_photo_url
        },
        last_message_preview: 'New Contact',
        last_message_at: null,
        unread_count: 0
      });
    });

    // 2. Overlay with actual conversation data
    conversations.forEach(c => {
      const pId = c.other_participant?.id;
      if (pId) {
        map.set(pId, c);
      }
    });

    const list = Array.from(map.values());

    // 3. Sort: Last message first, then new contacts
    return list.sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [lawyers, conversations]);

  const filteredDiscussions = useMemo(() => {
    if (!searchQuery) return discussions;
    const lower = searchQuery.toLowerCase();
    return discussions.filter(d => 
      d.other_participant?.full_name?.toLowerCase().includes(lower) ||
      d.last_message_preview?.toLowerCase().includes(lower)
    );
  }, [discussions, searchQuery]);

  const selectedDiscussion = useMemo(() => {
    return filteredDiscussions.find(d => d.other_participant?.id === selectedLawyerId);
  }, [filteredDiscussions, selectedLawyerId]);

  // Polling
  useEffect(() => {
    const id = setInterval(() => loadData({ silent: true }), 5000);
    return () => clearInterval(id);
  }, [loadData]);

  async function handleSendMessage() {
    const content = draft.trim();
    if (!selectedLawyerId || !content || sending) return;

    setSending(true);
    setDraft('');
    try {
      let conversationId = activeConversation?.id;

      // Create conversation on demand if it doesn't exist
      if (!conversationId) {
        const payload = await messagingAPI.createConversation(selectedLawyerId);
        conversationId = payload?.conversation?.id;
        await loadData({ silent: true });
      }

      if (conversationId) {
        await messagingAPI.sendMessage(conversationId, content);
        await loadMessages(conversationId, { silent: true });
        scrollToBottom();
      }
    } catch (error) {
      toast.error(error.message || 'Message failed to send');
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-[calc(100vh-40px)] flex bg-[#F0F2F5] p-2 gap-2 overflow-hidden -m-4">
      {/* Sidebar: Discussions */}
      <div className="w-[360px] bg-white rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 pb-2">
          <div className="flex justify-between items-center mb-4 px-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-black">Discussions</h1>
            <div className="flex gap-2">
              <div className="p-2 bg-gray-100 rounded-full cursor-pointer hover:bg-gray-200">
                 <Globe className="w-5 h-5 text-black" />
              </div>
              <div className="p-2 bg-gray-100 rounded-full cursor-pointer hover:bg-gray-200">
                 <Edit className="w-5 h-5 text-black" />
              </div>
            </div>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Rechercher dans Messenger" 
              className="w-full pl-10 pr-4 py-2 bg-[#F0F2F5] rounded-full text-[15px] outline-none placeholder:text-gray-500 focus:ring-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {loading && discussions.length === 0 ? (
             <div className="flex justify-center p-10"><RefreshCw className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : filteredDiscussions.map((disc) => (
            <button
              key={disc.other_participant?.id}
              onClick={() => setSelectedLawyerId(disc.other_participant?.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors duration-150 mb-0.5 ${
                selectedLawyerId === disc.other_participant?.id 
                  ? 'bg-[#E7F3FF]' 
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-[56px] h-[56px] rounded-full bg-gray-100 flex items-center justify-center border border-gray-100 overflow-hidden">
                   {disc.other_participant?.profile_photo_url ? (
                     <img src={disc.other_participant.profile_photo_url} className="w-full h-full object-cover" />
                   ) : (
                     <span className="text-lg font-bold text-gray-400">{(disc.other_participant?.full_name || 'L').charAt(0)}</span>
                   )}
                </div>
                {/* Active Indicator Placeholder */}
                <div className="absolute bottom-0 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-start pr-2">
                <div className="flex justify-between w-full">
                  <span className={`text-[15px] truncate ${disc.unread_count > 0 ? 'font-bold' : 'font-medium'} text-black`}>
                    {disc.other_participant?.full_name}
                  </span>
                  {disc.last_message_at && (
                    <span className="text-[12px] text-gray-500 whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(disc.last_message_at), { addSuffix: false }).replace('about ', '')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between w-full mt-0.5">
                  <p className={`text-[13px] truncate ${disc.unread_count > 0 ? 'font-bold text-black' : 'text-gray-500'}`}>
                    {disc.last_message_preview}
                  </p>
                  {disc.unread_count > 0 && (
                     <div className="w-2.5 h-2.5 bg-[#0084FF] rounded-full ml-2"></div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm flex flex-col overflow-hidden relative">
        {!selectedLawyerId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
             <MessageSquare className="w-20 h-20 text-gray-100 mb-6" />
             <h2 className="text-xl font-bold text-black mb-2">Pas de discussion sélectionnée</h2>
             <p className="text-gray-500 text-sm">Sélectionnez un avocat pour commencer à discuter.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-[10px] border-b border-gray-100 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100">
                    {selectedDiscussion?.other_participant?.profile_photo_url ? (
                      <img src={selectedDiscussion.other_participant.profile_photo_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#14213D] text-white text-sm font-bold">
                        {(selectedDiscussion?.other_participant?.full_name || 'L').charAt(0)}
                      </div>
                    )}
                 </div>
                 <div>
                    <h2 className="text-[15px] font-bold text-black leading-tight">
                      {selectedDiscussion?.other_participant?.full_name}
                    </h2>
                    <p className="text-[12px] text-gray-500 font-normal">Active(e) il y a 10 min</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-[#6D28D9] hover:bg-gray-100 rounded-full transition-colors"><Phone className="w-5 h-5" /></button>
                <button className="p-2 text-[#6D28D9] hover:bg-gray-100 rounded-full transition-colors"><Video className="w-5 h-5" /></button>
                <button className="p-2 text-[#6D28D9] hover:bg-gray-100 rounded-full transition-colors"><Info className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                   <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 text-gray-200" />
                   </div>
                   <p className="text-gray-400 text-sm font-medium">Vous n'avez pas encore discuté avec {selectedDiscussion?.other_participant?.full_name}</p>
                   <p className="text-gray-300 text-xs mt-1">Dites-lui bonjour !</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {messages.map((msg, index) => {
                    const prevMsg = messages[index - 1];
                    const nextMsg = messages[index + 1];
                    const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id || !isSameDay(new Date(prevMsg.created_at), new Date(msg.created_at));
                    const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id || !isSameDay(new Date(nextMsg.created_at), new Date(msg.created_at));
                    
                    return (
                      <div key={msg.id}>
                        {isFirstInGroup && (
                          <div className="text-center my-4">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                              {format(new Date(msg.created_at), 'd MMMM, HH:mm')}
                            </span>
                          </div>
                        )}
                        <MessageBubble 
                          message={msg}
                          isAdmin={msg.sender_id === admin?.id}
                          isFirst={isFirstInGroup}
                          isLast={isLastInGroup}
                          showAvatar={isLastInGroup && msg.sender_id !== admin?.id}
                        />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-4 pt-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-1.5 px-1">
                  <PlusCircle className="w-6 h-6 text-[#0084FF] cursor-pointer hover:opacity-80" />
                  <Camera className="w-6 h-6 text-[#0084FF] cursor-pointer hover:opacity-80" />
                  <ImageIcon className="w-6 h-6 text-[#0084FF] cursor-pointer hover:opacity-80" />
                  <Mic className="w-6 h-6 text-[#0084FF] cursor-pointer hover:opacity-80" />
                </div>
                
                <div className="flex-1 relative flex items-center bg-[#F0F2F5] rounded-full px-4 py-2">
                  <textarea 
                    placeholder="Aa"
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-gray-500 resize-none max-h-32 min-h-[22px] py-0"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Smile className="w-6 h-6 text-[#0084FF] cursor-pointer hover:opacity-80 ml-2" />
                </div>

                <div className="flex-shrink-0">
                  {draft.trim() ? (
                    <button 
                      onClick={handleSendMessage}
                      disabled={sending}
                      className="p-1 px-1.5 focus:outline-none"
                    >
                      <Send className="w-6 h-6 text-[#0084FF]" />
                    </button>
                  ) : (
                    <ThumbsUp className="w-6 h-6 text-[#0084FF] cursor-pointer hover:opacity-80" />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
