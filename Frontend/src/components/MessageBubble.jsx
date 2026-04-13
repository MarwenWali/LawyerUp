import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBubble({ message, isOwn, theme }) {
  // Logic: compare message.sender_id with current user's id (passed as isOwn prop)
  const bubbleStyle = isOwn
    ? [styles.ownBubble, { backgroundColor: '#007AFF' }] // Blue for Sent
    : [styles.otherBubble, { backgroundColor: '#E9E9EB', borderColor: '#E9E9EB' }]; // Grey for Received

  return (
    <View style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, bubbleStyle]}>
        <Text style={[styles.messageText, { color: isOwn ? '#FFFFFF' : '#000000' }]}>
          {message.content}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.time, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#8E8E93' }]}>
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
  ownBubble: {
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  time: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  receipt: {
    marginLeft: 2,
  },
  sender: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});
