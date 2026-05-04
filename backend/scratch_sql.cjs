const { pool } = require('./config/db.js');
async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vault_files (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name VARCHAR(255),
      file_url TEXT NOT NULL,
      file_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_vault_files_user_id ON vault_files(user_id);
  `);
  console.log('Vault files table created');
  process.exit(0);
}
run().catch(console.error);
