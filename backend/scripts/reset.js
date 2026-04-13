import pool from '../config/database.js';

async function reset() {
  try {
    console.log('🗑️  Dropping all tables...');

    await pool.query(`
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS contact_requests CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS conversations CASCADE;
      DROP TABLE IF EXISTS cases CASCADE;
      DROP TABLE IF EXISTS lawyer_profiles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS guest_prompts CASCADE;
      DROP TYPE IF EXISTS conversation_status CASCADE;
      DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
    `);

    console.log('✅ Database reset completed!');
    console.log('💡 Run "npm run db:migrate" to recreate tables');
    console.log('💡 Run "npm run db:seed" to add demo data');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

reset();
