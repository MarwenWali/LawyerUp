import pool from './config/database.js';

async function run() {
  try {
    await pool.query("UPDATE users SET is_verified = true, status = 'active' WHERE role = 'lawyer'");
    console.log('Fixed DB');
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

run();
