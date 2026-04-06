import {
  HttpError,
  ensureParticipant,
  handleOptions,
  isUuid,
  json,
  requireAuth,
} from '../_shared/messaging.ts';

Deno.serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { authUserId, supabaseAuth, supabaseAdmin } = await requireAuth(req);

    const url = new URL(req.url);
    const conversationId = String(url.searchParams.get('conversation_id') ?? '').trim();
    const limitParam = Number(url.searchParams.get('limit') ?? '30');
    const beforeParam = url.searchParams.get('before');

    if (!isUuid(conversationId)) {
      throw new HttpError(400, 'Invalid conversation_id');
    }

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 100) : 30;

    let beforeIso: string | null = null;
    if (beforeParam) {
      const parsed = new Date(beforeParam);
      if (Number.isNaN(parsed.getTime())) {
        throw new HttpError(400, 'Invalid before cursor. Expected ISO date string.');
      }
      beforeIso = parsed.toISOString();
    }

    await ensureParticipant(supabaseAdmin, conversationId, authUserId);

    const { data, error } = await supabaseAuth.rpc('list_messages_for_conversation', {
      p_conversation_id: conversationId,
      p_limit: limit,
      p_before: beforeIso,
    });

    if (error) {
      throw new HttpError(500, 'Failed to list conversation messages');
    }

    const messages = Array.isArray(data) ? data : [];
    const nextBefore = messages.length ? messages[messages.length - 1]?.created_at ?? null : null;

    return json(200, {
      messages,
      pagination: {
        limit,
        next_before: nextBefore,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.message });
    }

    console.error('conversations-messages error', error);
    return json(500, { error: 'Unexpected server error' });
  }
});
