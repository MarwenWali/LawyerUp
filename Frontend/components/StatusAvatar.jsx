import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ProfileImage from './ProfileImage';
import { useTheme } from '@/constants/useTheme';

const StatusAvatar = ({ url, size = 64, isAvailable, onPhotoPress, showEditIcon = false }) => {
  const C = useTheme();
  
  const ringSize = size + 8;
  const dotSize = Math.max(12, size * 0.18);
  const editSize = Math.max(20, size * 0.3);

  return (
    <View style={styles.container}>
      <Pressable onPress={onPhotoPress} style={styles.wrapper}>
        <View style={[
          styles.ring, 
          { 
            width: ringSize, 
            height: ringSize, 
            borderRadius: ringSize / 2,
            borderColor: isAvailable ? C.success : C.destructive 
          }
        ]}>
          <ProfileImage url={url} size={size} />
        </View>
        
        {/* Availability Dot */}
        <View style={[
          styles.statusDot, 
          { 
            width: dotSize, 
            height: dotSize, 
            borderRadius: dotSize / 2,
            backgroundColor: isAvailable ? C.success : C.destructive,
            borderColor: C.card,
            bottom: size * 0.1,
            right: size * 0.1,
          }
        ]} />

        {/* Optional Edit Camera Icon */}
        {showEditIcon && (
          <View style={[
            styles.editIcon, 
            { 
              width: editSize, 
              height: editSize, 
              borderRadius: editSize / 2,
              backgroundColor: C.accent,
              borderColor: C.card,
            }
          ]}>
            <Feather name="camera" size={editSize * 0.5} color="#fff" />
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapper: {
    position: 'relative',
  },
  ring: {
    padding: 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 2,
    zIndex: 2,
  },
  editIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
});

export default StatusAvatar;
