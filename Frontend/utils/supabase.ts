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

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: 'lawyerup-supabase-auth',
      },
    })
  : (missingSupabaseClient as any);
