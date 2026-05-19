// ── FULL REWRITE: chat with session history ──────────────────────────────────
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList,
  Platform, KeyboardAvoidingView, ActivityIndicator, Alert, Keyboard,
  Image, Linking, Modal, Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AI_SUGGESTED_QUESTIONS } from '@/constants/mockData';
import { chatApi } from '@/services/api';

/** Full-screen image preview modal */
function ImagePreviewModal({ uri, onClose }) {
  const { width, height } = Dimensions.get('window');
  return (
    <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={previewStyles.overlay}>
        <Pressable style={previewStyles.closeBtn} onPress={onClose} hitSlop={16}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {uri ? <Image source={{ uri }} style={{ width, height: height * 0.85 }} resizeMode="contain" /> : null}
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 52, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 6 },
});

function MessageBubble({ msg, C, isDark, onImagePress }) {
  const isUser = msg.sender === 'user';
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.aiAvatar, { backgroundColor: C.muted }]}>
          <Ionicons name="scale" size={16} color={C.accent} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? [styles.bubbleUser, { backgroundColor: C.chatUser }] : [styles.bubbleAi, { backgroundColor: C.chatAi }]]}>
        {msg.message_type === 'image' && msg.attachment_url && (
          <Pressable onPress={() => onImagePress(msg.attachment_url)} style={{ marginBottom: msg.content ? 8 : 0 }}>
            <Image source={{ uri: msg.attachment_url }} style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: C.muted }} />
            <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 12 }}>
              <Ionicons name="expand" size={16} color="#fff" />
            </View>
          </Pressable>
        )}

        {msg.message_type === 'file' && msg.attachment_url && (
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isUser ? 'rgba(0,0,0,0.1)' : C.card, padding: 12, borderRadius: 12, marginBottom: msg.content ? 8 : 0 }}
            onPress={() => Linking.openURL(msg.attachment_url)}
          >
            <View style={{ backgroundColor: isUser ? 'rgba(0,0,0,0.1)' : C.background, padding: 8, borderRadius: 8, marginRight: 12 }}>
              <Ionicons name="document-text" size={24} color={isUser ? (isDark ? '#0B1120' : '#FDF6E3') : C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: isUser ? (isDark ? '#0B1120' : '#FDF6E3') : C.foreground, fontWeight: '600' }} numberOfLines={1}>{msg.attachment_name}</Text>
              <Text style={{ color: isUser ? (isDark ? 'rgba(11,17,32,0.7)' : 'rgba(253,246,227,0.7)') : C.mutedForeground, fontSize: 12 }}>Tap to view</Text>
            </View>
          </Pressable>
        )}

        {!!msg.content && (
          <Text style={[styles.bubbleText, isUser ? { color: isDark ? '#0B1120' : '#FDF6E3' } : { color: C.foreground }]}>{msg.content}</Text>
        )}
      </View>
    </Animated.View>
  );
}

