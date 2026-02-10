import React, { useContext, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Platform, Keyboard, Animated } from 'react-native';
import { Text, TextInput, Button, Surface, Portal, Modal, useTheme, ActivityIndicator, IconButton, Chip } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as DocumentPicker from 'expo-document-picker'; // Optional - install with: npx expo install expo-document-picker
import { AppContext } from '../context/AppContext';
import { LanguageContext } from '../context/LanguageContext';
import { ThemeContext } from '../context/ThemeContext';
import { API_URL } from '../config';

const ChatScreen = () => {
  const { promptsUsed, firstPromptTimestamp, incrementPrompt, user } = useContext(AppContext);
  const { language, t } = useContext(LanguageContext);
  const { colors: themeColors, isDark } = useContext(ThemeContext);
  const theme = useTheme();
  const colors = theme.colors;
  const [input, setInput] = useState('');
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [disclaimerLoaded, setDisclaimerLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const scrollViewRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  // Dynamic keyboard height listener
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard opens - Android needs more delay
        const delay = Platform.OS === 'android' ? 300 : 100;
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), delay);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
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
    setLoading(true);
    // setMessage('Thinking...'); // Loading state handled by ActivityIndicator

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
      setLoading(false);
      setMessage(data.answer);
    } catch (error) {
      setLoading(false);
      setMessage('Error: ' + error.message);
    }
  };


  const pickDocument = async () => {
    // Document picker disabled due to dependency conflicts
    // To enable: install expo-document-picker and uncomment the import
    alert('Document upload feature is currently disabled. The app uses text-only chat for now.');
  };

  if (!disclaimerLoaded) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Portal>
        <Modal visible={!acceptedDisclaimer} dismissable={false} contentContainerStyle={[styles.modalBox, { backgroundColor: colors.surface }]}>
          <Text variant="titleLarge" style={{ marginBottom: 8 }}>⚖️ {t('disclaimer')}</Text>
          <Text variant="bodyMedium" style={{ marginBottom: 12 }}>{t('disclaimer_text')}</Text>
          <Button mode="contained" onPress={handleAcceptDisclaimer}>
            {t('accept')}
          </Button>
        </Modal>
      </Portal>

      <Surface
        style={[
          styles.chatArea,
          {
            marginBottom: keyboardHeight > 0 ? keyboardHeight - 10 : 0
          }
        ]}
        elevation={1}
      >
        <Text variant="headlineSmall" style={{ marginBottom: 6 }}>{t('chat')}</Text>
        <Text variant="bodySmall" style={{ color: colors.secondary, marginBottom: 8 }}>{user ? `${t('signed_in')} ${user.type}` : `${t('prompts_used')}: ${promptsUsed}/3`}</Text>
        {!canUse() && (
          <Text style={{ color: colors.error }}>{t('free_prompts_exhausted')} {Math.ceil(timeUntilReset() / (60 * 60 * 1000))}h</Text>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, marginBottom: 10 }}
          contentContainerStyle={{ paddingBottom: 10 }}
        >
          {message ? (
            <Surface style={[styles.response, { backgroundColor: colors.secondaryContainer }]} elevation={0}>
              <Text style={{ color: colors.onSecondaryContainer }}>{message}</Text>
            </Surface>
          ) : (
            <Text style={{ textAlign: 'center', marginTop: 20, color: 'gray' }}>Start a conversation...</Text>
          )}
          {loading && <ActivityIndicator animating={true} style={{ marginTop: 20 }} />}
        </ScrollView>

        {selectedFile && (
          <View style={styles.filePreview}>
            <Chip
              icon="file-document"
              onClose={() => setSelectedFile(null)}
              style={{ marginBottom: 8 }}
            >
              {selectedFile.name}
            </Chip>
          </View>
        )}

        <View style={styles.inputContainer}>
          <IconButton
            icon="paperclip"
            size={24}
            onPress={pickDocument}
            style={styles.attachButton}
          />
          <TextInput
            mode="outlined"
            label={t('ask_question')}
            value={input}
            onChangeText={setInput}
            multiline
            numberOfLines={1}
            maxLength={500}
            style={[styles.input, { maxHeight: 120 }]}
            onFocus={() => {
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            }}
          />
          <IconButton
            icon="send"
            size={24}
            onPress={handleSend}
            disabled={!input.trim() && !selectedFile}
            style={styles.sendButton}
          />
        </View>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  chatArea: { borderRadius: 8, padding: 16, flex: 1 },
  inputContainer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120
  },
  attachButton: {
    margin: 0
  },
  sendButton: {
    margin: 0
  },
  filePreview: {
    marginBottom: 8
  },
  response: { marginTop: 12, padding: 12, borderRadius: 8 },
  modalBox: { padding: 20, margin: 20, borderRadius: 8 },
});

export default ChatScreen;
