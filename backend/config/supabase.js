import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

function buildClient(key) {
  if (!supabaseUrl || !key) {
    return null;
  }

  return createClient(supabaseUrl, key, clientOptions);
}

export const supabase = buildClient(supabasePublishableKey);
export const supabaseAdmin = buildClient(supabaseServiceRoleKey);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

export function requireSupabase({ admin = false } = {}) {
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL in environment.');
  }

  if (admin) {
    if (!supabaseServiceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment.');
    }
    return supabaseAdmin;
  }

  if (!supabasePublishableKey) {
    throw new Error('Missing SUPABASE_PUBLISHABLE_KEY in environment.');
  }

  return supabase;
}