function TypingIndicator({ C }) {
  return (
    <View style={[styles.bubbleRow]}>
      <View style={[styles.aiAvatar, { backgroundColor: C.muted }]}>
        <Ionicons name="scale" size={16} color={C.accent} />
      </View>
      <View style={[styles.bubble, styles.bubbleAi, styles.typingBubble, { backgroundColor: C.chatAi }]}>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map(i => (
            <Animated.View key={i} entering={FadeIn.delay(i * 200).duration(300)} style={[styles.dot, { backgroundColor: C.mutedForeground }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Session list item ────────────────────────────────────────────────────────
function SessionItem({ session, onOpen, onDelete, C }) {
  const date = new Date(session.updated_at);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const dateStr = isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <Pressable
      style={({ pressed }) => [styles.sessionRow, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.75 }]}
      onPress={() => onOpen(session)}
      onLongPress={() => onDelete(session.id)}
    >
      <View style={[styles.sessionIcon, { backgroundColor: C.accentLight }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sessionTitle, { color: C.foreground }]} numberOfLines={1}>{session.title}</Text>
        {session.last_message ? (
          <Text style={[styles.sessionPreview, { color: C.textSecondary }]} numberOfLines={1}>{session.last_message}</Text>
        ) : null}
      </View>
      <View style={styles.sessionMeta}>
        <Text style={[styles.sessionDate, { color: C.mutedForeground }]}>{dateStr}</Text>
        {session.message_count > 0 && (
          <Text style={[styles.sessionCount, { color: C.mutedForeground }]}>{session.message_count} msgs</Text>
        )}
      </View>
    </Pressable>
  );
}

// ── Main page component ──────────────────────────────────────────────────────
export default function ChatPage() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const C = useTheme();
  const { t } = useLanguage();
  const { isDark } = useThemeContext();

  // view: 'loading' | 'history' | 'chat'
  const [view, setView] = useState('loading');
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [previewImageUri, setPreviewImageUri] = useState(null);
  const flatListRef = useRef(null);

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

  // ── Session management ─────────────────────────────────────────────────
  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    try {
      const data = await chatApi.getSessions();
      setSessions(data.sessions);
      if (data.sessions.length > 0) {
        await openSession(data.sessions[0]);
      } else {
        await startNewChat();
      }
    } catch (e) {
      console.error('loadSessions:', e);
      setView('history');
    }
  }

  async function openSession(session) {
    setActiveSession(session);
    setView('chat');
    setLoadingMsgs(true);
    try {
      const data = await chatApi.getMessages(session.id);
      setMessages(data.messages.length === 0
        ? [{ id: '__welcome__', sender: 'ai', content: t.aiWelcome, created_at: new Date().toISOString() }]
        : data.messages
      );
    } catch {
      setMessages([{ id: '__welcome__', sender: 'ai', content: t.aiWelcome, created_at: new Date().toISOString() }]);
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function startNewChat() {
    setCreating(true);
    try {
      const data = await chatApi.createSession('New Chat');
      const newSess = data.session;
      setSessions(prev => [newSess, ...prev]);
      await openSession(newSess);
    } catch {
      Alert.alert('Error', 'Failed to create new chat. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function confirmDelete(sessionId) {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Chat', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await chatApi.deleteSession(sessionId);
            const remaining = sessions.filter(s => s.id !== sessionId);
            setSessions(remaining);
            if (activeSession?.id === sessionId) {
              setActiveSession(null);
              setMessages([]);
              setView('history');
            }
          } catch { Alert.alert('Error', 'Failed to delete chat.'); }
        }
      },
    ]);
  }

  // ── Messaging ──────────────────────────────────────────────────────────
  const pickImage = async () => {
    if (isTyping) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPendingAttachment({
        uri: result.assets[0].uri,
        type: result.assets[0].mimeType || 'image/jpeg',
        name: result.assets[0].fileName || 'image.jpg',
      });
    }
  };

  const pickDocument = async () => {
    if (isTyping) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      setPendingAttachment({
        uri: result.assets[0].uri,
        type: result.assets[0].mimeType || 'application/pdf',
        name: result.assets[0].name || 'document.pdf',
      });
    }
  };

  const sendMessage = useCallback(async (text) => {
    const hasText = text.trim().length > 0;
    if ((!hasText && !pendingAttachment) || isTyping || !activeSession) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isFirstUserMsg = !messages.some(m => m.sender === 'user');
    
    // Optimistic user message
    const userMsg = { 
      id: Date.now().toString(), 
      content: text.trim(), 
      sender: 'user', 
      created_at: new Date().toISOString(),
      message_type: pendingAttachment ? (pendingAttachment.type.startsWith('image/') ? 'image' : 'file') : 'text',
      attachment_url: pendingAttachment?.uri,
      attachment_name: pendingAttachment?.name,
    };

    setMessages(prev => [...prev.filter(m => m.id !== '__welcome__'), userMsg]);
    setInput('');
    const currentAttachment = pendingAttachment;
    setPendingAttachment(null);
    setIsTyping(true);

    // Auto-title from first message
    if (isFirstUserMsg) {
      const newTitle = (hasText ? text.trim() : currentAttachment.name).slice(0, 60);
      try {
        await chatApi.updateTitle(activeSession.id, newTitle);
        setActiveSession(prev => ({ ...prev, title: newTitle }));
        setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, title: newTitle } : s));
      } catch {}
    }

    try {
      const payload = await chatApi.askAssistant(activeSession.id, text.trim(), currentAttachment);
      // Replace optimistic message if real one was returned
      if (payload?.userMessage) {
        setMessages(prev => prev.map(m => m.id === userMsg.id ? payload.userMessage : m));
      }
      
      const aiMsg = payload?.aiMessage || {
        id: (Date.now() + 1).toString(),
        content: 'AI assistant is temporarily unavailable. Please try again.',
        sender: 'ai',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      const data = await chatApi.getSessions();
      setSessions(data.sessions);
    } catch (e) {
      console.error('askAssistant:', e);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        content: e?.message || 'AI assistant is temporarily unavailable. Please try again.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping, activeSession, pendingAttachment]);

  const showSuggestions = !messages.some(m => m.sender === 'user') && !isTyping;
  const renderMsg = useCallback(({ item }) => <MessageBubble msg={item} C={C} isDark={isDark} onImagePress={setPreviewImageUri} />, [C, isDark]);

  // ── VIEW: LOADING ──────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={{ color: C.textSecondary, marginTop: 12, fontFamily: 'Inter_400Regular' }}>{t.loadingChats}</Text>
      </View>
    );
  }

  // ── VIEW: HISTORY ──────────────────────────────────────────────────────
  if (view === 'history') {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.historyHeader, { paddingTop: insets.top + 8, backgroundColor: C.headerBg, borderBottomColor: C.border }]}>
          <Text style={[styles.historyTitle, { color: C.tint }]}>{t.chatHistory}</Text>
          <Pressable
            style={({ pressed }) => [styles.newChatBtn, { backgroundColor: C.tint }, pressed && { opacity: 0.8 }, creating && { opacity: 0.5 }]}
            onPress={startNewChat} disabled={creating}
          >
            {creating
              ? <ActivityIndicator size="small" color={C.primaryForeground} />
              : <><Feather name="plus" size={16} color={C.primaryForeground} /><Text style={[styles.newChatBtnText, { color: C.primaryForeground }]}>{t.newChat}</Text></>
            }
          </Pressable>
        </View>

        {sessions.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="chatbubbles-outline" size={64} color={C.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: C.foreground }]}>{t.noChatsYetTitle}</Text>
            <Text style={[styles.emptySubtitle, { color: C.textSecondary }]}>{t.startConversationWithAI}</Text>
            <Pressable
              style={({ pressed }) => [styles.emptyNewBtn, { backgroundColor: C.tint }, pressed && { opacity: 0.8 }]}
              onPress={startNewChat} disabled={creating}
            >
              {creating
                ? <ActivityIndicator size="small" color={C.primaryForeground} />
                : <Text style={[styles.newChatBtnText, { color: C.primaryForeground }]}>{t.startChat}</Text>}
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <SessionItem session={item} onOpen={openSession} onDelete={confirmDelete} C={C} />
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 10 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={[styles.historyHint, { color: C.mutedForeground }]}>{t.chatHint}</Text>
            }
          />
        )}
      </View>
    );
  }

  // ── VIEW: CHAT ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ImagePreviewModal uri={previewImageUri} onClose={() => setPreviewImageUri(null)} />
      <View style={[styles.chatHeader, { paddingTop: insets.top + 8, backgroundColor: C.headerBg, borderBottomColor: C.border }]}>
        <Pressable style={styles.backBtn} onPress={() => setView('history')}>
          <Ionicons name="arrow-back" size={22} color={C.tint} />
        </Pressable>
        <View style={styles.chatHeaderCenter}>
          <View style={[styles.chatHeaderAvatar, { backgroundColor: C.muted }]}>
            <Ionicons name="scale" size={18} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.chatHeaderTitle, { color: C.foreground }]} numberOfLines={1}>
              {activeSession?.title || 'AI Legal Assistant'}
            </Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={[styles.statusText, { color: C.textSecondary }]}>{t.specializedIn}</Text>
            </View>
          </View>
        </View>
        <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(activeSession?.id)}>
          <Feather name="trash-2" size={18} color={C.destructive} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loadingMsgs ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMsg}
            keyExtractor={m => m.id}
            contentContainerStyle={[styles.msgList, { paddingBottom: 16 }]}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={isTyping ? <TypingIndicator C={C} /> : null}
          />
        )}

        {showSuggestions && !loadingMsgs && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={AI_SUGGESTED_QUESTIONS}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.suggestionPill, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.7 }]}
                  onPress={() => sendMessage(item)}
                >
                  <Text style={[styles.suggestionText, { color: C.tint }]}>{item}</Text>
                </Pressable>
              )}
              keyExtractor={(_, i) => i.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            />
          </View>
        )}

        <View style={[styles.inputBar, { backgroundColor: C.headerBg, borderTopColor: C.border, paddingBottom: isKeyboardVisible ? 10 : tabBarHeight + 8 }]}>
          {pendingAttachment && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 8, marginHorizontal: 16, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
              <Ionicons name={pendingAttachment.type.startsWith('image/') ? "image" : "document"} size={20} color={C.accent} style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, color: C.foreground, fontSize: 13 }} numberOfLines={1}>{pendingAttachment.name}</Text>
              <Pressable onPress={() => setPendingAttachment(null)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={20} color={C.mutedForeground} />
              </Pressable>
            </View>
          )}
          
          <View style={[styles.inputWrapper, { backgroundColor: C.background }]}>
            <Pressable onPress={pickDocument} style={styles.attachBtn}>
              <Ionicons name="document-attach-outline" size={22} color={C.mutedForeground} />
            </Pressable>
            <Pressable onPress={pickImage} style={styles.attachBtn}>
              <Ionicons name="image-outline" size={22} color={C.mutedForeground} />
            </Pressable>

            <TextInput
              style={[styles.textInput, { color: C.foreground }]}
              placeholder={t.askLegalQuestion}
              placeholderTextColor={C.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: C.tint }, (!input.trim() && !pendingAttachment || isTyping) && { opacity: 0.4 }]}
              onPress={() => sendMessage(input)}
              disabled={(!input.trim() && !pendingAttachment) || isTyping}
            >
              <Ionicons name="send" size={18} color={C.primaryForeground} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // History view
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  historyTitle: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  newChatBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  historyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  sessionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sessionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sessionPreview: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sessionMeta: { alignItems: 'flex-end', gap: 4 },
  sessionDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  sessionCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  emptyHistory: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  emptyNewBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20 },
  // Chat view
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { padding: 6 },
  chatHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatHeaderAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  chatHeaderTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  statusText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  deleteBtn: { padding: 8 },
  // Messages
  msgList: { paddingHorizontal: 16, paddingTop: 16 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12, maxWidth: '85%' },
  bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  bubble: { borderRadius: 18, padding: 14, maxWidth: '100%' },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAi: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  typingBubble: { paddingVertical: 16, paddingHorizontal: 20 },
  dotsRow: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // Input
  suggestionsContainer: { paddingVertical: 8 },
  suggestionPill: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  suggestionText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputBar: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingLeft: 4, paddingRight: 4, paddingVertical: 4, gap: 8 },
  attachBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 10 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
});
