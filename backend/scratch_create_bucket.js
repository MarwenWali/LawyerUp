import { supabaseAdmin } from './config/supabase.js';

async function run() {
  const { data, error } = await supabaseAdmin.storage.createBucket('profiles', { public: true });
  if (error && !error.message.includes('already exists')) {
    console.error('Error creating bucket:', error);
  } else {
    console.log('Bucket profiles ready');
  }
}

run().catch(console.error);
