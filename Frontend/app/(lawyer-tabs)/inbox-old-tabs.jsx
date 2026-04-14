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
import { useSocket } from '@/src/hooks/useSocket';
import {
  isAdminConversation,
  hasAdminConversation,
  sortConversationsWithAdminPin,
  getRoleLabel,
  getInitials as getInitialsFromSorter,
} from '@/utils/conversationSorter';

const TABS = [
  { key: 'admin_lawyer', label: 'Admin Chat' },
  { key: 'lawyer_user', label: 'Client Chats' },
];

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

function getInitials(value) {
  return String(value || '?')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function normalizeBackendConversation(conversation) {
  const participant = conversation.other_participant || conversation.citizen || conversation.lawyer || {};
  const title = participant.name || participant.full_name || 'Conversation';

  return {
    ...conversation,
    conversation_id: conversation.id,
    other_participant_name: title,
    other_participant_role: participant.role || 'citizen',
    last_message: conversation.last_message?.content || conversation.last_message_preview || '',
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

function InboxRow({ item, title, avatarLabel, preview, isTyping, C, onPress, isAdminChat }) {
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
      <View style={[styles.avatar, { backgroundColor: isAdminChat ? '#D4A03C' : C.accentLight }]}>
        <Text style={[styles.avatarText, { color: isAdminChat ? '#FFF' : C.accent }]}>
          {avatarLabel || getInitialsFromSorter(title)}
        </Text>
        {isAdminChat && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-done" size={10} color="#FFF" />
          </View>
        )}
      </View>

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

  const [activeTab, setActiveTab] = useState('admin_lawyer');
  const [adminRows, setAdminRows] = useState([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminRefreshing, setAdminRefreshing] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendRefreshing, setBackendRefreshing] = useState(false);
  const [legacyTypingByConversation, setLegacyTypingByConversation] = useState({});
  const [startingAdminChat, setStartingAdminChat] = useState(false);
  const typingTimeoutsRef = useRef({});
  const refreshTimeoutRef = useRef(null);
  const loadVersionRef = useRef(0);

  const backendRows = useMemo(
    () => backendConversations.map(normalizeBackendConversation),
    [backendConversations]
  );

  const isBackendTab = activeTab === 'lawyer_user';
  const rows = isBackendTab ? backendRows : adminRows;
  const typingByConversation = isBackendTab ? backendTypingByConversation : legacyTypingByConversation;
  const loading = isBackendTab ? (backendLoading && backendRows.length === 0) : adminLoading;
  const refreshing = isBackendTab ? backendRefreshing : adminRefreshing;

  const openBackendConversation = useCallback((conversation) => {
    const participant = conversation.other_participant || {};
    router.push({
      pathname: '/(messaging)/chat',
      params: {
        conversationId: conversation.id,
        title: participant.name || participant.full_name || 'Conversation',
      },
    });
  }, []);

  const openLegacyConversation = useCallback((conversationId, title) => {
    router.push({
      pathname: '/(lawyer-tabs)/inbox-chat',
      params: {
        conversationId,
        title,
      },
    });
  }, []);

  const loadAdminConversations = useCallback(async (isRefresh = false) => {
    if (!user?.id || isBackendTab) return;
    const loadVersion = ++loadVersionRef.current;

    if (isRefresh) setAdminRefreshing(true);
    else setAdminLoading(true);

    try {
      const payload = await messagingApi.listConversations('admin_lawyer');
      if (loadVersion !== loadVersionRef.current) return;
      setAdminRows(Array.isArray(payload?.conversations) ? payload.conversations : []);
    } catch (error) {
      console.error('Admin inbox load error:', error);
      Alert.alert('Messaging', error?.message || 'Failed to load admin conversations');
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setAdminLoading(false);
        setAdminRefreshing(false);
      }
    }
  }, [isBackendTab, user?.id]);

  const loadBackendConversations = useCallback(async (isRefresh = false) => {
    if (!user?.id || !isBackendTab) return;

    if (isRefresh) setBackendRefreshing(true);
    else setBackendLoading(true);

    try {
      await refreshConversations();
    } catch (error) {
      console.error('Backend inbox load error:', error);
      Alert.alert('Messaging', error?.message || 'Failed to load conversations');
    } finally {
      setBackendLoading(false);
      setBackendRefreshing(false);
    }
  }, [isBackendTab, refreshConversations, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    if (activeTab === 'lawyer_user') {
      loadBackendConversations(false);
      return undefined;
    }

    loadAdminConversations(false);

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        loadAdminConversations(false).catch(() => {});
      }, 220);
    };

    const dataChannel = supabase
      .channel(`lawyer-inbox-sync-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        scheduleRefresh();
      })
      .subscribe();

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

    const intervalId = setInterval(() => {
      loadAdminConversations(false).catch(() => {});
    }, 8000);

    return () => {
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
      typingTimeoutsRef.current = {};
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(typingChannel);
      clearInterval(intervalId);
    };
  }, [activeTab, loadAdminConversations, loadBackendConversations, user?.id]);

  const unreadTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.unread_count || 0), 0),
    [rows]
  );

  // Check if an admin conversation already exists
  const adminConvExists = useMemo(() => {
    return hasAdminConversation(rows);
  }, [rows]);

  // Sort conversations with admin pinned to top
  const sortedRows = useMemo(() => {
    return sortConversationsWithAdminPin(rows);
  }, [rows]);

  const startAdminConversation = useCallback(async () => {
    if (startingAdminChat) return;
    setStartingAdminChat(true);

    try {
      // Check for an existing admin conversation first
      const existingPayload = await messagingApi.listConversations('admin_lawyer');
      const conversations = Array.isArray(existingPayload?.conversations)
        ? existingPayload.conversations
        : [];

      const existing = conversations[0];
      const existingId = existing?.conversation_id || existing?.id;

      if (existingId) {
        setActiveTab('admin_lawyer');
        openLegacyConversation(existingId, 'Admin Team');
        return;
      }

      // Start a new conversation with the admin
      const adminUser = await messagingApi.getFirstAdminUser();
      const createPayload = await messagingApi.createConversation('admin_lawyer', adminUser.id);
      // Backend returns { conversation: { id, ... } }
      const conversationId = createPayload?.conversation?.id || createPayload?.id;

      if (!conversationId) {
        throw new Error('Could not start admin conversation — no ID returned');
      }

      setActiveTab('admin_lawyer');
      await loadAdminConversations(false);
      openLegacyConversation(conversationId, 'Admin Team');
    } catch (error) {
      Alert.alert('Messaging', error?.message || 'Failed to start admin chat');
    } finally {
      setStartingAdminChat(false);
    }
  }, [loadAdminConversations, openLegacyConversation, startingAdminChat]);

  const renderItem = useCallback(({ item }) => {
    if (isBackendTab) {
      const participant = item.other_participant || {};
      const title = participant.name || participant.full_name || 'Conversation';
      return (
        <InboxRow
          item={item}
          title={title}
          avatarLabel={participant.initials || getInitialsFromSorter(title)}
          preview={resolvePreview(item, Boolean(backendTypingByConversation[item.id]))}
          isTyping={Boolean(backendTypingByConversation[item.id])}
          C={C}
          isAdminChat={false}
          onPress={() => openBackendConversation(item)}
        />
      );
    }

    const title = resolveAdminTitle(item);
    const conversationId = item.conversation_id || item.id;
    const isAdmin = isAdminConversation(item);

    return (
      <InboxRow
        item={item}
        title={title}
        avatarLabel={getInitialsFromSorter(title)}
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
    isBackendTab,
    legacyTypingByConversation,
    openBackendConversation,
    openLegacyConversation,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: C.border, backgroundColor: C.headerBg }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.heading, { color: C.tint }]}>{t.inbox || 'Inbox'}</Text>
          {unreadTotal > 0 && (
            <View style={[styles.totalBadge, { backgroundColor: C.accentLight }]}>
              <Text style={[styles.totalBadgeText, { color: C.accent }]}>{unreadTotal} unread</Text>
            </View>
          )}
        </View>

        <View style={[styles.tabsWrap, { backgroundColor: C.muted }]}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tab, active && { backgroundColor: C.card }]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, { color: active ? C.foreground : C.mutedForeground }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!adminConvExists && !isBackendTab && (
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : rows.length === 0 ? (
        <FlatList
          data={[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.emptyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => (isBackendTab ? loadBackendConversations(true) : loadAdminConversations(true))}
              tintColor={C.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={C.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: C.foreground }]}>No conversations yet</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                {isBackendTab
                  ? 'Conversations will appear here once a citizen sends you a message.'
                  : 'Conversations will appear here once admin messaging starts.'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sortedRows}
          keyExtractor={(item) => String(item.conversation_id || item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => (isBackendTab ? loadBackendConversations(true) : loadAdminConversations(true))}
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

  // ── Tabs ──
  tabsWrap: {
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
  },
  tabText: {
    fontSize: 13,
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
