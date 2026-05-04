import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(mimeType) {
  if (!mimeType) return 'document-outline';
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType === 'application/pdf') return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('msword')) return 'document-outline';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-outline';
  return 'attach-outline';
}

/**
 * @param {object}   props
 * @param {object}   props.message       - Message object from the API
 * @param {boolean}  props.isOwn         - Whether the current user sent this message
 * @param {object}   props.theme         - App colour theme (C)
 * @param {function} [props.onImagePress] - Called with (url) when user taps an image thumbnail
 */
export function MessageBubble({ message, isOwn, theme, onImagePress }) {
  const C = theme || {};
  const ownBgColor = C.tint || '#007AFF';
  const otherBgColor = C.card || '#E9E9EB';

  const isImage = message.message_type === 'image';
  const isFile  = message.message_type === 'file';
  const hasAttachment = isImage || isFile;

  const bubbleStyle = isOwn
    ? [styles.ownBubble,   { backgroundColor: ownBgColor }]
    : [styles.otherBubble, { backgroundColor: otherBgColor, borderColor: otherBgColor }];

  function handleImagePress() {
    if (!message.attachment_url) return;
    if (onImagePress) {
      // Use the parent-provided Modal viewer (preferred)
      onImagePress(message.attachment_url);
    } else {
      // Fallback: open in browser (works when attachment_url is a public Supabase URL)
      Linking.openURL(message.attachment_url).catch(() => {});
    }
  }

  function handleFilePress() {
    if (message.attachment_url) {
      Linking.openURL(message.attachment_url).catch(() => {});
    }
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, bubbleStyle, hasAttachment && styles.attachmentBubble]}>

        {/* ── Image attachment ── */}
        {isImage && message.attachment_url ? (
          <Pressable onPress={handleImagePress} style={styles.imageWrapper}>
            <Image
              source={{ uri: message.attachment_url }}
              style={styles.attachedImage}
              resizeMode="cover"
            />
            {/* Tap-to-expand hint */}
            <View style={styles.expandHint}>
              <Ionicons name="expand-outline" size={13} color="rgba(255,255,255,0.9)" />
            </View>
          </Pressable>
        ) : null}

        {/* ── File attachment ── */}
        {isFile && message.attachment_url ? (
          <Pressable onPress={handleFilePress} style={[
            styles.fileRow,
            { backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }
          ]}>
            <Ionicons
              name={getFileIcon(message.attachment_type)}
              size={22}
              color={isOwn ? '#fff' : (C.foreground || '#111')}
            />
            <Text
              style={[styles.fileName, { color: isOwn ? '#fff' : (C.foreground || '#111') }]}
              numberOfLines={2}
            >
              {message.attachment_name || 'Attachment'}
            </Text>
            <Ionicons
              name="download-outline"
              size={18}
              color={isOwn ? 'rgba(255,255,255,0.7)' : (C.mutedForeground || '#888')}
            />
          </Pressable>
        ) : null}

        {/* ── Text content (caption for attachments, or standalone text) ── */}
        {message.content ? (
          <Text style={[
            styles.messageText,
            { color: isOwn ? '#FFFFFF' : (C.foreground || '#000000') },
            hasAttachment && styles.captionText,
          ]}>
            {message.content}
          </Text>
        ) : null}

        {/* ── Timestamp + read receipt ── */}
        <View style={[styles.metaRow, hasAttachment && styles.metaRowAttachment]}>
          <Text style={[styles.time, { color: isOwn ? 'rgba(255,255,255,0.7)' : (C.mutedForeground || '#8E8E93') }]}>
            {formatTime(message.created_at)}
          </Text>
          {isOwn && (
            <Ionicons
              name={message.is_read ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={message.is_read ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
              style={styles.receipt}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  attachmentBubble: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  ownBubble: {
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 6,
  },
  // ── Image ──
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  attachedImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  expandHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    padding: 3,
  },
  // ── File ──
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  // ── Text ──
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 6,
  },
  captionText: {
    marginTop: 2,
    fontSize: 14,
  },
  // ── Meta ──
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  metaRowAttachment: {
    paddingHorizontal: 6,
  },
  time: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  receipt: {
    marginLeft: 2,
  },
});
