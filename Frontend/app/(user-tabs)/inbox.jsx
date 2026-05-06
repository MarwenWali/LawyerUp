import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/utils/supabase';
import { messagingApi } from '@/services/messagingApi';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import ProfileImage from '@/components/ProfileImage';

function formatTime(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTimestamp(isoDate) {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday || isYesterday) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return isToday ? `${hours}:${minutes}` : `Yesterday`;
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return '';
  }
}

function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => ({
    id: item.id,
    conversation_id: item.conversation_id,
    sender_id: item.sender_id,
    content: item.content,
    created_at: item.created_at,
    read_by_all: item.read_by_all || false,
    read_by_me: item.read_by_me || false,
    // ── Attachment fields — must be preserved for rendering ──
    message_type:    item.message_type    || 'text',
    attachment_url:  item.attachment_url  || null,
    attachment_name: item.attachment_name || null,
    attachment_type: item.attachment_type || null,
  }));
}

/** Full-screen image preview modal */
function ImagePreviewModal({ uri, onClose }) {
  const { width, height } = Dimensions.get('window');
  return (
    <Modal
      visible={Boolean(uri)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={previewStyles.overlay}>
        <Pressable style={previewStyles.closeBtn} onPress={onClose} hitSlop={16}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width, height: height * 0.85 }}
            resizeMode="contain"
          />
        ) : null}
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 6,
  },
});

function Receipt({ readByAll, color }) {
  return (
    <Ionicons
      name={readByAll ? 'checkmark-done' : 'checkmark'}
      size={14}
      color={color}
      style={{ marginLeft: 4 }}
    />
  );
}

