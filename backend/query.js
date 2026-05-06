import pool from './config/database.js';

pool.query(`
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'appointments'::regclass;
`)
  .then(res => {
    console.log(res.rows);
    process.exit(0);
  });
