import React, { useState, useRef, memo } from 'react';
import {
  View, Text, Modal, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, TextInput, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPECIALIZATION_OPTIONS } from '../../../constants/mockData';
import { glassmorphism as styles } from '../../../theme/glassmorphism';

const MemoizedGlassInput = memo(({
  icon,
  defaultValue,
  onChangeText,
  placeholder,
  secureTextEntry,
  onFocus,
  onBlur,
  isFocused,
  multiline,
  C,
  inputKey,
  isDark,
  keyboardType
}) => (
  <View style={[styles.glassInputWrapper, isFocused && styles.glassInputFocused]}>
    {icon && <Feather name={icon} size={18} color={isFocused ? C.accent : 'rgba(212,175,55,0.4)'} style={styles.inputIcon} />}
    <TextInput
      key={inputKey}
      style={[styles.glassInput, multiline && styles.glassTextArea, { color: isDark ? '#FFF' : '#000' }]}
      defaultValue={defaultValue}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={C.mutedForeground}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      keyboardType={keyboardType}
      cursorColor={C.accent}
      selectionColor={C.accent + '44'}
      underlineColorAndroid="transparent"
    />
  </View>
));

export default function EditInfoModal({
  visible,
  onClose,
  C,
  t,
  saving,
  onSave,
  user,
  isDark,
  insets,
  isLawyer
}) {
  const nameRef = useRef(user?.name || user?.full_name || '');
  const phoneRef = useRef(user?.phone_number || '');
  const bioRef = useRef(user?.bio || '');
  const specRef = useRef(user?.specialization || 'Family');
  const expRef = useRef(user?.experience_years != null ? String(user.experience_years) : '');

  const [focusedField, setFocusedField] = useState(null);
  const [currentSpec, setCurrentSpec] = useState(specRef.current);

  const handleSave = () => {
    const data = {
      full_name: nameRef.current,
      phone_number: phoneRef.current,
    };
    if (isLawyer) {
      data.bio = bioRef.current;
      data.specialization = specRef.current;
      data.experience_years = expRef.current;
    }
    onSave(data);
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
          <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t('editProfile')}</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: (insets?.bottom || 24) + 40 }}
          >
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Email Address</Text>
            <View style={[styles.glassInputWrapper, { opacity: 0.6, backgroundColor: isDark ? '#1E293B' : C.muted }]}>
              <Feather name="lock" size={18} color={C.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.glassInput, { color: isDark ? '#FFF' : '#000', opacity: 0.7 }]}
                value={user?.email}
                editable={false}
                underlineColorAndroid="transparent"
              />
            </View>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t('personalInfo')}</Text>
            <MemoizedGlassInput
              inputKey="name-input"
              icon="user"
              defaultValue={nameRef.current}
              onChangeText={(v) => nameRef.current = v}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'name'}
              placeholder="Your full name"
              C={C}
              isDark={isDark}
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Phone Number</Text>
            <MemoizedGlassInput
              inputKey="phone-input"
              icon="phone"
              defaultValue={phoneRef.current}
              onChangeText={(v) => phoneRef.current = v}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'phone'}
              placeholder="+216 XX XXX XXX"
              keyboardType="phone-pad"
              C={C}
              isDark={isDark}
            />

            {isLawyer && (
              <>
                <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Specialization</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {SPECIALIZATION_OPTIONS?.map(item => (
                    <Pressable
                      key={item}
                      onPress={() => { specRef.current = item; setCurrentSpec(item); }}
                      style={[{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)', marginRight: 8 }, currentSpec === item && { backgroundColor: C.accent, borderColor: C.accent }]}
                    >
                      <Text style={[{ fontSize: 13, fontFamily: 'Inter_600SemiBold' }, { color: C.foreground }, currentSpec === item && { color: '#fff' }]}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Years of Experience</Text>
                <MemoizedGlassInput
                  inputKey="exp-input"
                  icon="award"
                  defaultValue={expRef.current}
                  onChangeText={(v) => expRef.current = v}
                  onFocus={() => setFocusedField('exp')}
                  onBlur={() => setFocusedField(null)}
                  isFocused={focusedField === 'exp'}
                  placeholder="Years of experience"
                  keyboardType="number-pad"
                  C={C}
                  isDark={isDark}
                />

                <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Bio</Text>
                <MemoizedGlassInput
                  inputKey="bio-input"
                  defaultValue={bioRef.current}
                  onChangeText={(v) => bioRef.current = v}
                  onFocus={() => setFocusedField('bio')}
                  onBlur={() => setFocusedField(null)}
                  isFocused={focusedField === 'bio'}
                  placeholder="About yourself..."
                  multiline
                  C={C}
                  isDark={isDark}
                />
              </>
            )}

            <View style={styles.sheetActionsFull}>
              <Pressable style={styles.btnGhostGold} onPress={onClose}>
                <Text style={[styles.btnGhostText, { color: C.accent }]}>{t('close')}</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [styles.btnPrimaryWrapper, saving && { opacity: 0.7 }, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={['#D4AF37', '#FFD700']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnPrimaryGradient}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.btnPrimaryText}>{t('editProfile') || 'Save Changes'}</Text>}
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
