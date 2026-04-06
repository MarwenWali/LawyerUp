import pool from '../config/database.js';
import { ensureSupabaseMessagingIdentity } from '../services/supabaseAuthBridge.js';

async function provisionAuthUsers() {
  try {
    console.log('Starting Supabase auth identity provisioning...');

    const { rows: users } = await pool.query(
      `SELECT id, email, full_name, role
       FROM users
       ORDER BY created_at ASC`
    );

    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await ensureSupabaseMessagingIdentity({
          publicUserId: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
        });
        success += 1;
        console.log(`Provisioned: ${user.email}`);
      } catch (error) {
        failed += 1;
        console.error(`Failed: ${user.email} -> ${error.message}`);
      }
    }

    console.log(`Provisioning complete. Success: ${success}, Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Provisioning script failed:', error);
    process.exit(1);
  }
}

provisionAuthUsers();