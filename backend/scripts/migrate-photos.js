/**
 * migrate-photos.js
 * Uploads legacy /uploads/... profile photos to Supabase Storage
 * and updates the database with the new public URLs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function run() {
  const client = await pool.connect();
  try {
    // Get all users with legacy relative paths
    const { rows } = await client.query(
      `SELECT id, full_name, role, profile_photo_url
       FROM users
       WHERE profile_photo_url IS NOT NULL
         AND profile_photo_url NOT LIKE 'http%'`
    );

    console.log(`Found ${rows.length} user(s) with legacy photo paths.`);

    for (const user of rows) {
      const relativePath = user.profile_photo_url; // e.g. /uploads/photo-xxx.jpeg
      const filename = path.basename(relativePath);
      const localPath = path.join(UPLOADS_DIR, filename);

      if (!fs.existsSync(localPath)) {
        console.warn(`  ⚠ File not found locally for ${user.full_name}: ${localPath}`);
        continue;
      }

      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(filename) || '.jpg';
      const role = user.role || 'user';
      const storagePath = `${role}/${user.id}/avatar${ext}`;

      console.log(`  ↑ Uploading for ${user.full_name} → ${storagePath}`);

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(storagePath, fileBuffer, {
          contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error(`  ✗ Upload failed for ${user.full_name}:`, uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(storagePath);

      await client.query(
        `UPDATE users SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [publicUrl, user.id]
      );

      console.log(`  ✓ Updated ${user.full_name}: ${publicUrl}`);
    }

    console.log('\nDone migrating users.');

    // Also check lawyers table if it exists separately
    try {
      const { rows: lawyers } = await client.query(
        `SELECT id, avatar_url FROM lawyer_profiles
         WHERE avatar_url IS NOT NULL AND avatar_url NOT LIKE 'http%'`
      );

      console.log(`\nFound ${lawyers.length} lawyer profile(s) with legacy photo paths.`);

      for (const lp of lawyers) {
        const filename = path.basename(lp.avatar_url);
        const localPath = path.join(UPLOADS_DIR, filename);

        if (!fs.existsSync(localPath)) {
          console.warn(`  ⚠ File not found for lawyer profile ${lp.id}: ${localPath}`);
          continue;
        }

        const fileBuffer = fs.readFileSync(localPath);
        const ext = path.extname(filename) || '.jpg';
        const storagePath = `lawyer/${lp.id}/avatar${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(storagePath, fileBuffer, {
            contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`  ✗ Upload failed for lawyer_profile ${lp.id}:`, uploadError.message);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(storagePath);

        await client.query(
          `UPDATE lawyer_profiles SET avatar_url = $1 WHERE id = $2`,
          [publicUrl, lp.id]
        );
        console.log(`  ✓ Updated lawyer_profile ${lp.id}: ${publicUrl}`);
      }
    } catch (e) {
      console.log('  (lawyer_profiles table not found or no legacy entries)');
    }

    console.log('\n✅ Migration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
