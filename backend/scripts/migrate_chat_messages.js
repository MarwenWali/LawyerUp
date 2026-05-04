import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file'));
ALTER TABLE chat_messages ALTER COLUMN content DROP NOT NULL;
UPDATE chat_messages SET content = '' WHERE content IS NULL;
`;

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
