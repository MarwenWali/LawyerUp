-- Migration: Add attachment support to the messages table
-- Adds message_type, attachment_url, attachment_name, attachment_type columns

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type   TEXT    NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- Optional: index on message_type for filtering
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
