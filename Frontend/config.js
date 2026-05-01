import { Platform } from 'react-native';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.50.66:3000';
export const AI_SERVICE_URL = `${API_URL}/api/ai/ask`;
