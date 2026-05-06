import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, ActivityIndicator, Image, Linking, Modal, Dimensions, ActionSheetIOS, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/useTheme';
import { userApi } from '@/services/api';
import UploadActionSheet from '@/components/UploadActionSheet';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const { width, height } = Dimensions.get('window');

function ImagePreviewModal({ uri, onClose }) {
  return (
    <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable style={{ position: 'absolute', top: 52, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 6 }} onPress={onClose} hitSlop={16}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {uri ? <Image source={{ uri }} style={{ width, height: height * 0.85 }} resizeMode="contain" /> : null}
      </View>
    </Modal>
  );
}

export default function AllFilesScreen() {
  const C = useTheme();
  const [vaultFiles, setVaultFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const fetchVaultFiles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userApi.getVault();
      setVaultFiles(data.files || []);
    } catch (e) {
      console.error('fetchVault error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVaultFiles();
  }, [fetchVaultFiles]);

  const [isUploading, setIsUploading] = useState(false);

  const processUpload = async (fileObj) => {
    try {
      setIsUploading(true);
      await userApi.uploadVaultFile(fileObj);
      await fetchVaultFiles();
    } catch (error) {
      Alert.alert("Upload Failed", error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const [sheetVisible, setSheetVisible] = useState(false);

  const handleUploadClick = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetVisible(true);
  };

  const handleOptionSelect = async (option) => {
    setSheetVisible(false);
    // give modal time to close before opening picker
    setTimeout(async () => {
      if (option === 'camera') {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled) processUpload({ uri: result.assets[0].uri, name: 'camera.jpg', type: 'image/jpeg' });
      } else if (option === 'gallery') {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!result.canceled) processUpload({ uri: result.assets[0].uri, name: 'gallery.jpg', type: 'image/jpeg' });
      } else if (option === 'document') {
        const result = await DocumentPicker.getDocumentAsync({});
        if (!result.canceled) processUpload({ uri: result.assets[0].uri, name: result.assets[0].name, type: result.assets[0].mimeType });
      }
    }, 300);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <UploadActionSheet 
        visible={sheetVisible} 
        onClose={() => setSheetVisible(false)} 
        onOptionSelect={handleOptionSelect} 
      />
      <Stack.Screen options={{
        headerRight: () => (
          <Pressable onPress={handleUploadClick} style={{ padding: 8 }}>
            <Ionicons name="add" size={26} color={C.tint} />
          </Pressable>
        )
      }} />

      {isUploading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ backgroundColor: C.card, padding: 24, borderRadius: 16, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.tint} style={{ marginBottom: 16 }} />
            <Text style={{ color: C.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Uploading...</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : vaultFiles.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={48} color={C.mutedForeground} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyText, { color: C.mutedForeground }]}>Your legal vault is empty.</Text>
        </View>
      ) : (
        <FlatList
          data={vaultFiles}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }}
          renderItem={({ item: file }) => {
            const isImage = file.message_type === 'image';
            const dateStr = new Date(file.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
            
            let statusText = 'Not shared yet';
            let StatusIcon = null;
            if (file.source === 'lawyer' && file.receiver_name) {
              statusText = `Sent to: ${file.receiver_name}`;
              StatusIcon = <Ionicons name="paper-plane" size={12} color="#9BA1A6" style={{ marginRight: 4 }} />;
            } else if (file.source === 'ai') {
              statusText = 'Analyzed by AI';
            }

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.vaultCard,
                  { backgroundColor: C.card, borderColor: C.border },
                  pressed && { opacity: 0.85 }
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (isImage) {
                    setPreviewImageUrl(file.attachment_url);
                  } else {
                    Linking.openURL(file.attachment_url).catch(() => {});
                  }
                }}
              >
                <View style={[styles.vaultIconContainer, { backgroundColor: isImage ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                  <Ionicons name={isImage ? "image" : "document-text"} size={24} color={isImage ? "#3B82F6" : "#EF4444"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.vaultFileName, { color: C.foreground }]} numberOfLines={1}>
                    {file.attachment_name || 'Document'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    {StatusIcon}
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9BA1A6' }} numberOfLines={1}>
                      {statusText}
                    </Text>
                  </View>
                  <Text style={[styles.vaultFileDate, { color: C.mutedForeground }]}>
                    Uploaded: {dateStr}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.mutedForeground} />
              </Pressable>
            );
          }}
        />
      )}

      <ImagePreviewModal
        uri={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  vaultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  vaultIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vaultFileName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  vaultFileDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
