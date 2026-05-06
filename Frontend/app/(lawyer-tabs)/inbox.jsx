import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/utils/supabase';
import { messagingApi } from '@/services/messagingApi';
import ProfileImage from '@/components/ProfileImage';
import { useSocket } from '@/src/hooks/useSocket';
import {
  isAdminConversation,
  hasAdminConversation,
  sortConversationsWithAdminPin,
  getInitials as getInitialsFromSorter,
} from '@/utils/conversationSorter';

function formatTimestamp(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function normalizeBackendConversation(conversation) {
  // The conversation should already be normalized by ChatContext
  // Just add the fields needed for the lawyer inbox
  const participant = conversation.other_participant || {};

  return {
    ...conversation,
    uniqueKey: `backend_${conversation.id}`,
    conversation_id: conversation.id,
    source: 'backend',
    // Use the already normalized data from ChatContext
    other_participant_name: participant.name || participant.full_name || 'Conversation',
    other_participant_role: participant.role || 'citizen',
    last_message: conversation.last_message?.content || conversation.last_message_preview || '',
    last_message_at: conversation.last_message_at || conversation.created_at,
    unread_count: Number(conversation.unread_count || 0),
  };
}

/**
 * Resolve avatar URL from multiple sources to avoid losing it during normalization.
 * Priority: other_participant → citizen (lawyer view) → lawyer (citizen view)
 */
function resolveAvatarUrl(item, currentUserId) {
  // 1. Best source: already-normalized other_participant
  const fromParticipant = item.other_participant?.profile_photo_url;
  if (fromParticipant) return fromParticipant;

  // 2. Fallback: read directly from citizen/lawyer on the conversation object
  // (these fields survive all normalization steps because of the spread)
  const isLawyerView = currentUserId && String(currentUserId) === String(item.lawyer?.id || item.lawyer_id);
  if (isLawyerView) {
    return item.citizen?.profile_photo_url || null;
  }
  return item.lawyer?.profile_photo_url || null;
}

function normalizeAdminConversation(conversation) {
  // Get the actual participant role from the conversation data
  const participant = conversation.other_participant || {};
  const actualRole = participant.role || conversation.other_participant_role || 'unknown';

  return {
    ...conversation,
    uniqueKey: `admin_${conversation.conversation_id || conversation.id}`,
    source: 'legacy',
    conversation_id: conversation.conversation_id || conversation.id,
    other_participant_role: actualRole,  // Use actual role, not forced 'admin'
    other_participant_name: participant.name || participant.full_name || conversation.other_participant_name || 'Conversation',
    last_message_at: conversation.last_message_at || conversation.created_at,
    unread_count: Number(conversation.unread_count || 0),
  };
}

function resolveAdminTitle(item) {
  if (item?.other_participant_name) {
    return item.other_participant_name;
  }

  const otherRole = item?.other_participant_role || 'participant';
  if (otherRole === 'admin') return 'Admin Team';
  if (otherRole === 'user' || otherRole === 'citizen') return 'Client';
  return 'Lawyer';
}

function resolvePreview(item, isTyping) {
  if (isTyping) {
    return 'Typing...';
  }

  if (!item) {
    return 'No messages yet';
  }

  if (typeof item.last_message === 'string') {
    return item.last_message.trim() || 'No messages yet';
  }

  return item.last_message_preview?.trim()
    || item.last_message?.content?.trim()
    || item.preview
    || 'No messages yet';
}

function InboxRow({ item, title, avatarLabel, avatarUrl, preview, isTyping, C, onPress, isAdminChat }) {
  const unread = Number(item.unread_count || 0);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: C.card, borderColor: C.border },
        isAdminChat && { borderLeftWidth: 4, borderLeftColor: '#D4A03C' },
        pressed && { opacity: 0.82 },
      ]}
      onPress={onPress}
    >
      {isAdminChat ? (
        <View style={[styles.avatar, { backgroundColor: '#D4A03C' }]}>
          <Text style={[styles.avatarText, { color: '#FFF' }]}>
            {avatarLabel || getInitialsFromSorter(title)}
          </Text>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-done" size={10} color="#FFF" />
          </View>
        </View>
      ) : (
        <ProfileImage url={avatarUrl} size={44} fallbackText={avatarLabel} />
      )}

      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <View style={styles.titleWrapper}>
            <Text style={[styles.title, { color: C.foreground }]} numberOfLines={1}>
              {title}
            </Text>
            {isAdminChat && (
              <View style={[styles.supportBadge, { backgroundColor: '#D4A03C' }]}>
                <Text style={styles.supportBadgeText}>Support</Text>
              </View>
            )}
          </View>
          <Text style={[styles.time, { color: C.mutedForeground }]}>
            {formatTimestamp(item.last_message_at || item.updated_at || item.created_at)}
          </Text>
        </View>

        <View style={styles.rowBottom}>
          <Text
            style={[
              styles.preview,
              { color: isTyping ? C.accent : C.textSecondary },
              isTyping && styles.typingPreview,
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>

          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: C.accent }]}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function LawyerInboxPage() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const C = useTheme();
  const { t } = useLanguage();
  const {
    conversations: backendConversations,
    refreshConversations,
    typingByConversation: backendTypingByConversation,
  } = useSocket();

  const [adminRows, setAdminRows] = useState([]);
  const [combinedLoading, setCombinedLoading] = useState(true);
  const [combinedRefreshing, setCombinedRefreshing] = useState(false);
  const [legacyTypingByConversation, setLegacyTypingByConversation] = useState({});
  const [startingAdminChat, setStartingAdminChat] = useState(false);
  const typingTimeoutsRef = useRef({});
  const refreshTimeoutRef = useRef(null);
  const loadVersionRef = useRef(0);

  // Normalize backend conversations with strict admin separation
  const backendRows = useMemo(
    () => backendConversations
      .map(normalizeBackendConversation)
      .filter(conv => {
        // Strict filtering: exclude any admin conversations to prevent cross-contamination
        const role = conv.other_participant_role || 'unknown';
        const participantRole = conv.other_participant?.role || 'unknown';

        // Double-check both role fields to ensure no admin conversations leak through
        return role !== 'admin' && participantRole !== 'admin';
      }),
    [backendConversations]
  );

  // Combine all conversations from both sources with strict type separation
  const allConversations = useMemo(() => {
    const combined = [...adminRows, ...backendRows];

    // Strict separation: filter by conversation type
    const adminConvs = combined.filter(conv => {
      const role = conv.other_participant?.role || conv.other_participant_role || 'unknown';
      return role === 'admin';
    });

    const clientConvs = combined.filter(conv => {
      const role = conv.other_participant?.role || conv.other_participant_role || 'unknown';
      return role !== 'admin' && role !== 'unknown';
    });

    // Keep only ONE admin conversation (the first one from legacy)
    const adminToKeep = adminConvs.length > 0 ? [adminConvs[0]] : [];

    // Deduplicate client conversations by conversation ID to prevent duplicates
    const clientSeen = new Set();
    const deduplicatedClients = clientConvs.filter(conv => {
      const conversationId = conv.conversation_id || conv.id;
      if (clientSeen.has(conversationId)) return false;
      clientSeen.add(conversationId);
      return true;
    });

    return [...adminToKeep, ...deduplicatedClients];
  }, [adminRows, backendRows]);

  // Sort with admin pinned to top
  const sortedRows = useMemo(() => {
    return sortConversationsWithAdminPin(allConversations);
  }, [allConversations]);

  // Check if admin conversation exists
  const adminConvExists = useMemo(() => {
    return hasAdminConversation(allConversations);
  }, [allConversations]);

  // Total unread count
  const unreadTotal = useMemo(
    () => sortedRows.reduce((sum, row) => sum + Number(row.unread_count || 0), 0),
    [sortedRows]
  );

  // Combine typing indicators
  const allTypingByConversation = useMemo(() => {
    return { ...legacyTypingByConversation, ...backendTypingByConversation };
  }, [legacyTypingByConversation, backendTypingByConversation]);

  const openBackendConversation = useCallback((conversation) => {
    const participant = conversation.other_participant || {};

    // Double-check this is not an admin conversation to prevent cross-contamination
    const participantRole = participant.role || conversation.other_participant_role || 'unknown';
    if (participantRole === 'admin') {
      console.warn('Attempted to open admin conversation as backend conversation - blocked');
      return;
    }

    router.push({
      pathname: '/(messaging)/chat',
      params: {
        conversationId: conversation.id,
        title: participant.name || participant.full_name || 'Conversation',
        // Add flag to indicate this is a user conversation
        isUserChat: 'true',
      },
    });
  }, []);

  const openLegacyConversation = useCallback((conversationId, title) => {
    // Ensure this is treated as an admin conversation
    router.push({
      pathname: '/(lawyer-tabs)/inbox-chat',
      params: {
        conversationId,
        title: title || 'Admin Team',
        // Add flag to indicate this is an admin conversation
        isAdminChat: 'true',
      },
    });
  }, []);

  // Load both admin and backend conversations simultaneously
  const loadAllConversations = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    const loadVersion = ++loadVersionRef.current;

    if (isRefresh) setCombinedRefreshing(true);
    else setCombinedLoading(true);

    try {
      // Load both in parallel
      const [adminPayload, backendSuccess] = await Promise.all([
        messagingApi.listConversations('admin_lawyer').catch((err) => {
          console.error('Admin load error:', err);
          return { conversations: [] };
        }),
        refreshConversations().catch((err) => {
          console.error('Backend load error:', err);
          return false;
        }),
      ]);

      if (loadVersion !== loadVersionRef.current) return;

      // Update admin rows
      const adminConvs = Array.isArray(adminPayload?.conversations)
        ? adminPayload.conversations.map(normalizeAdminConversation)
        : [];
      setAdminRows(adminConvs);
    } catch (error) {
      console.error('Combined inbox load error:', error);
      Alert.alert('Messaging', error?.message || 'Failed to load conversations');
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setCombinedLoading(false);
        setCombinedRefreshing(false);
      }
    }
  }, [refreshConversations, user?.id]);

  // Initial load and setup listeners
  useEffect(() => {
    if (!user?.id) return;

    loadAllConversations(false);

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        loadAllConversations(false).catch(() => { });
      }, 220);
    };

    // Listen for new messages
    const dataChannel = supabase
      .channel(`lawyer-inbox-sync-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        scheduleRefresh();
      })
      .subscribe();

    // Listen for typing indicators
    const typingChannel = supabase
      .channel('typing-indicators')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const conversationId = String(payload?.conversation_id || '');
        const senderId = String(payload?.sender_id || '');
        const isTyping = Boolean(payload?.is_typing);

        if (!conversationId || !senderId || senderId === user.id) return;

        setLegacyTypingByConversation((prev) => ({
          ...prev,
          [conversationId]: isTyping,
        }));

        if (typingTimeoutsRef.current[conversationId]) {
          clearTimeout(typingTimeoutsRef.current[conversationId]);
        }

        if (isTyping) {
          typingTimeoutsRef.current[conversationId] = setTimeout(() => {
            setLegacyTypingByConversation((prev) => ({ ...prev, [conversationId]: false }));
          }, 3500);
        }
      })
      .subscribe();

    // Periodic refresh
    const intervalId = setInterval(() => {
      loadAllConversations(false).catch(() => { });
    }, 8000);

    return () => {
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
      typingTimeoutsRef.current = {};
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(typingChannel);
      clearInterval(intervalId);
    };
  }, [loadAllConversations, user?.id]);

  const startAdminConversation = useCallback(async () => {
    if (startingAdminChat) return;
    setStartingAdminChat(true);

    try {
      // Check for existing admin conversation
      const existingPayload = await messagingApi.listConversations('admin_lawyer');
      const conversations = Array.isArray(existingPayload?.conversations)
        ? existingPayload.conversations
        : [];

      const existing = conversations[0];
      const existingId = existing?.conversation_id || existing?.id;

      if (existingId) {
        openLegacyConversation(existingId, 'Admin Team');
        return;
      }

      // Create new admin conversation
      const adminUser = await messagingApi.getFirstAdminUser();
      const createPayload = await messagingApi.createConversation('admin_lawyer', adminUser.id);
      const conversationId = createPayload?.conversation?.id || createPayload?.id;

      if (!conversationId) {
        throw new Error('Could not start admin conversation');
      }

      await loadAllConversations(false);
      openLegacyConversation(conversationId, 'Admin Team');
    } catch (error) {
      Alert.alert('Messaging', error?.message || 'Failed to start admin chat');
    } finally {
      setStartingAdminChat(false);
    }
  }, [loadAllConversations, openLegacyConversation, startingAdminChat]);

  const renderItem = useCallback(({ item }) => {
    const conversationId = item.conversation_id || item.id;
    const isAdmin = isAdminConversation(item);
    let title = '';
    let avatarLabel = '';

    if (item.source === 'backend') {
      // Backend conversation (client chat)
      const participant = item.other_participant || {};
      title = participant.name || participant.full_name || 'Conversation';
      avatarLabel = participant.initials || getInitialsFromSorter(title);
      const avatarUrl = resolveAvatarUrl(item, user?.id);

      return (
        <InboxRow
          item={item}
          title={title}
          avatarLabel={avatarLabel}
          avatarUrl={avatarUrl}
          preview={resolvePreview(item, Boolean(backendTypingByConversation[item.id]))}
          isTyping={Boolean(backendTypingByConversation[item.id])}
          C={C}
          isAdminChat={false}
          onPress={() => openBackendConversation(item)}
        />
      );
    }

    // Legacy admin conversation
    title = resolveAdminTitle(item);
    avatarLabel = getInitialsFromSorter(title);

    return (
      <InboxRow
        item={item}
        title={title}
        avatarLabel={avatarLabel}
        preview={resolvePreview(item, Boolean(legacyTypingByConversation[conversationId]))}
        isTyping={Boolean(legacyTypingByConversation[conversationId])}
        C={C}
        isAdminChat={isAdmin}
        onPress={() => openLegacyConversation(conversationId, title)}
      />
    );
  }, [
    C,
    backendTypingByConversation,
    legacyTypingByConversation,
    openBackendConversation,
    openLegacyConversation,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: C.border, backgroundColor: C.headerBg }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.heading, { color: C.tint }]}>{t.inbox || 'Inbox'}</Text>
          {unreadTotal > 0 && (
            <View style={[styles.totalBadge, { backgroundColor: C.accentLight }]}>
              <Text style={[styles.totalBadgeText, { color: C.accent }]}>{unreadTotal} unread</Text>
            </View>
          )}
        </View>

        {!adminConvExists && (
          <Pressable
            style={({ pressed }) => [
              styles.startAdminBtn,
              { backgroundColor: C.tint },
              (pressed || startingAdminChat) && { opacity: 0.82 },
            ]}
            onPress={startAdminConversation}
            disabled={startingAdminChat}
          >
            {startingAdminChat ? (
              <ActivityIndicator color={C.primaryForeground} size="small" />
            ) : (
              <Ionicons name="paper-plane-outline" size={16} color={C.primaryForeground} />
            )}
            <Text style={[styles.startAdminBtnText, { color: C.primaryForeground }]}>Start Admin Chat</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {combinedLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : sortedRows.length === 0 ? (
        <FlatList
          data={[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.emptyContent}
          refreshControl={
            <RefreshControl
              refreshing={combinedRefreshing}
              onRefresh={() => loadAllConversations(true)}
              tintColor={C.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={C.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: C.foreground }]}>No conversations yet</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                Your messages will appear here. Start chatting with support or awaiting client inquiries.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sortedRows}
          keyExtractor={(item) => item.uniqueKey || String(item.conversation_id || item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={combinedRefreshing}
              onRefresh={() => loadAllConversations(true)}
              tintColor={C.accent}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Container & Layout ──
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },

  // ── Total Badge ──
  totalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },

  // ── Start Admin Button ──
  startAdminBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startAdminBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },

  // ── Conversations List ──
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyContent: {
    flexGrow: 1,
  },

  // ── Conversation Row ──
  row: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // ── Avatar ──
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },

  // ── Row Content ──
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  titleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  supportBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  supportBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
  },
  time: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },

  // ── Preview & Unread ──
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  typingPreview: {
    fontFamily: 'Inter_600SemiBold',
    fontStyle: 'italic',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },

  // ── Empty State ──
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
