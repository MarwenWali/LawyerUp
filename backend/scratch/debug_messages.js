import pool from '../config/database.js';

async function debug() {
  try {
    console.log('--- Checking Admins ---');
    const admins = await pool.query("SELECT id, email, role FROM users WHERE role = 'admin'");
    console.log('Admins found:', admins.rows);

    console.log('\n--- Checking Conversations involving Admins ---');
    if (admins.rows.length > 0) {
      const adminId = admins.rows[0].id;
      const convs = await pool.query(
        "SELECT * FROM conversations WHERE citizen_id = $1 OR lawyer_id = $1",
        [adminId]
      );
      console.log('Conversations:', convs.rows);
    }

    console.log('\n--- Checking Foreign Key Constraints for messages table ---');
    const constraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'messages'::regclass
    `);
    console.log('Constraints:', constraints.rows);

    process.exit(0);
  } catch (err) {
    console.error('Debug failed:', err);
    process.exit(1);
  }
}

debug();
