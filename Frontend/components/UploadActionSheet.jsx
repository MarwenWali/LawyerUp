import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Platform, Dimensions } from 'react-native';
import { useTheme } from '@/constants/useTheme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function UploadActionSheet({ visible, onClose, onOptionSelect }) {
  const C = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: C.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: C.foreground }]}>Upload File</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={C.mutedForeground} />
            </Pressable>
          </View>
          
          <Pressable style={[styles.option, { borderBottomColor: C.border }]} onPress={() => onOptionSelect('camera')}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Ionicons name="camera" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.optionText, { color: C.foreground }]}>Take Photo</Text>
          </Pressable>
          
          <Pressable style={[styles.option, { borderBottomColor: C.border }]} onPress={() => onOptionSelect('gallery')}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Ionicons name="images" size={20} color="#10B981" />
            </View>
            <Text style={[styles.optionText, { color: C.foreground }]}>Choose from Gallery</Text>
          </Pressable>
          
          <Pressable style={styles.option} onPress={() => onOptionSelect('document')}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Ionicons name="document-text" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.optionText, { color: C.foreground }]}>Upload Document</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  closeBtn: {
    padding: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
});
