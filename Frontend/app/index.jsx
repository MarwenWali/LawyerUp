import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, Platform, TextInput, FlatList, KeyboardAvoidingView, Modal, Alert, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AI_SUGGESTED_QUESTIONS } from '@/constants/mockData';

function generateAIResponse(question) {
  const q = question.toLowerCase();
  if (q.includes('tenant') || q.includes('rent')) {
    return 'Under Tunisian law, tenant rights are governed by Law No. 77-37 of 1977. Key protections include:\n\n• Right to a written lease agreement\n• Protection against arbitrary eviction\n• Right to maintenance and repairs\n• Regulated rent increases\n\nI recommend consulting with a property law specialist for your specific situation. Would you like me to connect you with one?';
  }
  if (q.includes('business') || q.includes('register') || q.includes('company')) {
    return 'To register a business in Tunisia, you need to follow the Code des Sociétés Commerciales. The process typically involves:\n\n• Choosing a legal structure (SARL, SA, etc.)\n• Registering with the RNE (Registre National des Entreprises)\n• Obtaining a tax identification number\n• Opening a business bank account\n\nWould you like to speak with a commercial law attorney?';
  }
  if (q.includes('divorce')) {
    return 'Divorce in Tunisia is governed by the Personal Status Code (Majallat al-Ahwal al-Shakhsiyyah). Key points:\n\n• Both spouses have equal right to file\n• Mutual consent or court-ordered divorce\n• Child custody considerations prioritize child welfare\n• Division of shared assets\n\nThis is a sensitive matter. I strongly recommend consulting a family law specialist.';
  }
  if (q.includes('employee') || q.includes('worker') || q.includes('labor')) {
    return 'Employee protections in Tunisia are covered under the Labour Code (Code du Travail). Key protections include:\n\n• Maximum 48-hour work week\n• Minimum wage (SMIG/SMAG) regulations\n• Annual paid leave (at least 1 day per month)\n• Protection against wrongful termination\n• Social security coverage (CNSS)\n\nWould you like to connect with a labor law attorney?';
  }
  return `Thank you for your question about "${question}". Based on Tunisian law, this is an area that requires careful analysis of your specific circumstances.\n\nI recommend discussing this with a qualified attorney who can provide personalized legal counsel. Would you like me to connect you with a specialized lawyer?`;
}

function MessageBubble({ msg, C, isDark }) {
  const isUser = msg.sender === 'user';
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.aiAvatar, { backgroundColor: C.muted }]}>
          <Ionicons name="scale" size={16} color={C.accent} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? [styles.bubbleUser, { backgroundColor: C.chatUser }] : [styles.bubbleAi, { backgroundColor: C.chatAi }]]}>
        <Text style={[styles.bubbleText, isUser ? { color: isDark ? '#0B1120' : '#FDF6E3' } : { color: C.foreground }]}>{msg.content}</Text>
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

