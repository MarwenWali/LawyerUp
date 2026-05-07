import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/constants/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/src/hooks/useMessages';
import { useSocket } from '@/src/hooks/useSocket';
import { MessageBubble } from '@/src/components/MessageBubble';
import { TypingIndicator } from '@/src/components/TypingIndicator';
import { messagingApi } from '@/services/messagingApi';

function formatDateLabel(value) {
  const date = new Date(value);
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
      <View style={modalStyles.overlay}>
        <Pressable style={modalStyles.closeBtn} onPress={onClose} hitSlop={16}>
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

const modalStyles = StyleSheet.create({
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

function buildGroupedItems(messages) {
  const items = [];
  let currentLabel = '';

  for (const message of messages) {
    const label = formatDateLabel(message.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      items.push({
        type: 'date',
        id: `date-${label}-${message.id}`,
        label,
      });
    }

    items.push({
      type: 'message',
      id: message.id || message.client_message_id,
      message,
    });
  }

  return items;
}

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const conversationId = String(params.conversationId || params.id || '');
  const titleParam = String(params.title || 'Conversation');
  const isUserChat = params.isUserChat === 'true';
  const isAdminChat = params.isAdminChat === 'true';
  const listRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [uploadingSending, setUploadingSending] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null); // image viewer

  const {
    conversation,
    messages,
    loading,
    refreshing,
    sending,
    error,
    isTyping,
    isOtherOnline,
    refreshMessages,
    sendMessage,
    sendTyping,
  } = useMessages(conversationId);

  const { connectionStatus } = useSocket();

  const participant = conversation?.other_participant || conversation?.citizen || conversation?.lawyer || {};
  const participantRole = participant?.role || conversation?.other_participant_role || 'unknown';

  useEffect(() => {
    if (conversationId && participant) {
      console.log(`ChatScreen - Conversation ${conversationId}:`, {
        participantName: participant.name || participant.full_name,
        participantRole,
        isUserChat,
        isAdminChat,
        currentUserRole: user?.role,
      });

      if (isUserChat && participantRole === 'admin') {
        console.error('Conversation type mismatch: Expected user chat but got admin conversation');
      }
      if (isAdminChat && participantRole !== 'admin') {
        console.error('Conversation type mismatch: Expected admin chat but got non-admin conversation');
      }
    }
  }, [conversationId]);

  const groupedItems = useMemo(() => buildGroupedItems(messages), [messages]);
  const title = participant.name || titleParam;
  const subtitle = participant.specialization
    ? participant.specialization
    : isOtherOnline
      ? 'Online now'
      : 'Secure legal messaging';

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [groupedItems.length, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }
    };
  }, []);

  // ── Attachment pickers ─────────────────────────────────────────────────────
  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow access to your photos to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setPendingAttachment({
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'photo.jpg',
          type: asset.mimeType || 'image/jpeg',
          conversationId,
        });
      }
    } catch (e) {
      console.error('pickImage error:', e);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setPendingAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
          conversationId,
        });
      }
    } catch (e) {
      console.error('pickDocument error:', e);
    }
  };

  const handleChangeText = useCallback((value) => {
    setDraft(value);
    sendTyping(Boolean(value.trim()));

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      sendTyping(false);
    }, 1100);
  }, [sendTyping]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    const hasAttachment = Boolean(pendingAttachment);

    if ((!content && !hasAttachment) || sending || uploadingSending) return;

    sendTyping(false);
    setDraft('');

    // Guard: attachment must belong to this conversation
    if (hasAttachment && pendingAttachment.conversationId !== conversationId) {
      Alert.alert('Error', 'Attachment belongs to a different conversation.');
      setPendingAttachment(null);
      return;
    }

    const attachmentToSend = pendingAttachment;
    setPendingAttachment(null);

    try {
      if (attachmentToSend) {
        setUploadingSending(true);
        await messagingApi.sendMessageWithAttachment({
          conversationId,
          content,
          attachment: attachmentToSend,
        });
        await refreshMessages();
      } else {
        await sendMessage(content);
      }
      scrollToBottom(true);
    } catch (err) {
      console.error('Send error:', err);
      if (!attachmentToSend) setDraft(content);
      else setPendingAttachment(attachmentToSend);
      Alert.alert('Failed to send', err?.message || 'Please try again.');
    } finally {
      setUploadingSending(false);
    }
  }, [
    conversationId,
    draft,
    pendingAttachment,
    refreshMessages,
    scrollToBottom,
    sendMessage,
    sendTyping,
    sending,
    uploadingSending,
  ]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateWrap}>
          <View style={[styles.datePill, { backgroundColor: C.muted }]}>
            <Text style={[styles.dateText, { color: C.mutedForeground }]}>{item.label}</Text>
          </View>
        </View>
      );
    }

    return (
      <MessageBubble
        message={item.message}
        isOwn={item.message.sender_id === user?.id}
        theme={C}
        onImagePress={setPreviewImageUrl}
      />
    );
  }, [C, user?.id, setPreviewImageUrl]);

  const isSendingAny = sending || uploadingSending;
  const canSend = (Boolean(draft.trim()) || Boolean(pendingAttachment)) && !isSendingAny;

  if (!conversationId) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={[styles.errorTitle, { color: C.foreground }]}>Conversation not found</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: C.tint }]} onPress={() => router.back()}>
          <Text style={[styles.retryText, { color: C.primaryForeground }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ImagePreviewModal uri={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
      <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.headerBg, borderBottomColor: C.border, paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: C.card }]}>
          <Ionicons name="arrow-back" size={22} color={C.foreground} />
        </Pressable>
        <View style={styles.headerBody}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: C.foreground }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={[styles.liveDot, { backgroundColor: isOtherOnline ? C.success : C.mutedForeground }]} />
          </View>
          <Text style={[styles.subtitle, { color: C.mutedForeground }]} numberOfLines={1}>
            {isTyping ? 'Typing...' : subtitle}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: connectionStatus === 'connected' ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)' }]}>
          {loading ? (
            <ActivityIndicator size="small" color={C.tint} />
          ) : (
            <Text style={[styles.statusText, { color: connectionStatus === 'connected' ? C.success : C.warning }]}>
              {connectionStatus === 'connected' ? 'Live' : 'Syncing'}
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        {error ? (
          <View style={styles.center}>
            <View style={[styles.errorIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Ionicons name="alert-circle-outline" size={30} color={C.destructive} />
            </View>
            <Text style={[styles.errorTitle, { color: C.foreground }]}>Unable to load chat</Text>
            <Text style={[styles.errorText, { color: C.mutedForeground }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: C.tint }]} onPress={refreshMessages}>
              <Text style={[styles.retryText, { color: C.primaryForeground }]}>Retry</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.tint} />
            <Text style={[styles.loadingText, { color: C.mutedForeground }]}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={groupedItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesContent}
            refreshing={refreshing}
            onRefresh={() => refreshMessages().catch(() => {})}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={isTyping ? <TypingIndicator theme={C} /> : <View style={{ height: 6 }} />}
            onContentSizeChange={() => scrollToBottom(false)}
          />
        )}

        {/* ── Pending attachment preview ── */}
        {pendingAttachment ? (
          <View style={[styles.attachmentPreview, { backgroundColor: C.muted }]}>
            <Ionicons
              name={pendingAttachment.type?.startsWith('image/') ? 'image' : 'document-text'}
              size={20}
              color={C.tint}
            />
            <Text style={[styles.attachmentPreviewName, { color: C.foreground }]} numberOfLines={1}>
              {pendingAttachment.name || 'Attachment'}
            </Text>
            <Pressable onPress={() => setPendingAttachment(null)}>
              <Ionicons name="close-circle" size={20} color={C.destructive || '#EF4444'} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.inputBar, { backgroundColor: C.headerBg, borderTopColor: C.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
          {/* ── Attachment buttons ── */}
          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons name="image-outline" size={24} color={C.tint} />
          </Pressable>
          <Pressable
            onPress={pickDocument}
            style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons name="document-attach-outline" size={24} color={C.tint} />
          </Pressable>

          <View style={[styles.inputWrap, { backgroundColor: C.background, borderColor: C.border }]}>
            <TextInput
              value={draft}
              onChangeText={handleChangeText}
              placeholder="Write a message"
              placeholderTextColor={C.mutedForeground}
              style={[styles.input, { color: C.foreground }]}
              multiline
              editable={!isSendingAny}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: C.tint },
              !canSend && { opacity: 0.45 },
              pressed && canSend && { opacity: 0.9 },
            ]}
          >
            {isSendingAny ? (
              <ActivityIndicator color={C.primaryForeground} />
            ) : (
              <Ionicons name="send" size={18} color={C.primaryForeground} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  keyboardWrap: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  dateWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  datePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  // ── Attachment preview strip ──
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  attachmentPreviewName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  // ── Input bar ──
  inputBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  attachBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 46,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    maxHeight: 120,
    minHeight: 28,
    paddingVertical: 2,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
