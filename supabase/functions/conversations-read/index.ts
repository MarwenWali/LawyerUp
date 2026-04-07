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

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { authUserId, supabaseAuth, supabaseAdmin } = await requireAuth(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }

    const conversationId = String(body.conversation_id ?? '').trim();
    if (!isUuid(conversationId)) {
      throw new HttpError(400, 'Invalid conversation_id');
    }

    await ensureParticipant(supabaseAdmin, conversationId, authUserId);

    const { data, error } = await supabaseAuth.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
    });

    if (error) {
      if (error.code === '42501') {
        throw new HttpError(403, 'You are not a participant in this conversation');
      }
      throw new HttpError(500, 'Failed to mark conversation as read');
    }

    return json(200, {
      conversation_id: conversationId,
      marked_read_count: Number(data ?? 0),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.message });
    }

    console.error('conversations-read error', error);
    return json(500, { error: 'Unexpected server error' });
  }
});
