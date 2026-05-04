import pool from './config/database.js';

async function run() {
  await pool.query('DROP TABLE IF EXISTS appointments CASCADE;');
  await pool.query(`
    CREATE TABLE appointments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('lawyer', 'court', 'other')),
      date TIMESTAMP NOT NULL,
      location VARCHAR(255),
      lawyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_appointments_user_id ON appointments(user_id);
    CREATE INDEX idx_appointments_date ON appointments(date);
  `);
  console.log('Appointments table recreated');
  process.exit(0);
}

run().catch(console.error);