export default function LandingPage() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, isLoading, logout } = useAuth();
  const C = useTheme();
  const { t } = useLanguage();
  const { isDark } = useThemeContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [guestPromptCount, setGuestPromptCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
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

  useEffect(() => {
    // Set initial message when component mounts or language changes
    const initialMsg = {
      id: '0',
      content: t.aiWelcome,
      sender: 'ai',
      timestamp: new Date().toISOString(),
    };
    setMessages([initialMsg]);
  }, [t.aiWelcome]);

  useEffect(() => {
    loadGuestPromptCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'admin') {
        // Admin accounts are managed exclusively through the web dashboard.
        // Log the user out and show a notice.
        logout();
        Alert.alert(
          'Admin Access',
          'Admin accounts must use the LawyerUp web dashboard.\n\nVisit: http://localhost:8080',
          [{ text: 'OK' }]
        );
        return;
      }
      if (user.role === 'lawyer') router.replace('/(lawyer-tabs)');
      else router.replace('/(user-tabs)');
    }
  }, [isAuthenticated, user, isLoading, logout]);

  async function loadGuestPromptCount() {
    try {
      const count = await AsyncStorage.getItem('guest_prompt_count');
      setGuestPromptCount(count ? parseInt(count, 10) : 0);
    } catch (e) {
      console.error('Failed to load guest prompt count', e);
    }
  }

  async function incrementGuestPromptCount() {
    const newCount = guestPromptCount + 1;
    setGuestPromptCount(newCount);
    try {
      await AsyncStorage.setItem('guest_prompt_count', newCount.toString());
    } catch (e) {
      console.error('Failed to save guest prompt count', e);
    }
    return newCount;
  }

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isTyping) return;
    
    // Check if user has reached the limit
    if (guestPromptCount >= 3) {
      setShowLoginModal(true);
      return;
    }

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg = {
      id: Date.now().toString(),
      content: text.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setInput('');
    setIsTyping(true);

    // Increment the count
    const newCount = await incrementGuestPromptCount();

    setTimeout(() => {
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(text),
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);

      // Show login modal after 3 prompts
      if (newCount >= 3) {
        setTimeout(() => setShowLoginModal(true), 1000);
      }
    }, 1500);
  }, [messages, isTyping, guestPromptCount]);

  const renderItem = useCallback(({ item }) => (
    <MessageBubble msg={item} C={C} isDark={isDark} />
  ), [C, isDark]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? '#0B1120' : '#14213D' }]}>
        <Ionicons name="scale" size={48} color={C.accent} />
      </View>
    );
  }

  if (isAuthenticated) return null;

  const remainingPrompts = Math.max(0, 3 - guestPromptCount);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top + 12, backgroundColor: C.headerBg, borderBottomColor: C.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.logoRow}>
            <View style={[styles.logoIcon, { backgroundColor: C.muted }]}>
              <Ionicons name="scale" size={20} color={C.accent} />
            </View>
            <Text style={[styles.logoText, { color: C.foreground }]}>LawyerUp</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={[styles.signInText, { color: C.tint }]}>{t.signIn}</Text>
          </Pressable>
        </View>
        <View style={styles.chatHeaderInner}>
          <View style={[styles.chatHeaderAvatar, { backgroundColor: C.muted }]}>
            <Ionicons name="scale" size={20} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.chatHeaderTitle, { color: C.foreground }]}>{t.aiLegalAssistant}</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={[styles.statusText, { color: C.textSecondary }]}>
                {remainingPrompts > 0 
                  ? t.freeQuestionsRemaining.replace('{count}', remainingPrompts).replace('{s}', remainingPrompts !== 1 ? 's' : '') 
                  : t.freeTrialUsed}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chat */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={m => m.id}
          contentContainerStyle={[styles.msgList, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={isTyping ? <TypingIndicator C={C} /> : null}
        />

        <View style={[styles.inputBar, { backgroundColor: C.headerBg, borderTopColor: C.border, paddingBottom: isKeyboardVisible ? 10 : insets.bottom + 8 }]}>
          <View style={[styles.inputWrapper, { backgroundColor: C.background }]}>
            <TextInput
              style={[styles.textInput, { color: C.foreground }]}
              placeholder={guestPromptCount >= 3 ? t.signInToContinue : t.askLegalQuestion}
              placeholderTextColor={C.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              editable={guestPromptCount < 3}
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: C.tint }, (!input.trim() || isTyping || guestPromptCount >= 3) && { opacity: 0.4 }]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || isTyping || guestPromptCount >= 3}
            >
              <Ionicons name="send" size={18} color={C.primaryForeground} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Login Modal */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.card }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: C.muted }]}>
              <Ionicons name="lock-closed" size={32} color={C.accent} />
            </View>
            
            <Text style={[styles.modalTitle, { color: C.foreground }]}>{t.continueJourney}</Text>
            <Text style={[styles.modalText, { color: C.textSecondary }]}>
              {t.usedFreeQuestions}
            </Text>

            <View style={styles.modalBenefits}>
              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                <Text style={[styles.benefitText, { color: C.foreground }]}>{t.unlimitedAI}</Text>
              </View>
              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                <Text style={[styles.benefitText, { color: C.foreground }]}>{t.connectLawyers}</Text>
              </View>
              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                <Text style={[styles.benefitText, { color: C.foreground }]}>{t.saveHistory}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.modalPrimaryBtn, { backgroundColor: C.accent }, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setShowLoginModal(false);
                router.push('/(auth)/login');
              }}
            >
              <Text style={[styles.modalPrimaryBtnText, { color: isDark ? '#0B1120' : '#FDF6E3' }]}>{t.signIn}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.modalSecondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                setShowLoginModal(false);
                router.push('/(auth)/register');
              }}
            >
              <Text style={[styles.modalSecondaryBtnText, { color: C.tint }]}>{t.createFreeAccount}</Text>
            </Pressable>

            <Pressable
              style={[styles.modalCloseBtn, { position: 'absolute', top: 16, right: 16 }]}
              onPress={() => setShowLoginModal(false)}
            >
              <Ionicons name="close" size={24} color={C.mutedForeground} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  chatHeader: { paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold' },
  signInBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  signInText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  chatHeaderInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatHeaderAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  chatHeaderTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  statusText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
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
  inputBar: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingLeft: 16, paddingRight: 4, paddingVertical: 4, gap: 8 },
  textInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 10 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalContent: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 28, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  modalIconContainer: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center', marginBottom: 12 },
  modalText: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalBenefits: { width: '100%', gap: 14, marginBottom: 28 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  modalPrimaryBtn: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  modalPrimaryBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  modalSecondaryBtn: { paddingVertical: 10 },
  modalSecondaryBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  modalCloseBtn: { padding: 8 },
});
