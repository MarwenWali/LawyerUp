import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

const missingEnvMessage =
  'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in Frontend/.env and restart Expo.';

const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabaseEnv) {
  console.warn(`[Supabase] ${missingEnvMessage}`);
}

const missingSupabaseClient = {
  channel() {
    return {
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
      async send() {
        return { error: new Error(missingEnvMessage) };
      },
      async unsubscribe() {
        return 'ok';
      },
    };
  },
  removeChannel() {
    return { error: null };
  },
  removeAllChannels() {
    return [];
  },
  getChannels() {
    return [];
  },
  auth: {
    async getSession() {
      return { data: { session: null }, error: new Error(missingEnvMessage) };
    },
    async setSession() {
      return { data: { session: null }, error: new Error(missingEnvMessage) };
    },
    async signOut() {
      return { error: null };
    },
  },
  from() {
    throw new Error(missingEnvMessage);
  },
  rpc() {
    throw new Error(missingEnvMessage);
  },
};

// Clear any stale Supabase auth session from AsyncStorage on startup.
// Our app uses JWT as its primary auth; Supabase is only used for realtime
// channels. A leftover Supabase session with an expired refresh token causes
// "Invalid Refresh Token: Refresh Token Not Found" crashes every cold boot.
// We wipe the Supabase-owned storage keys here to prevent that error.
const SUPABASE_AUTH_KEYS = [
  `sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token`,
  `sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token-code-verifier`,
];

(async () => {
  try {
    await AsyncStorage.multiRemove(SUPABASE_AUTH_KEYS);
  } catch {
    // Best-effort — never block app startup
  }
})();

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        storage: AsyncStorage,
        // autoRefreshToken disabled: JWT is our primary auth; Supabase is only
        // used for realtime channels. Auto-refreshing causes "Invalid Refresh
        // Token" crashes on startup when a stale Supabase session sits in
        // AsyncStorage. The session is refreshed explicitly after login.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : (missingSupabaseClient as any);
