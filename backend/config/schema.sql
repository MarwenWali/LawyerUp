-- LawyerUp Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for regular users and lawyers)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'lawyer', 'admin')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mapping between app users and Supabase auth users
CREATE TABLE IF NOT EXISTS auth_user_links (
  public_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lawyer profiles (additional info for lawyers)
CREATE TABLE IF NOT EXISTS lawyer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialization VARCHAR(100) NOT NULL,
  bar_number VARCHAR(50),
  diploma_url VARCHAR(500),
  bio TEXT,
  experience_years INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.00,
  cases_handled INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  office_address TEXT,
  consultation_fee DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cases table
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'rejected')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (for case communications)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact requests table
CREATE TABLE IF NOT EXISTS contact_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, case_id)
);

-- Guest prompts tracking (for AI chat)
CREATE TABLE IF NOT EXISTS guest_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL,
  prompt_count INTEGER DEFAULT 0,
  last_prompt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs table (for admin panel)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fix any NULL is_verified values before enforcing NOT NULL
UPDATE users SET is_verified = FALSE WHERE is_verified IS NULL;
-- Ensure is_verified is never NULL going forward
ALTER TABLE users ALTER COLUMN is_verified SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_verified SET DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR(500);

-- Drop old status check constraint (if any) and re-add with 'rejected' included
DO $$ DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass AND contype = 'c' AND conname ILIKE '%status%'
  LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || con_name;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'suspended', 'pending', 'rejected'));

-- Backward-compatibility patches for older databases
-- Older installs may already have these tables but with fewer columns.
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS bar_number VARCHAR(50);
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS diploma_url VARCHAR(500);
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.00;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS cases_handled INTEGER DEFAULT 0;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS office_address TEXT;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(10,2);
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE lawyer_profiles
SET specialization = 'General'
WHERE specialization IS NULL;

ALTER TABLE lawyer_profiles ALTER COLUMN specialization SET DEFAULT 'General';
ALTER TABLE lawyer_profiles ALTER COLUMN specialization SET NOT NULL;

ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();

ALTER TABLE cases ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS subject VARCHAR(255);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'title'
  ) THEN
    UPDATE cases SET subject = title WHERE subject IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'specialty_id'
  ) THEN
    UPDATE cases SET category = specialty_id::text WHERE category IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'urgency'
  ) THEN
    UPDATE cases
    SET priority = CASE
      WHEN urgency >= 8 THEN 'high'
      WHEN urgency >= 4 THEN 'medium'
      ELSE 'low'
    END
    WHERE priority IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
DECLARE
  status_type TEXT;
BEGIN
  SELECT c.udt_name INTO status_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'cases'
    AND c.column_name = 'status'
  LIMIT 1;

  IF status_type IS NOT NULL AND status_type NOT IN ('text', 'varchar') THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''pending''', status_type);
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''accepted''', status_type);
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''completed''', status_type);
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''rejected''', status_type);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS case_id UUID;
DO $$
BEGIN
  -- Only patch legacy case-messages schema. If conversation_id exists, this is the new Supabase messaging table.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS case_id UUID;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id UUID;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'citizen_id'
  ) THEN
    UPDATE reviews SET user_id = citizen_id WHERE user_id IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Legacy case-messages backfill only.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'appointment_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'conversation_id'
  ) THEN
    UPDATE messages SET case_id = appointment_id WHERE case_id IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'read_at'
  ) THEN
    UPDATE notifications
    SET is_read = TRUE
    WHERE is_read = FALSE AND read_at IS NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Rewire legacy foreign keys (profiles-based schema) to this app's users table
ALTER TABLE lawyer_profiles DROP CONSTRAINT IF EXISTS lawyer_profiles_user_id_fkey;
ALTER TABLE lawyer_profiles
  ADD CONSTRAINT lawyer_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'citizen_id'
  ) THEN
    ALTER TABLE cases ALTER COLUMN citizen_id DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_citizen_id_fkey;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_lawyer_id_fkey;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_user_id_fkey;
ALTER TABLE cases
  ADD CONSTRAINT cases_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE cases
  ADD CONSTRAINT cases_lawyer_id_fkey
  FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'appointment_id'
  ) THEN
    ALTER TABLE reviews ALTER COLUMN appointment_id DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'citizen_id'
  ) THEN
    ALTER TABLE reviews ALTER COLUMN citizen_id DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_appointment_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_citizen_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_lawyer_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_appointment_id_key;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_case_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_lawyer_id_fkey
  FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL NOT VALID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'conversation_id'
  ) THEN
    -- Supabase conversation messaging table uses auth.users ids.
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_case_id_fkey;
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
    ALTER TABLE messages
      ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  ELSE
    -- Legacy case-messages table uses app users ids.
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_case_id_fkey;
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
    ALTER TABLE messages
      ADD CONSTRAINT messages_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE messages
      ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_auth_user_links_auth_user_id ON auth_user_links(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_user_id ON lawyer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_specialization ON lawyer_profiles(specialization);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_id ON cases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'case_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_messages_case_id ON messages(case_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_user_id ON contact_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_lawyer_id ON contact_requests(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_lawyer_id ON reviews(lawyer_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auth_user_links_updated_at ON auth_user_links;
CREATE TRIGGER update_auth_user_links_updated_at BEFORE UPDATE ON auth_user_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lawyer_profiles_updated_at ON lawyer_profiles;
CREATE TRIGGER update_lawyer_profiles_updated_at BEFORE UPDATE ON lawyer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cases_updated_at ON cases;
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- AI Chat sessions per user
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages within a chat session
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
