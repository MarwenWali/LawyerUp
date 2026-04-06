import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/utils/supabase';
import { messagingApi } from '@/services/messagingApi';

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

function InboxRow({ item, isTyping, C, onPress }) {
  const unread = Number(item.unread_count || 0);
  const otherRole = item.other_participant_role || 'participant';
  const title = otherRole === 'admin' ? 'Admin Team' : otherRole === 'user' ? 'Client' : 'Lawyer';
  const preview = isTyping
    ? 'Typing...'
    : (item.last_message?.trim() || 'No messages yet');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: C.card, borderColor: C.border },
        pressed && { opacity: 0.82 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.avatar, { backgroundColor: C.accentLight }]}>
        <Text style={[styles.avatarText, { color: C.accent }]}>{title[0]}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.title, { color: C.foreground }]}>{title}</Text>
          <Text style={[styles.time, { color: C.mutedForeground }]}>{formatTimestamp(item.last_message_at || item.updated_at)}</Text>
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

  const [activeTab, setActiveTab] = useState('admin_lawyer');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState({});
  const [startingAdminChat, setStartingAdminChat] = useState(false);
  const typingTimeoutsRef = useRef({});
  const loadVersionRef = useRef(0);
  const refreshTimeoutRef = useRef(null);
  const loadedTabRef = useRef(null);

  const openConversation = useCallback((conversationId, title) => {
    router.push({
      pathname: '/(lawyer-tabs)/inbox-chat',
      params: {
        conversationId,
        title,
      },
    });
  }, []);

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    const loadVersion = ++loadVersionRef.current;

    if (isRefresh) setRefreshing(true);
    else if (loadedTabRef.current !== activeTab) setLoading(true);

    try {
      const payload = await messagingApi.listConversations(activeTab);
      if (loadVersion !== loadVersionRef.current) return;
      setRows(Array.isArray(payload?.conversations) ? payload.conversations : []);
      loadedTabRef.current = activeTab;
    } catch (error) {
      console.error('Inbox load error:', error);
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeTab, user?.id]);

  useEffect(() => {
    loadedTabRef.current = null;
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!user?.id) return;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        loadConversations(false).catch(() => {});
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

        setTypingByConversation((prev) => ({
          ...prev,
          [conversationId]: isTyping,
        }));

        if (typingTimeoutsRef.current[conversationId]) {
          clearTimeout(typingTimeoutsRef.current[conversationId]);
        }

        if (isTyping) {
          typingTimeoutsRef.current[conversationId] = setTimeout(() => {
            setTypingByConversation((prev) => ({ ...prev, [conversationId]: false }));
          }, 3500);
        }
      })
      .subscribe();

    const intervalId = setInterval(() => {
      loadConversations(false).catch(() => {});
    }, 8000);

    return () => {
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
      typingTimeoutsRef.current = {};
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(typingChannel);
      clearInterval(intervalId);
    };
  }, [loadConversations, user?.id]);

  const unreadTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.unread_count || 0), 0),
    [rows]
  );

  const startAdminConversation = useCallback(async () => {
    if (startingAdminChat) return;
    setStartingAdminChat(true);

    try {
      const existingPayload = await messagingApi.listConversations('admin_lawyer');
      const existing = Array.isArray(existingPayload?.conversations)
        ? existingPayload.conversations[0]
        : null;

      if (existing?.conversation_id) {
        setActiveTab('admin_lawyer');
        openConversation(existing.conversation_id, 'Admin Team');
        return;
      }

      const adminUser = await messagingApi.getFirstAdminUser();
      const createPayload = await messagingApi.createConversation('admin_lawyer', adminUser.id);
      const conversationId = createPayload?.conversation?.id;

      if (!conversationId) {
        throw new Error('Could not start admin conversation');
      }

      setActiveTab('admin_lawyer');
      await loadConversations(false);
      openConversation(conversationId, 'Admin Team');
    } catch (error) {
      Alert.alert('Messaging', error?.message || 'Failed to start admin chat');
    } finally {
      setStartingAdminChat(false);
    }
  }, [loadConversations, openConversation, startingAdminChat]);

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
                <Text style={[styles.tabText, { color: active ? C.foreground : C.mutedForeground }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

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
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.conversation_id}
          renderItem={({ item }) => (
            <InboxRow
              item={item}
              isTyping={Boolean(typingByConversation[item.conversation_id])}
              C={C}
              onPress={() => {
                const otherRole = item.other_participant_role || 'participant';
                const title = otherRole === 'admin' ? 'Admin Team' : otherRole === 'user' ? 'Client' : 'Lawyer';
                openConversation(item.conversation_id, title);
              }}
            />
          )}
          contentContainerStyle={rows.length ? styles.listContent : styles.emptyContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadConversations(true)} tintColor={C.accent} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={C.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: C.foreground }]}>No conversations yet</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>Conversations will appear here once messaging starts.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  totalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  tabsWrap: {
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  startAdminBtn: {
    marginTop: 10,
    borderRadius: 10,
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
  listContent: {
    padding: 16,
    gap: 10,
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    gap: 8,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  preview: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  typingPreview: {
    fontFamily: 'Inter_600SemiBold',
  },
  time: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyContent: {
    flexGrow: 1,
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
