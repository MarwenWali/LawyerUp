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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { supabase } from '@/utils/supabase';
import { messagingApi } from '@/services/messagingApi';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

function formatTime(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalizeMessages(input) {
  const raw = Array.isArray(input) ? input : [];
  return [...raw]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((msg) => ({
      ...msg,
      id: msg.id,
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
      color={readByAll ? color : '#9ca3af'}
      style={{ marginLeft: 4 }}
    />
  );
}

export default function LawyerInboxChatPage() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const C = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const typingTimerRef = useRef(null);
  const typingChannelRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const loadVersionRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const conversationId = String(params.conversationId || '');
  const title = String(params.title || 'Conversation');

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null); // ← image viewer

  const canSend = useMemo(() => (Boolean(input.trim()) || pendingAttachment) && !sending, [input, sending, pendingAttachment]);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        alert('Permission needed', 'Permission to access the camera roll is required!');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        setPendingAttachment({
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'screenshot.jpg',
          type: asset.mimeType || 'image/jpeg',
          currentChatId: conversationId,
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
          currentChatId: conversationId,
        });
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const loadMessages = useCallback(async ({ isRefresh = false } = {}) => {
    if (!conversationId) return;
    const loadVersion = ++loadVersionRef.current;

    if (isRefresh) setRefreshing(true);
    else if (!hasLoadedRef.current) setLoading(true);

    try {
      const payload = await messagingApi.listMessages(conversationId, { limit: 50 });
      if (loadVersion !== loadVersionRef.current) return;

      const normalized = normalizeMessages(payload?.messages);
      setMessages(normalized);
      hasLoadedRef.current = true;

      const hasUnreadIncoming = normalized.some(
        (item) => item.sender_id !== user?.id && !item.read_by_me
      );

      if (hasUnreadIncoming && user?.id) {
        try {
          await messagingApi.markConversationRead(conversationId);
          if (loadVersion !== loadVersionRef.current) return;
          setMessages((prev) =>
            prev.map((item) => (
              item.sender_id === user.id ? item : { ...item, read_by_me: true }
            ))
          );
        } catch (markError) {
          console.warn('Mark read error:', markError);
        }
      }
    } catch (error) {
      console.error('Chat load error:', error);
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    hasLoadedRef.current = false;
    setMessages([]);
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        loadMessages().catch(() => { });
      }, 140);
    };

    const dataChannel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
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

        if (incomingConversationId !== conversationId || senderId === user.id) return;
        setOtherTyping(isTyping);
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    const intervalId = setInterval(() => {
      loadMessages().catch(() => { });
    }, 7000);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      typingChannelRef.current = null;
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(typingChannel);
      clearInterval(intervalId);
    };
  }, [conversationId, loadMessages, user?.id]);

  const sendTyping = useCallback(async (isTyping) => {
    if (!conversationId || !user?.id) return;
    const channel = typingChannelRef.current;
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        conversation_id: conversationId,
        sender_id: user.id,
        is_typing: isTyping,
      },
    });
  }, [conversationId, user?.id]);

  async function handleSend() {
    if (!canSend || !conversationId) return;

    if (pendingAttachment && pendingAttachment.currentChatId !== conversationId) {
      Alert.alert('Error', 'Attachment belongs to a different chat.');
      setPendingAttachment(null);
      return;
    }

    const content = input.trim();
    const attachmentToSend = pendingAttachment;
    setInput('');
    setPendingAttachment(null);
    setSending(true);

    try {
      await sendTyping(false);
      
      if (attachmentToSend) {
        await messagingApi.sendMessageWithAttachment({ 
          conversationId, 
          content, 
          attachment: attachmentToSend,
        });
      } else {
        await messagingApi.sendMessage({ conversationId, content });
      }
      
      await loadMessages();
    } catch (error) {
      console.error('Send error:', error);
      setInput(content);
      if (attachmentToSend) setPendingAttachment(attachmentToSend);
      Alert.alert('Failed to send', error?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  function onChangeInput(value) {
    setInput(value);

    if (!conversationId || !user?.id) return;

    sendTyping(Boolean(value.trim())).catch(() => { });

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      sendTyping(false).catch(() => { });
    }, 1200);
  }

  return (
    <>
      <ImagePreviewModal uri={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: C.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.header, { paddingTop: insets.top + 2, borderBottomColor: C.border, backgroundColor: C.headerBg }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.tint} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: C.foreground }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>{otherTyping ? 'Typing...' : 'Secure in-app chat'}</Text>
        </View>
      </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.messages}
            onRefresh={() => loadMessages({ isRefresh: true })}
            refreshing={refreshing}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              const isImage = item.message_type === 'image';
              const isFile = item.message_type === 'file';
              const hasAttachment = isImage || isFile;
              return (
                <View style={[styles.msgRow, mine ? styles.mineRow : styles.theirRow]}>
                  <View
                    style={[
                      styles.msgBubble,
                      mine ? { backgroundColor: C.tint } : { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 },
                      hasAttachment && { paddingHorizontal: 8, paddingVertical: 8 },
                    ]}
                  >
                    {/* Image attachment — tap to open full-screen viewer */}
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
                          <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.9)" />
                        </View>
                      </Pressable>
                    ) : null}
                    {/* File attachment */}
                    {isFile && item.attachment_url ? (
                      <Pressable
                        onPress={() => Linking.openURL(item.attachment_url).catch(() => {})}
                        style={[styles.fileRow, { backgroundColor: mine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}
                      >
                        <Ionicons name="document-text-outline" size={20} color={mine ? '#fff' : C.foreground} />
                        <Text style={[styles.fileName, { color: mine ? '#fff' : C.foreground }]} numberOfLines={2}>
                          {item.attachment_name || 'Attachment'}
                        </Text>
                        <Ionicons name="download-outline" size={16} color={mine ? 'rgba(255,255,255,0.7)' : C.mutedForeground} />
                      </Pressable>
                    ) : null}
                    {/* Text content */}
                    {item.content ? (
                      <Text style={[styles.msgText, { color: mine ? C.primaryForeground : C.foreground, paddingHorizontal: hasAttachment ? 4 : 0 }]}>{item.content}</Text>
                    ) : null}
                    <View style={styles.metaRow}>
                      <Text style={[styles.time, { color: mine ? C.primaryForeground : C.mutedForeground }]}>{formatTime(item.created_at)}</Text>
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
        )}

        <View style={{ borderTopColor: C.border, borderTopWidth: 2, backgroundColor: C.headerBg, paddingBottom: isKeyboardVisible ? 10 : tabBarHeight }}>
          {pendingAttachment && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.muted, padding: 8, borderRadius: 8, marginTop: 8, marginHorizontal: 12, alignSelf: 'flex-start' }}>
              <Ionicons name={pendingAttachment.type?.includes('image') ? 'image' : 'document-text'} size={20} color={C.foreground} />
              <Text style={{ marginLeft: 8, color: C.foreground, maxWidth: 200 }} numberOfLines={1}>{pendingAttachment.name || 'Attachment'}</Text>
              <Pressable onPress={() => setPendingAttachment(null)} style={{ marginLeft: 8 }}>
                <Ionicons name="close-circle" size={20} color={C.tint} />
              </Pressable>
            </View>
          )}
          <View style={[styles.inputBar, { borderTopWidth: 0, paddingBottom: 0, paddingVertical: 12 }]}>
            <Pressable onPress={pickImage} style={{ padding: 4, marginBottom: 4 }}>
              <Ionicons name="image-outline" size={26} color={C.mutedForeground} />
            </Pressable>
            <Pressable onPress={pickDocument} style={{ padding: 4, marginBottom: 4 }}>
              <Ionicons name="document-attach-outline" size={26} color={C.mutedForeground} />
            </Pressable>
            <TextInput
              style={[styles.input, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
              placeholder="Type a message"
              placeholderTextColor={C.mutedForeground}
              value={input}
              onChangeText={onChangeInput}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            <Pressable
              style={({ pressed }) => [styles.sendBtn, { backgroundColor: C.tint }, (!canSend || pressed) && { opacity: 0.7 }]}
              onPress={handleSend}
              disabled={!canSend}
            >
              {sending ? <ActivityIndicator size="small" color={C.primaryForeground} /> : <Ionicons name="send" size={18} color={C.primaryForeground} />}
            </Pressable>
          </View>
        </View>
    </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  messages: {
    padding: 10,
    gap: 8,
  },
  msgRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '84%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  msgText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  time: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  // ── Attachment ──
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
    bottom: 6,
    right: 6,
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
  inputBar: {
    borderTopWidth: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