export default function UserInboxPage() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const C = useTheme();
  const { t } = useLanguage();

  // Inbox list state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState({});
  const typingTimeoutsRef = useRef({});
  const loadVersionRef = useRef(0);
  const refreshTimeoutRef = useRef(null);

  // Chat modal state
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const typingTimerRef = useRef(null);
  const typingChannelRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const chatLoadVersionRef = useRef(0);

  const canSend = useMemo(() => (Boolean(chatInput.trim()) || pendingAttachment) && !chatSending, [chatInput, chatSending, pendingAttachment]);

  // Image preview state
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission needed', 'Permission to access the camera roll is required!');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        setPendingAttachment({
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'screenshot.jpg',
          type: asset.mimeType || 'image/jpeg',
          currentChatId: selectedConversation?.id,
        });
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        setPendingAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
          currentChatId: selectedConversation?.id,
        });
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    const loadVersion = ++loadVersionRef.current;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const payload = await messagingApi.listConversations('lawyer_user');
      if (loadVersion !== loadVersionRef.current) return;
      
      // Filter out admin conversations - users should only see lawyer conversations
      const conversations = Array.isArray(payload?.conversations) ? payload.conversations : [];
      const filteredConversations = conversations.filter(conv => {
        const role = conv.other_participant?.role || conv.other_participant_role || 'unknown';
        return role !== 'admin';
      });
      
      setRows(filteredConversations);
    } catch (error) {
      console.error('Inbox load error:', error);
      Alert.alert('Error', 'Could not load conversations');
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.id]);

  const loadChatMessages = useCallback(async ({ isRefresh = false } = {}) => {
    if (!selectedConversation?.id) return;
    const loadVersion = ++chatLoadVersionRef.current;

    if (isRefresh) setChatRefreshing(true);
    else setChatLoading(true);

    try {
      const payload = await messagingApi.listMessages(selectedConversation.id, { limit: 50 });
      if (loadVersion !== chatLoadVersionRef.current) return;

      const normalized = normalizeMessages(payload?.messages);
      setChatMessages(normalized);

      const hasUnreadIncoming = normalized.some(
        (item) => item.sender_id !== user?.id && !item.read_by_me
      );

      if (hasUnreadIncoming && user?.id) {
        try {
          await messagingApi.markConversationRead(selectedConversation.id);
          if (loadVersion !== chatLoadVersionRef.current) return;
          setChatMessages((prev) =>
            prev.map((item) => (
              item.sender_id === user.id ? item : { ...item, read_by_me: true }
            ))
          );
        } catch {
          // Silent fail for read marking
        }
      }
    } catch (error) {
      console.error('Message load error:', error);
    } finally {
      if (loadVersion === chatLoadVersionRef.current) {
        setChatLoading(false);
        setChatRefreshing(false);
      }
    }
  }, [selectedConversation?.id, user?.id]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      loadChatMessages().catch(() => {});
    }, 100);
  }, [loadChatMessages]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!user?.id) return;

    const scheduleInboxRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        loadConversations(false).catch(() => {});
      }, 220);
    };

    const dataChannel = supabase
      .channel(`user-inbox-sync-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        scheduleInboxRefresh();
        loadChatMessages().catch(() => {});
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

        if (selectedConversation?.id === conversationId) {
          setOtherTyping(isTyping);
        }

        if (typingTimeoutsRef.current[conversationId]) {
          clearTimeout(typingTimeoutsRef.current[conversationId]);
        }

        if (isTyping) {
          typingTimeoutsRef.current[conversationId] = setTimeout(() => {
            setTypingByConversation((prev) => ({
              ...prev,
              [conversationId]: false,
            }));
            if (selectedConversation?.id === conversationId) {
              setOtherTyping(false);
            }
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(typingChannel);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [user?.id, loadConversations, loadChatMessages, selectedConversation?.id]);

  useEffect(() => {
    if (selectedConversation?.id) {
      loadChatMessages();

      if (!selectedConversation?.id || !user?.id) return;

      const dataChannel = supabase
        .channel(`conversation-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          () => {
            scheduleRefresh();
          }
        )
        .subscribe();

      const typingChannel = supabase
        .channel('typing-indicators')
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const senderId = String(payload?.sender_id || '');
          const incomingConversationId = String(payload?.conversation_id || '');
          const isTyping = Boolean(payload?.is_typing);

          if (incomingConversationId !== selectedConversation.id || senderId === user.id) return;
          setOtherTyping(isTyping);
        })
        .subscribe();
      typingChannelRef.current = typingChannel;

      const intervalId = setInterval(() => {
        loadChatMessages().catch(() => {});
      }, 7000);

      return () => {
        supabase.removeChannel(dataChannel);
        supabase.removeChannel(typingChannel);
        clearInterval(intervalId);
      };
    }
  }, [selectedConversation?.id, user?.id, loadChatMessages, scheduleRefresh]);

  async function sendTyping(isTyping) {
    if (!typingChannelRef.current || !selectedConversation?.id || !user?.id) return;

    const payload = {
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      is_typing: isTyping,
    };

    try {
      await typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload,
      });
    } catch {
      // Typing indicator is best-effort
    }
  }

  async function handleSendMessage() {
    if (!canSend || !selectedConversation?.id) return;

    if (pendingAttachment && pendingAttachment.currentChatId !== selectedConversation.id) {
      console.error("Security Alert: Attachment belongs to a different chat!");
      setPendingAttachment(null);
      return;
    }

    const content = chatInput.trim();
    setChatInput('');
    setChatSending(true);

    try {
      await sendTyping(false);
      
      if (pendingAttachment) {
        await messagingApi.sendMessageWithAttachment({ 
          conversationId: selectedConversation.id, 
          content, 
          attachment: pendingAttachment 
        });
        setPendingAttachment(null);
      } else {
        await messagingApi.sendMessage({ conversationId: selectedConversation.id, content });
      }
      
      await loadChatMessages();
    } catch (error) {
      console.error('Send error:', error);
      setChatInput(content);
    } finally {
      setChatSending(false);
    }
  }

  function onChangeInput(value) {
    setChatInput(value);

    if (!selectedConversation?.id || !user?.id) return;

    sendTyping(Boolean(value.trim())).catch(() => {});

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      sendTyping(false).catch(() => {});
    }, 1200);
  }

  const unreadTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.unread_count || 0), 0),
    [rows]
  );

  return (
    <>
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 10,
              borderBottomColor: C.border,
              backgroundColor: C.headerBg,
            },
          ]}
        >
          <View style={styles.headerTop}>
            <Text style={[styles.heading, { color: C.tint }]}>{t.inbox || 'Messages'}</Text>
            {unreadTotal > 0 && (
              <View style={[styles.totalBadge, { backgroundColor: C.accentLight }]}>
                <Text style={[styles.totalBadgeText, { color: C.accent }]}>{unreadTotal} unread</Text>
              </View>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: C.card, borderColor: C.border },
                  pressed && { opacity: 0.82 },
                ]}
                onPress={() => setSelectedConversation(item)}
              >
                <ProfileImage 
                  url={item.other_participant?.profile_photo_url} 
                  size={42} 
                  fallbackText={item.other_participant?.initials || item.other_participant?.full_name?.charAt(0) || '?'}
                />

                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowName, { color: C.foreground }]} numberOfLines={1}>
                      {item.other_participant?.full_name || 'Lawyer'}
                    </Text>
                    <Text style={[styles.rowTime, { color: C.mutedForeground }]}>
                      {formatTimestamp(item.last_message_at)}
                    </Text>
                  </View>
                  <Text style={[styles.rowPreview, { color: C.textSecondary }]} numberOfLines={1}>
                    {Boolean(typingByConversation[item.id])
                      ? 'Typing...'
                      : item.last_message_preview?.trim() || 'No messages yet'}
                  </Text>
                </View>

                {Number(item.unread_count || 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: C.tint }]}>
                    <Text style={[styles.badgeText, { color: C.primaryForeground }]}>
                      {Number(item.unread_count) > 9 ? '9+' : item.unread_count}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
            contentContainerStyle={rows.length ? styles.listContent : styles.emptyContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadConversations(true)}
                tintColor={C.accent}
              />
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="chatbubble-ellipses-outline" size={44} color={C.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: C.foreground }]}>No conversations yet</Text>
                <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                  Hire a lawyer to start messaging
                </Text>
              </View>
            }
          />
        )}
      </View>

      <Modal
        visible={Boolean(selectedConversation)}
        animationType="slide"
        onRequestClose={() => setSelectedConversation(null)}
        presentationStyle="overFullScreen"
      >
        <View style={[styles.container, { backgroundColor: C.background }]}>
          <View
            style={[
              styles.chatHeader,
              {
                backgroundColor: C.headerBg,
                borderBottomColor: C.border,
                paddingTop: insets.top,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setSelectedConversation(null)}
            >
              <Ionicons name="chevron-back" size={24} color={C.tint} />
            </Pressable>
            <View style={styles.chatHeaderContent}>
              <Text style={[styles.chatHeaderTitle, { color: C.foreground }]}>
                {selectedConversation?.other_participant?.full_name || 'Chat'}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {chatLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={C.accent} />
            </View>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.messagesContent}
                onRefresh={() => loadChatMessages({ isRefresh: true })}
                refreshing={chatRefreshing}
                renderItem={({ item }) => {
                  const mine = item.sender_id === user?.id;
                  const isImage = item.message_type === 'image';
                  const isFile  = item.message_type === 'file';
                  const hasAttachment = isImage || isFile;
                  return (
                    <View style={[styles.msgRow, mine ? styles.mineRow : styles.theirRow]}>
                      <View
                        style={[
                          styles.msgBubble,
                          mine
                            ? { backgroundColor: C.tint }
                            : { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 },
                          hasAttachment && { paddingHorizontal: 8, paddingVertical: 8 },
                        ]}
                      >
                        {/* ── Image attachment ── */}
                        {isImage && item.attachment_url ? (
                          <Pressable
                            onPress={() => setPreviewImageUrl(item.attachment_url)}
                            style={styles.imageWrapper}
                          >
                            <Image
                              source={{ uri: item.attachment_url }}
                              style={styles.attachedImage}
                              resizeMode="cover"
                            />
                            <View style={styles.expandHint}>
                              <Ionicons name="expand-outline" size={13} color="rgba(255,255,255,0.9)" />
                            </View>
                          </Pressable>
                        ) : null}

                        {/* ── File attachment ── */}
                        {isFile && item.attachment_url ? (
                          <Pressable
                            onPress={() => Linking.openURL(item.attachment_url).catch(() => {})}
                            style={[
                              styles.fileRow,
                              { backgroundColor: mine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' },
                            ]}
                          >
                            <Ionicons name="document-text-outline" size={20} color={mine ? '#fff' : C.foreground} />
                            <Text
                              style={[styles.fileName, { color: mine ? '#fff' : C.foreground }]}
                              numberOfLines={2}
                            >
                              {item.attachment_name || 'Attachment'}
                            </Text>
                            <Ionicons
                              name="download-outline"
                              size={16}
                              color={mine ? 'rgba(255,255,255,0.7)' : C.mutedForeground}
                            />
                          </Pressable>
                        ) : null}

                        {/* ── Text content ── */}
                        {item.content ? (
                          <Text
                            style={[
                              styles.msgText,
                              { color: mine ? C.primaryForeground : C.foreground },
                              hasAttachment && { paddingHorizontal: 4, marginTop: 4 },
                            ]}
                          >
                            {item.content}
                          </Text>
                        ) : null}

                        <View style={styles.metaRow}>
                          <Text
                            style={[
                              styles.time,
                              { color: mine ? C.primaryForeground : C.mutedForeground },
                            ]}
                          >
                            {formatTime(item.created_at)}
                          </Text>
                          {mine && <Receipt readByAll={Boolean(item.read_by_all)} color={C.primaryForeground} />}
                        </View>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Ionicons name="chatbubble-ellipses-outline" size={40} color={C.mutedForeground} />
                    <Text style={[styles.emptyText, { color: C.textSecondary }]}>No messages yet</Text>
                  </View>
                }
              />

              <View
                style={[
                  styles.inputBar,
                  {
                    borderTopColor: C.border,
                    backgroundColor: C.headerBg,
                    paddingBottom: insets.bottom || 10,
                  },
                ]}
              >
                {pendingAttachment && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.muted, padding: 8, borderRadius: 8, marginBottom: 4, alignSelf: 'flex-start' }}>
                    <Ionicons name={pendingAttachment.type.includes('image') ? 'image' : 'document-text'} size={20} color={C.foreground} />
                    <Text style={{ marginLeft: 8, color: C.foreground, maxWidth: 200 }} numberOfLines={1}>{pendingAttachment.name}</Text>
                    <Pressable onPress={() => setPendingAttachment(null)} style={{ marginLeft: 8 }}>
                      <Ionicons name="close-circle" size={20} color={C.tint} />
                    </Pressable>
                  </View>
                )}

                {otherTyping && (
                  <View style={styles.typingIndicator}>
                    <Text style={[styles.typingText, { color: C.mutedForeground }]}>
                      Lawyer is typing
                    </Text>
                    <View style={styles.dots}>
                      <View style={[styles.dot, { backgroundColor: C.mutedForeground }]} />
                      <View style={[styles.dot, { backgroundColor: C.mutedForeground }]} />
                      <View style={[styles.dot, { backgroundColor: C.mutedForeground }]} />
                    </View>
                  </View>
                )}

                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: C.inputBg || C.muted, borderColor: C.border },
                  ]}
                >
                  <Pressable onPress={pickImage} style={{ padding: 4 }}>
                    <Ionicons name="image-outline" size={22} color={C.mutedForeground} />
                  </Pressable>
                  <Pressable onPress={pickDocument} style={{ padding: 4 }}>
                    <Ionicons name="document-attach-outline" size={22} color={C.mutedForeground} />
                  </Pressable>
                  <TextInput
                    style={[styles.input, { color: C.foreground }]}
                    placeholder="Type a message..."
                    placeholderTextColor={C.mutedForeground}
                    value={chatInput}
                    onChangeText={onChangeInput}
                    editable={!chatSending}
                    multiline
                    maxLength={1000}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendBtn,
                      { backgroundColor: C.tint },
                      (!canSend || pressed) && { opacity: 0.7 },
                    ]}
                    onPress={handleSendMessage}
                    disabled={!canSend}
                  >
                    {chatSending ? (
                      <ActivityIndicator size="small" color={C.primaryForeground} />
                    ) : (
                      <Ionicons name="send" size={18} color={C.primaryForeground} />
                    )}
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      {/* Full-screen image preview */}
      <ImagePreviewModal uri={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heading: { fontSize: 28, fontFamily: 'PlayfairDisplay_700Bold' },
  totalBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  totalBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 32 },
  listContent: { padding: 16, gap: 10 },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  rowTime: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rowPreview: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  badge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, minWidth: 24, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Chat modal styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8, alignItems: 'center', justifyContent: 'center' },
  chatHeaderContent: { flex: 1, alignItems: 'center' },
  chatHeaderTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  messagesContent: { paddingVertical: 12, paddingHorizontal: 12 },
  msgRow: { marginVertical: 6, flexDirection: 'row', gap: 8 },
  mineRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  msgBubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '75%' },
  msgText: { fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  time: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  inputBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4 },
  typingText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 8 },
  sendBtn: { padding: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  // ── Attachment rendering ──
  imageWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  attachedImage: {
    width: 210,
    height: 150,
    borderRadius: 10,
  },
  expandHint: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    padding: 3,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
});
