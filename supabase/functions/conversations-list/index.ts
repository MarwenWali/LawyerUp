import {
  HttpError,
  handleOptions,
  json,
  parseConversationType,
  requireAuth,
} from '../_shared/messaging.ts';

Deno.serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { supabaseAuth } = await requireAuth(req);

    const url = new URL(req.url);
    const typeParam = url.searchParams.get('type');
    const type = typeParam ? parseConversationType(typeParam) : null;

    const { data, error } = await supabaseAuth.rpc('list_conversations_for_user', {
      p_type: type,
    });

    if (error) {
      throw new HttpError(500, 'Failed to list conversations');
    }

    return json(200, {
      conversations: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.message });
    }

    console.error('conversations-list error', error);
    return json(500, { error: 'Unexpected server error' });
  }
});