require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

p.query(`SELECT id, full_name, email, role, profile_photo_url FROM users WHERE email = 'user@demo.com'`)
  .then(res => {
    console.log('user@demo.com:', JSON.stringify(res.rows, null, 2));
    return p.query(`
      SELECT c.id as conv_id, c.citizen_id, c.lawyer_id,
             u.full_name as citizen_name, u.profile_photo_url as citizen_photo,
             l.full_name as lawyer_name, l.profile_photo_url as lawyer_photo
      FROM conversations c
      JOIN users u ON u.id = c.citizen_id
      JOIN users l ON l.id = c.lawyer_id
      WHERE u.email = 'user@demo.com'
      LIMIT 5
    `);
  })
  .then(res => {
    console.log('\nConversations for user@demo.com:');
    console.log(JSON.stringify(res.rows, null, 2));
    p.end();
  })
  .catch(e => { console.error(e.message); p.end(); });
