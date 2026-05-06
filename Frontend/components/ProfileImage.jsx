import React, { useState, useEffect, useMemo } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/useTheme';
import { BASE_URL } from '@/services/api';

export default function ProfileImage({ url, size = 60, style, fallbackText }) {
  const C = useTheme();
  const [error, setError] = useState(false);

  // Reset error state only when the source URL actually changes
  useEffect(() => {
    setError(false);
  }, [url]);

  // Resolve full URL once per render:
  // 1. Absolute https (Supabase) → strip old cache-bust, add stable daily one
  // 2. Relative /uploads/... → prepend backend BASE_URL
  // 3. Null/undefined → show fallback
  const fullUrl = useMemo(() => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const base = url.split('?')[0];
      // Stable daily cache-bust so the URL doesn't change every render
      const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      return `${base}?d=${day}`;
    }
    if (url.startsWith('/')) {
      return `${BASE_URL}${url}`;
    }
    return null;
  }, [url]);

  return (
    <View style={[
      styles.container,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: C.accentLight },
      style,
    ]}>
      {fullUrl && !error ? (
        <Image
          source={{ uri: fullUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={(e) => {
            console.log('[ProfileImage] Error loading image:', fullUrl, e.nativeEvent?.error || e);
            setError(true);
          }}
        />
      ) : fallbackText ? (
        <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: C.accent }}>
          {String(fallbackText).slice(0, 2).toUpperCase()}
        </Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color={C.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
