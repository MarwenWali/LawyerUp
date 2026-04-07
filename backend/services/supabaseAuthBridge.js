import crypto from 'crypto';
import pool from '../config/database.js';
import {
  supabase,
  supabaseAdmin,
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
} from '../config/supabase.js';

let ensureAuthLinksInitPromise = null;

function assertBridgeConfigured() {
  if (!isSupabaseConfigured || !isSupabaseAdminConfigured || !supabase || !supabaseAdmin) {
    throw new Error('Supabase auth bridge is not configured. Missing Supabase env variables.');
  }
}

function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

async function ensureAuthUserLinksTable(db = pool) {
  if (ensureAuthLinksInitPromise) {
    await ensureAuthLinksInitPromise;
    return;
  }

  ensureAuthLinksInitPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS auth_user_links (
        public_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_user_links_auth_user_id
      ON auth_user_links(auth_user_id)
    `);
  })();

  try {
    await ensureAuthLinksInitPromise;
  } catch (error) {
    ensureAuthLinksInitPromise = null;
    throw error;
  }
}

function buildTemporaryPassword() {
  return `${crypto.randomBytes(18).toString('base64url')}Aa1!`;
}

async function getLinkByPublicUserId(publicUserId, db = pool) {
  const result = await db.query(
    `SELECT public_user_id, auth_user_id
     FROM auth_user_links
     WHERE public_user_id = $1
     LIMIT 1`,
    [publicUserId]
  );
  return result.rows[0] || null;
}

async function upsertAuthLink(publicUserId, authUserId, db = pool) {
  await db.query(
    `INSERT INTO auth_user_links (public_user_id, auth_user_id)
     VALUES ($1, $2)
     ON CONFLICT (public_user_id)
     DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, updated_at = CURRENT_TIMESTAMP`,
    [publicUserId, authUserId]
  );
}

async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.session || !data?.user) return null;
  return data;
}

function isSupabaseDuplicateUserError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('email exists') ||
    error?.code === 'email_exists'
  );
}

async function createAuthUser({ email, password, role, fullName, publicUserId }) {
  const attrs = {
    email,
    password: password || buildTemporaryPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: fullName || null,
      role,
      public_user_id: publicUserId,
    },
    app_metadata: {
      role,
      public_user_id: publicUserId,
    },
  };

  const { data, error } = await supabaseAdmin.auth.admin.createUser(attrs);
  if (error) {
    if (isSupabaseDuplicateUserError(error)) {
      return null;
    }
    throw new Error(error?.message || 'Failed to create Supabase auth user');
  }
  if (!data?.user) {
    throw new Error('Failed to create Supabase auth user');
  }

  return data.user;
}

async function updateAuthUserPassword(authUserId, password, role, fullName, publicUserId) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || null,
      role,
      public_user_id: publicUserId,
    },
    app_metadata: {
      role,
      public_user_id: publicUserId,
    },
  });

  if (error) {
    throw new Error(`Failed to sync Supabase password: ${error.message}`);
  }
}

export async function ensureSupabaseMessagingIdentity({
  publicUserId,
  email,
  role,
  fullName,
  password,
  db = pool,
}) {
  assertBridgeConfigured();
  await ensureAuthUserLinksTable(db);

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Cannot bridge auth identity without email');
  }

  let authUserId = (await getLinkByPublicUserId(publicUserId, db))?.auth_user_id || null;
  let sessionData = null;
  let createdAuthUser = false;

  if (password) {
    const signedIn = await signInWithPassword(normalizedEmail, password);
    if (signedIn) {
      authUserId = signedIn.user.id;
      sessionData = signedIn;
      await upsertAuthLink(publicUserId, authUserId, db);
    }
  }

  if (!authUserId) {
    const createdUser = await createAuthUser({
      email: normalizedEmail,
      password,
      role,
      fullName,
      publicUserId,
    });

    if (createdUser) {
      authUserId = createdUser.id;
      createdAuthUser = true;
    } else if (password) {
      const existingSignIn = await signInWithPassword(normalizedEmail, password);
      if (!existingSignIn) {
        throw new Error(
          'A Supabase auth account already exists for this email, but credentials could not be verified. Reset password to continue.'
        );
      }
      authUserId = existingSignIn.user.id;
      sessionData = existingSignIn;
    } else {
      throw new Error('A Supabase auth account already exists for this email. Sign in once to link messaging identity.');
    }

    await upsertAuthLink(publicUserId, authUserId, db);
  }

  if (password && !sessionData) {
    const signInAttempt = await signInWithPassword(normalizedEmail, password);

    if (signInAttempt) {
      sessionData = signInAttempt;
      if (signInAttempt.user.id !== authUserId) {
        authUserId = signInAttempt.user.id;
        await upsertAuthLink(publicUserId, authUserId, db);
      }
    } else {
      await updateAuthUserPassword(authUserId, password, role, fullName, publicUserId);

      const secondSignIn = await signInWithPassword(normalizedEmail, password);
      if (!secondSignIn) {
        throw new Error('Failed to create Supabase session after syncing auth credentials');
      }

      sessionData = secondSignIn;
      if (secondSignIn.user.id !== authUserId) {
        authUserId = secondSignIn.user.id;
        await upsertAuthLink(publicUserId, authUserId, db);
      }
    }
  }

  return {
    authUserId,
    createdAuthUser,
    session: sessionData?.session || null,
  };
}

export async function syncSupabasePasswordForPublicUser({
  publicUserId,
  email,
  role,
  fullName,
  password,
  db = pool,
}) {
  assertBridgeConfigured();
  await ensureAuthUserLinksTable(db);

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Cannot sync Supabase password without email');
  }

  const { authUserId } = await ensureSupabaseMessagingIdentity({
    publicUserId,
    email: normalizedEmail,
    role,
    fullName,
    password,
    db,
  });

  await updateAuthUserPassword(authUserId, password, role, fullName, publicUserId);
}

export async function deleteSupabaseAuthUser(authUserId) {
  assertBridgeConfigured();
  if (!authUserId) return;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  if (error) {
    throw new Error(`Failed to delete Supabase auth user: ${error.message}`);
  }
}
