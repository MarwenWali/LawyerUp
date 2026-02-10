import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../context/AppContext';
import { LanguageContext } from '../context/LanguageContext';
import { ThemeContext } from '../context/ThemeContext';
import { API_URL } from '../config';

const ChatScreen = () => {
  const { promptsUsed, firstPromptTimestamp, incrementPrompt, user } = useContext(AppContext);
  const { language, t } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const [input, setInput] = useState('');
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [disclaimerLoaded, setDisclaimerLoaded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load disclaimer acceptance from AsyncStorage
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('disclaimerAccepted');
        if (saved === 'true') {
          setAcceptedDisclaimer(true);
        } else {
          setAcceptedDisclaimer(false);
        }
      } catch (e) {
        console.warn(e);
      }
      setDisclaimerLoaded(true);
    })();
  }, []);

  const handleAcceptDisclaimer = async () => {
    setAcceptedDisclaimer(true);
    await AsyncStorage.setItem('disclaimerAccepted', 'true');
  };

  const canUse = () => {
    if (user) return true;
    if (!firstPromptTimestamp) return true;
    if (promptsUsed < 3) return true;
    const eightHours = 8 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - firstPromptTimestamp >= eightHours) return true;
    return false;
  };

  const timeUntilReset = () => {
    if (!firstPromptTimestamp) return 0;
    const eightHours = 8 * 60 * 60 * 1000;
    const now = Date.now();
    const left = Math.max(0, eightHours - (now - firstPromptTimestamp));
    return left;
  };

  const handleSend = async () => {
    if (!acceptedDisclaimer) return alert(t('disclaimer'));
    if (!canUse()) {
      return setMessage(t('free_prompts_exhausted'));
    }

    const userMessage = input;
    setInput('');
    setMessage('Thinking...'); // Loading state

    try {
      await incrementPrompt();
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get response');

      // Assuming the python script returns { answer: "..." }
      // The ai_service returns whatever the python script returns
      // The python script returns { answer: ..., sources: ... }
      setMessage(data.answer);
    } catch (error) {
      setMessage('Error: ' + error.message);
    }
  };

  if (!disclaimerLoaded) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Modal visible={!acceptedDisclaimer} transparent>
        <View style={styles.modalWrap}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 18, color: colors.text }}>⚖️ {t('disclaimer')}</Text>
            <Text style={{ marginBottom: 12, color: colors.text }}>{t('disclaimer_text')}</Text>
            <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={handleAcceptDisclaimer}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('accept')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.chatArea, { backgroundColor: colors.surface }]}>
        <Text style={[styles.header, { color: colors.text }]}>{t('chat')}</Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>{user ? `${t('signed_in')} ${user.type}` : `${t('prompts_used')}: ${promptsUsed}/3`}</Text>
        {!canUse() && (
          <Text style={{ color: colors.accent }}>{t('free_prompts_exhausted')} {Math.ceil(timeUntilReset() / (60 * 60 * 1000))}h</Text>
        )}
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#333' : '#fff' }]}
          placeholder={t('ask_question')}
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <View style={styles.row}>
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={handleSend}>
            <Text style={{ color: '#fff' }}>{t('send')}</Text>
          </TouchableOpacity>
        </View>
        {message ? <View style={[styles.response, { backgroundColor: isDark ? '#333' : '#f4f6fb' }]}><Text style={{ color: colors.text }}>{message}</Text></View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  chatArea: { borderRadius: 8, padding: 12, flex: 1 },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 100, borderWidth: 1, borderRadius: 6, padding: 8, marginBottom: 8, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
  sendBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6 },
  response: { marginTop: 12, padding: 10, borderRadius: 6 },
  modalWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { width: '88%', padding: 16, borderRadius: 8 },
  acceptBtn: { padding: 12, borderRadius: 6, alignItems: 'center' },
});

export default ChatScreen;
