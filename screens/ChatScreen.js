import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../context/AppContext';
import { LanguageContext } from '../context/LanguageContext';

const ChatScreen = () => {
  const { promptsUsed, firstPromptTimestamp, incrementPrompt, user } = useContext(AppContext);
  const { language, t } = useContext(LanguageContext);
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
    await incrementPrompt();
    setMessage('AI response placeholder for: ' + input);
    setInput('');
  };

  if (!disclaimerLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <Modal visible={!acceptedDisclaimer} transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalBox}>
            <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 18 }}>⚖️ {t('disclaimer')}</Text>
            <Text style={{ marginBottom: 12 }}>{t('disclaimer_text')}</Text>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptDisclaimer}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('accept')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.chatArea}>
        <Text style={styles.header}>{t('chat')}</Text>
        <Text style={{ color: '#666', marginBottom: 8 }}>{user ? `${t('signed_in')} ${user.type}` : `${t('prompts_used')}: ${promptsUsed}/3`}</Text>
        {!canUse() && (
          <Text style={{ color: 'red' }}>{t('free_prompts_exhausted')} {Math.ceil(timeUntilReset() / (60 * 60 * 1000))}h</Text>
        )}
        <TextInput style={styles.input} placeholder={t('ask_question')} value={input} onChangeText={setInput} multiline />
        <View style={styles.row}>
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={{ color: '#fff' }}>{t('send')}</Text>
          </TouchableOpacity>
        </View>
        {message ? <View style={styles.response}><Text>{message}</Text></View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  chatArea: { backgroundColor: '#fff', borderRadius: 8, padding: 12, flex: 1 },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 100, borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 6, padding: 8, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
  sendBtn: { backgroundColor: '#2b6cb0', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6 },
  response: { marginTop: 12, backgroundColor: '#f4f6fb', padding: 10, borderRadius: 6 },
  modalWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalBox: { width: '88%', backgroundColor: '#fff', padding: 16, borderRadius: 8 },
  acceptBtn: { backgroundColor: '#2b6cb0', padding: 12, borderRadius: 6, alignItems: 'center' },
});

export default ChatScreen;
