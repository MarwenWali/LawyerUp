import React, { useState, useRef, memo } from 'react';
import { 
  View, Text, Modal, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, TextInput, ScrollView 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const MemoizedGlassInput = memo(({ 
  icon, 
  defaultValue, 
  onChangeText, 
  placeholder, 
  secureTextEntry, 
  onFocus, 
  onBlur, 
  isFocused, 
  styles,
  C,
  inputKey,
  isDark
}) => (
  <View style={[styles.glassInputWrapper, isFocused && styles.glassInputFocused]}>
    {icon && <Feather name={icon} size={18} color={isFocused ? C.accent : 'rgba(212,175,55,0.4)'} style={styles.inputIcon} />}
    <TextInput
      key={inputKey}
      style={[styles.glassInput, { color: isDark ? '#FFF' : '#000' }]}
      defaultValue={defaultValue}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={C.mutedForeground}
      secureTextEntry={secureTextEntry}
      cursorColor={C.accent}
      selectionColor={C.accent + '44'}
      underlineColorAndroid="transparent"
    />
  </View>
));

export default function ChangePasswordModal({ 
  visible, 
  onClose, 
  C, 
  t, 
  styles, 
  pwdSaving, 
  onSave,
  isDark,
  insets 
}) {
  const curPwdRef = useRef('');
  const newPwdRef = useRef('');
  const confPwdRef = useRef('');
  const [pwdLen, setPwdLen] = useState(0);
  const [focusedField, setFocusedField] = useState(null);

  const handleSave = () => {
    onSave({
      currentPassword: curPwdRef.current,
      newPassword: newPwdRef.current,
      confirmPassword: confPwdRef.current
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.modalOverlay} 
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => { onClose(); setFocusedField(null); }} />
        <View style={[styles.sheet, { backgroundColor: C.card, maxHeight: '90%' }]}>
          <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
          <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.changePasswordTitle}</Text>

          <ScrollView 
            keyboardShouldPersistTaps="handled" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: (insets?.bottom || 24) + 40 }}
          >
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.currentPasswordLabel}</Text>
            <MemoizedGlassInput
              inputKey="pwd-curr-input"
              icon="lock"
              defaultValue={curPwdRef.current}
              onChangeText={(v) => curPwdRef.current = v}
              onFocus={() => setFocusedField('curPwd')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'curPwd'}
              secureTextEntry
              styles={styles}
              C={C}
              isDark={isDark}
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.newPasswordLabel}</Text>
            <MemoizedGlassInput
              inputKey="pwd-new-input"
              icon="shield"
              defaultValue={newPwdRef.current}
              onChangeText={(v) => { 
                newPwdRef.current = v; 
                if (v.length !== pwdLen) setPwdLen(v.length); 
              }}
              onFocus={() => setFocusedField('newPwd')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'newPwd'}
              secureTextEntry
              styles={styles}
              C={C}
              isDark={isDark}
            />
            
            <View style={styles.pwdStrengthContainer}>
              <View style={[styles.pwdBar, { backgroundColor: C.border }]}>
                <View style={[
                  styles.pwdBarFill, 
                  { 
                    width: `${Math.min(100, (pwdLen / 10) * 100)}%`,
                    backgroundColor: pwdLen < 6 ? C.destructive : C.accent 
                  }
                ]} />
              </View>
              <Text style={[styles.pwdText, { color: C.textSecondary }]}>
                {pwdLen < 6 ? 'Too short' : 'Secure'}
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.confirmNewPasswordLabel}</Text>
            <MemoizedGlassInput
              inputKey="pwd-conf-input"
              icon="check-circle"
              defaultValue={confPwdRef.current}
              onChangeText={(v) => confPwdRef.current = v}
              onFocus={() => setFocusedField('confPwd')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'confPwd'}
              secureTextEntry
              styles={styles}
              C={C}
              isDark={isDark}
            />

            <View style={styles.sheetActionsFull}>
              <Pressable style={styles.btnGhostGold} onPress={onClose}>
                <Text style={[styles.btnGhostText, { color: C.accent }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={pwdSaving}
                style={({ pressed }) => [styles.btnPrimaryWrapper, pwdSaving && { opacity: 0.7 }, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={['#D4AF37', '#FFD700']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnPrimaryGradient}
                >
                  {pwdSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>{t.updatePasswordBtn}</Text>}
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
