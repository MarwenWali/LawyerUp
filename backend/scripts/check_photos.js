import pool from '../config/database.js';

const { rows } = await pool.query(`
  SELECT
    c.id,
    citizen.full_name AS citizen_name,
    citizen.profile_photo_url AS citizen_photo,
    lawyer.full_name AS lawyer_name,
    lawyer.profile_photo_url AS lawyer_photo
  FROM conversations c
  JOIN users citizen ON citizen.id = c.citizen_id
  JOIN users lawyer ON lawyer.id = c.lawyer_id
  WHERE citizen.full_name = 'Ahmed Ben Ali'
  LIMIT 5
`);

console.log(JSON.stringify(rows, null, 2));
await pool.end();
