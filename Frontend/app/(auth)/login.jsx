import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginPage() {
  const { login, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  const ROLES = [
    { key: 'user', label: t.user, icon: 'person' },
    { key: 'lawyer', label: t.lawyer, icon: 'briefcase' },
  ];

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setLoading(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      const userRole = loggedInUser.role;
      if (userRole === 'admin') {
        // Admin accounts are managed via the web dashboard, not the mobile app.
        await logout();
        Alert.alert(
          'Admin Access',
          'Admin accounts must use the LawyerUp web dashboard.\n\nVisit: http://localhost:8080',
          [{ text: 'OK' }]
        );
      } else if (userRole === 'lawyer') {
        router.replace('/(lawyer-tabs)');
      } else {
        router.replace('/(user-tabs)');
      }
    } catch (e) {
      Alert.alert('Login Failed', e.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: C.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoIcon, { backgroundColor: C.muted }]}>
              <Ionicons name="scale" size={28} color={C.accent} />
            </View>
            <Text style={[styles.title, { color: C.tint }]}>{t.welcomeBack}</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>{t.signInSubtitle}</Text>
          </View>

          <Text style={[styles.label, { color: C.textSecondary }]}>{t.selectRole}</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => (
              <Pressable
                key={r.key}
                style={[styles.roleCard, { backgroundColor: C.card, borderColor: C.border }, role === r.key && { borderColor: C.accent, backgroundColor: C.accentLight }]}
                onPress={() => {
                  setRole(r.key);
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
              >
                <Ionicons name={r.icon} size={22} color={role === r.key ? C.accent : C.mutedForeground} />
                <Text style={[styles.roleLabel, { color: C.textSecondary }, role === r.key && { color: C.accent, fontFamily: 'Inter_600SemiBold' }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <View style={[styles.inputWrapper, { backgroundColor: C.inputBg, borderColor: C.border }]}>
              <Feather name="mail" size={18} color={C.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: C.foreground }]}
                placeholder={t.emailAddress}
                placeholderTextColor={C.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: C.inputBg, borderColor: C.border }]}>
              <Feather name="lock" size={18} color={C.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: C.foreground }]}
                placeholder={t.password}
                placeholderTextColor={C.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.loginBtn, { backgroundColor: C.tint }, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.primaryForeground} />
            ) : (
              <Text style={[styles.loginBtnText, { color: C.primaryForeground }]}>{t.signIn}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.textSecondary }]}>{t.dontHaveAccount}</Text>
          <Pressable onPress={() => router.replace('/(auth)/register')}>
            <Text style={[styles.footerLink, { color: C.accent }]}>{t.signUp}</Text>
          </Pressable>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  logoContainer: { alignItems: 'center', marginBottom: 28 },
  logoIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  roleCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, gap: 6 },
  roleLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputGroup: { gap: 12, marginBottom: 24 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1 },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  loginBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  loginBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 16 },
  footerText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
