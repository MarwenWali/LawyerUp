require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

p.query(`SELECT id, full_name, role, profile_photo_url FROM users WHERE profile_photo_url IS NOT NULL ORDER BY updated_at DESC LIMIT 10`)
  .then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    p.end();
  })
  .catch(e => { console.error(e.message); p.end(); });
