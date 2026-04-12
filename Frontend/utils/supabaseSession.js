import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

export async function clearSupabaseSessionCache() {
  try {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  } catch {
    // Ignore local sign-out failures and fall through to storage cleanup.
  }

  try {
    const keys = await AsyncStorage.getAllKeys();
    const supabaseKeys = keys.filter(
      (key) => key.startsWith('sb-') && key.includes('-auth-token')
    );

    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
    }
  } catch {
    // Best effort cleanup only.
  }
}
