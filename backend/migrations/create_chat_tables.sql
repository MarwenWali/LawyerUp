-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: AI Chat Sessions & Messages
-- Creates the tables needed for the /api/chat/* endpoints used by the mobile app.
-- Run once against the lawyerup PostgreSQL database.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Chat sessions (one conversation thread per session) ──────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Chat',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id     ON chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at  ON chat_sessions (updated_at DESC);

-- ── Chat messages (individual turns inside a session) ────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id  ON chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at  ON chat_messages (session_id, created_at ASC);
