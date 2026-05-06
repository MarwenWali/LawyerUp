/**
 * One-off script: strip the ?t= cache-bust timestamp from profile_photo_url values
 * that were stored with it in the DB. Clean URLs are stored going forward.
 * Run once: node scripts/clean_photo_urls.js
 */
import pool from '../config/database.js';

async function cleanPhotoUrls() {
  const { rows } = await pool.query(
    `SELECT id, profile_photo_url FROM users WHERE profile_photo_url LIKE '%?t=%'`
  );

  console.log(`Found ${rows.length} rows with timestamped photo URLs`);

  for (const row of rows) {
    const cleanUrl = row.profile_photo_url.split('?')[0];
    await pool.query(
      'UPDATE users SET profile_photo_url = $1 WHERE id = $2',
      [cleanUrl, row.id]
    );
    console.log(`Updated user ${row.id}: ${row.profile_photo_url} → ${cleanUrl}`);
  }

  console.log('Done.');
  await pool.end();
}

cleanPhotoUrls().catch((err) => {
  console.error(err);
  process.exit(1);
});
