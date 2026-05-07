CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'conversation_status'
  ) THEN
    CREATE TYPE conversation_status AS ENUM ('active', 'closed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL DEFAULT 'lawyer_user' CHECK (type IN ('lawyer_user', 'admin_lawyer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status conversation_status DEFAULT 'active',
  UNIQUE (citizen_id, lawyer_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
  ) THEN
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS citizen_id UUID;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lawyer_id UUID;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'lawyer_user';
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status conversation_status DEFAULT 'active';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'user_id'
    ) THEN
      UPDATE conversations
      SET citizen_id = user_id
      WHERE citizen_id IS NULL AND user_id IS NOT NULL;
    END IF;

    UPDATE conversations
    SET last_message_at = COALESCE(last_message_at, created_at, CURRENT_TIMESTAMP)
    WHERE last_message_at IS NULL;

    UPDATE conversations
    SET type = 'lawyer_user'
    WHERE type IS NULL;

    ALTER TABLE conversations ALTER COLUMN type SET DEFAULT 'lawyer_user';
    ALTER TABLE conversations ALTER COLUMN type SET NOT NULL;
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_type_check
      CHECK (type IN ('lawyer_user', 'admin_lawyer'));

    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_citizen_id_fkey;
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_lawyer_id_fkey;
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_citizen_id_lawyer_id_key;
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_citizen_id_fkey
      FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_lawyer_id_fkey
      FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_citizen_id_lawyer_id_key UNIQUE (citizen_id, lawyer_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_citizen_id ON conversations(citizen_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lawyer_id ON conversations(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
