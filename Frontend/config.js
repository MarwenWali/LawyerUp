import { Platform } from 'react-native';

// Use your computer's IP address on the network (found in Metro Bundler output)
// For Android emulator: 10.0.2.2
// For real device: use your computer's local IP (e.g., 192.168.x.x)
const LOCALHOST = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://192.168.54.22:3001';

export const API_URL = LOCALHOST;
