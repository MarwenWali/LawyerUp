import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ATTACHMENTS_BUCKET = 'message-attachments';
const MAX_MESSAGES_PER_MINUTE = 30;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function sanitizeFileName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, {
      error: 'Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY).',
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return json(401, { error: 'Missing bearer token' });
  }

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
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return json(401, { error: 'Invalid or expired token' });
  }

  const contentType = req.headers.get('content-type') ?? '';
  let conversationId = '';
  let content = '';
  let attachment: File | null = null;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      conversationId = String(form.get('conversation_id') ?? '').trim();
      content = String(form.get('content') ?? '').trim();
      const file = form.get('attachment');
      if (file instanceof File) {
        attachment = file;
      }
    } else {
      const body = await req.json();
      conversationId = String(body?.conversation_id ?? '').trim();
      content = String(body?.content ?? '').trim();
    }
  } catch {
    return json(400, { error: 'Invalid request body' });
  }

  if (!isUuid(conversationId)) {
    return json(400, { error: 'Invalid conversation_id' });
  }

  if (!content && !attachment) {
    return json(400, { error: 'Message content or attachment is required' });
  }

  const { data: participantRow, error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (participantError) {
    return json(500, { error: 'Failed to validate conversation access' });
  }

  if (!participantRow) {
    return json(403, { error: 'You are not a participant in this conversation' });
  }

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count: sentLastMinute, error: rateError } = await supabaseAdmin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', user.id)
    .gte('created_at', oneMinuteAgo);

  if (rateError) {
    return json(500, { error: 'Failed to enforce rate limit' });
  }

  if ((sentLastMinute ?? 0) >= MAX_MESSAGES_PER_MINUTE) {
    return json(429, { error: 'Rate limit exceeded: max 30 messages per minute' });
  }

  let attachmentUrl: string | null = null;

  if (attachment) {
    if (!ALLOWED_MIME_TYPES.has(attachment.type)) {
      return json(400, {
        error: 'Unsupported attachment type. Allowed: image/jpeg, image/png, image/webp, application/pdf',
      });
    }

    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      return json(400, { error: 'Attachment too large. Max size is 5MB.' });
    }

    const safeName = sanitizeFileName(attachment.name || 'attachment');
    const objectPath = `${conversationId}/${user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(objectPath, attachment, {
        contentType: attachment.type,
        upsert: false,
      });

    if (uploadError) {
      return json(500, { error: `Attachment upload failed: ${uploadError.message}` });
    }

    attachmentUrl = `${ATTACHMENTS_BUCKET}/${objectPath}`;
  }

  const messageInsert: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: user.id,
    content,
  };

  if (attachmentUrl) {
    messageInsert.attachment_url = attachmentUrl;
  }

  const { data: insertedMessage, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert(messageInsert)
    .select('id, conversation_id, sender_id, content, created_at')
    .single();

  if (insertError || !insertedMessage) {
    console.error('send-message insert error', insertError);
    return json(500, { error: insertError?.message || 'Failed to send message' });
  }

  const message = {
    ...insertedMessage,
    ...(attachmentUrl ? { attachment_url: attachmentUrl } : {}),
  };

  const { error: readInsertError } = await supabaseAdmin
    .from('message_reads')
    .insert({
      message_id: insertedMessage.id,
      user_id: user.id,
    });

  if (readInsertError && readInsertError.code !== '23505') {
    console.error('send-message read error', readInsertError);
    return json(500, {
      error: readInsertError.message || 'Message sent but failed to mark as read for sender',
    });
  }

  return json(200, {
    message,
    rate_limit: {
      max_per_minute: MAX_MESSAGES_PER_MINUTE,
      used_in_last_minute: (sentLastMinute ?? 0) + 1,
    },
  });
});
