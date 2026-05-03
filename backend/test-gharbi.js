import dotenv from 'dotenv';
dotenv.config();
import pool from './config/database.js';

async function test() {
  const res = await pool.query('SELECT id, full_name, role, is_verified FROM users WHERE full_name ILIKE $1', ['%gharbi%']);
  console.log(res.rows);
  process.exit(0);
}
test();
