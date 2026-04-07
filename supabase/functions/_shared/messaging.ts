import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export type ConversationType = 'admin_lawyer' | 'lawyer_user';
export type AppRole = 'admin' | 'lawyer' | 'user';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function handleOptions(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseConversationType(raw: unknown): ConversationType {
  const value = String(raw ?? '').trim();
  if (value !== 'admin_lawyer' && value !== 'lawyer_user') {
    throw new HttpError(400, 'Invalid conversation type');
  }
  return value;
}

export function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(
      500,
      'Missing environment variables: SUPABASE_URL, SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
}

async function getRoleByUserId(
  supabaseAdmin: ReturnType<typeof createClient>,
  authUserId: string
): Promise<{ publicUserId: string; role: AppRole }> {
  const { data: link, error: linkError } = await supabaseAdmin
    .from('auth_user_links')
    .select('public_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (linkError) {
    throw new HttpError(500, 'Failed to resolve auth-user mapping');
  }

  const publicUserId = link?.public_user_id || authUserId;
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', publicUserId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, 'Failed to load user role');
  }

  const role = data?.role;
  if (role !== 'admin' && role !== 'lawyer' && role !== 'user') {
    throw new HttpError(403, 'User role not allowed for messaging');
  }

  if (!link?.public_user_id && data?.id === authUserId) {
    // Keep mapping table complete for direct id-matched legacy users.
    await supabaseAdmin
      .from('auth_user_links')
      .upsert({ public_user_id: authUserId, auth_user_id: authUserId }, { onConflict: 'public_user_id' });
  }

  return {
    publicUserId: data.id,
    role,
  };
}

export async function requireAuth(req: Request) {
  assertEnv();

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing bearer token');
  }

  const token = authHeader.slice(7);
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const identity = await getRoleByUserId(supabaseAdmin, user.id);

  return {
    user,
    authUserId: user.id,
    publicUserId: identity.publicUserId,
    userRole: identity.role,
    supabaseAuth,
    supabaseAdmin,
  };
}

export async function ensureParticipant(
  supabaseAdmin: ReturnType<typeof createClient>,
  conversationId: string,
  userId: string
) {
  const { data, error } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, 'Failed to verify participant access');
  }

  if (!data) {
    throw new HttpError(403, 'You are not a participant in this conversation');
  }
}

export function toAppRole(value: unknown): AppRole | null {
  const role = String(value ?? '').trim();
  if (role === 'admin' || role === 'lawyer' || role === 'user') return role;
  return null;
}
