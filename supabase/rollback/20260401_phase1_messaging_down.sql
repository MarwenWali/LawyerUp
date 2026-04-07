-- Phase 1 Messaging Rollback
-- File: 20260401_phase1_messaging_down.sql

begin;

-- Storage policies + bucket cleanup
DROP POLICY IF EXISTS message_attachments_select_participants ON storage.objects;
DROP POLICY IF EXISTS message_attachments_insert_participants ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'message-attachments';
DELETE FROM storage.buckets WHERE id = 'message-attachments';

-- Table policies
DROP POLICY IF EXISTS conversations_select_participants ON public.conversations;
DROP POLICY IF EXISTS conversations_insert_authenticated ON public.conversations;
DROP POLICY IF EXISTS conversations_update_participants ON public.conversations;
DROP POLICY IF EXISTS participants_select_conversation_members ON public.conversation_participants;
DROP POLICY IF EXISTS participants_insert_self_or_admin ON public.conversation_participants;
DROP POLICY IF EXISTS messages_select_participants ON public.messages;
DROP POLICY IF EXISTS messages_insert_sender_participant ON public.messages;
DROP POLICY IF EXISTS message_reads_select_participants ON public.message_reads;
DROP POLICY IF EXISTS message_reads_insert_self ON public.message_reads;

-- Triggers/functions
DROP TRIGGER IF EXISTS trg_set_conversation_updated_at ON public.messages;
DROP FUNCTION IF EXISTS public.set_conversation_updated_at();
DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid);
DROP FUNCTION IF EXISTS public.list_messages_for_conversation(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public.list_conversations_for_user(public.conversation_type);
DROP FUNCTION IF EXISTS public.has_accepted_lawyer_user_relationship(uuid, uuid);
DROP FUNCTION IF EXISTS public.find_direct_conversation(public.conversation_type, uuid, uuid);
DROP FUNCTION IF EXISTS public.is_conversation_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_conversation_participant(uuid, uuid);

-- Tables
DROP TABLE IF EXISTS public.message_reads;
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.conversation_participants;
DROP TABLE IF EXISTS public.conversations;

-- Restore legacy case messaging table name if it was moved during migration.
DO $$
DECLARE
  v_source_table text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'case_messages_legacy'
    ) THEN
      v_source_table := 'case_messages_legacy';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'case_messages'
    ) THEN
      v_source_table := 'case_messages';
    END IF;

    IF v_source_table IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO messages', v_source_table);

      IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ('idx_' || v_source_table || '_case_id')
      ) THEN
        EXECUTE format(
          'ALTER INDEX public.%I RENAME TO idx_messages_case_id',
          'idx_' || v_source_table || '_case_id'
        );
      END IF;

      IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ('idx_' || v_source_table || '_sender_id')
      ) THEN
        EXECUTE format(
          'ALTER INDEX public.%I RENAME TO idx_messages_sender_id',
          'idx_' || v_source_table || '_sender_id'
        );
      END IF;
    END IF;
  END IF;
END$$;

-- Enum
DROP TYPE IF EXISTS public.conversation_type;

commit;
