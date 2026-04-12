import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function formatTimestamp(isoValue) {
  if (!isoValue) return '';
  const date = new Date(isoValue);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ConversationCard({ conversation, theme, onPress, online = false }) {
  const participant = conversation.other_participant || conversation.citizen || conversation.lawyer || {};
  const initials = participant.initials
    || (participant.name || '?')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const preview = conversation.last_message_preview || conversation.last_message?.content || 'No messages yet';
  const unread = Number(conversation.unread_count || 0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.accentLight }]}>
        <Text style={[styles.avatarText, { color: theme.accent }]}>{initials}</Text>
        {online && <View style={[styles.onlineDot, { backgroundColor: theme.success }]} />}
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.name, { color: theme.foreground }]} numberOfLines={1}>
            {participant.name || 'Conversation'}
          </Text>
          <Text style={[styles.time, { color: theme.mutedForeground }]}>
            {formatTimestamp(conversation.last_message_at || conversation.created_at)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text
            style={[
              styles.preview,
              { color: unread ? theme.foreground : theme.mutedForeground },
              unread > 0 && { fontFamily: 'Inter_600SemiBold' },
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.tint }]}>
              <Text style={[styles.badgeText, { color: theme.primaryForeground }]}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  body: {
    flex: 1,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  time: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  preview: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
});
