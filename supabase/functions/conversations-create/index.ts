import {
  HttpError,
  handleOptions,
  isUuid,
  json,
  parseConversationType,
  requireAuth,
  toAppRole,
} from '../_shared/messaging.ts';

Deno.serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { authUserId, publicUserId, userRole, supabaseAdmin } = await requireAuth(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }

    const type = parseConversationType(body.type);
    const targetUserId = String(body.target_user_id ?? '').trim();

    if (!isUuid(targetUserId)) {
      throw new HttpError(400, 'Invalid target_user_id');
    }

    if (targetUserId === publicUserId) {
      throw new HttpError(400, 'Cannot create conversation with yourself');
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetUserError) {
      throw new HttpError(500, 'Failed to fetch target user');
    }

    if (!targetUser) {
      throw new HttpError(404, 'Target user not found');
    }

    const targetRole = toAppRole(targetUser.role);
    if (!targetRole) {
      throw new HttpError(400, 'Target user role is invalid');
    }

    const { data: targetLink, error: targetLinkError } = await supabaseAdmin
      .from('auth_user_links')
      .select('auth_user_id')
      .eq('public_user_id', targetUserId)
      .maybeSingle();

    if (targetLinkError) {
      throw new HttpError(500, 'Failed to resolve target messaging identity');
    }

    const targetAuthUserId = String(targetLink?.auth_user_id || targetUserId);
    if (!isUuid(targetAuthUserId)) {
      throw new HttpError(400, 'Target messaging identity is invalid');
    }

    const { data: authTarget, error: authTargetError } = await supabaseAdmin.auth.admin.getUserById(targetAuthUserId);
    if (authTargetError || !authTarget?.user) {
      throw new HttpError(409, 'Target user has no active messaging identity yet. Ask them to sign in once.');
    }

    if (type === 'admin_lawyer') {
      const allowedPair =
        (userRole === 'admin' && targetRole === 'lawyer') ||
        (userRole === 'lawyer' && targetRole === 'admin');

      if (!allowedPair) {
        throw new HttpError(403, 'admin_lawyer conversations require one admin and one lawyer');
      }
    }

    if (type === 'lawyer_user') {
      const allowedPair =
        (userRole === 'lawyer' && targetRole === 'user') ||
        (userRole === 'user' && targetRole === 'lawyer');

      if (!allowedPair) {
        throw new HttpError(403, 'lawyer_user conversations require one lawyer and one user');
      }

      const lawyerId = userRole === 'lawyer' ? publicUserId : targetUserId;
      const endUserId = userRole === 'user' ? publicUserId : targetUserId;

      const { data: hasAcceptedRelation, error: relationError } = await supabaseAdmin.rpc(
        'has_accepted_lawyer_user_relationship',
        {
          p_lawyer_id: lawyerId,
          p_user_id: endUserId,
        }
      );

      if (relationError) {
        throw new HttpError(500, 'Failed to verify accepted lawyer-user relationship');
      }

      if (!hasAcceptedRelation) {
        throw new HttpError(403, 'No accepted case/contact relationship between this lawyer and user');
      }
    }

    const { data: existingConversationId, error: findError } = await supabaseAdmin.rpc('find_direct_conversation', {
      p_type: type,
      p_user_a: authUserId,
      p_user_b: targetAuthUserId,
    });

    if (findError) {
      throw new HttpError(500, 'Failed to check existing conversation');
    }

    if (existingConversationId) {
      return json(200, {
        conversation: {
          id: existingConversationId,
          type,
          created_new: false,
        },
      });
    }

    const { data: newConversation, error: conversationInsertError } = await supabaseAdmin
      .from('conversations')
      .insert({ type })
      .select('id, type, created_at, updated_at')
      .single();

    if (conversationInsertError || !newConversation) {
      throw new HttpError(500, 'Failed to create conversation');
    }

    const { error: participantInsertError } = await supabaseAdmin
      .from('conversation_participants')
      .upsert(
        [
          {
            conversation_id: newConversation.id,
            user_id: authUserId,
            role: userRole,
          },
          {
            conversation_id: newConversation.id,
            user_id: targetAuthUserId,
            role: targetRole,
          },
        ],
        { onConflict: 'conversation_id,user_id' }
      );

    if (participantInsertError) {
      await supabaseAdmin.from('conversations').delete().eq('id', newConversation.id);
      throw new HttpError(500, 'Failed to add conversation participants');
    }

    return json(201, {
      conversation: {
        id: newConversation.id,
        type: newConversation.type,
        created_new: true,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.message });
    }

    console.error('conversations-create error', error);
    return json(500, { error: 'Unexpected server error' });
  }
});
