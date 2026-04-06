import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
const migrationsDir = path.resolve(projectRoot, 'supabase', 'migrations');

async function loadEnvMap(envPath) {
  const envRaw = await fs.readFile(envPath, 'utf8');
  const map = {};

  for (const line of envRaw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const sepIndex = line.indexOf('=');
    if (sepIndex <= 0) continue;
    map[line.slice(0, sepIndex)] = line.slice(sepIndex + 1);
  }

  return map;
}

async function listMigrationFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
    .map((entry) => path.resolve(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function applyMigrations() {
  const envMap = await loadEnvMap(backendEnvPath);
  const connectionString = envMap.SUPABASE_DB_URL;

  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL is missing in backend/.env');
  }

  const migrationFiles = await listMigrationFiles(migrationsDir);
  if (!migrationFiles.length) {
    console.log('No migration files found in supabase/migrations');
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    for (const migrationFile of migrationFiles) {
      const sql = await fs.readFile(migrationFile, 'utf8');
      await client.query(sql);
      console.log(`Applied migration: ${path.basename(migrationFile)}`);
    }
  } finally {
    await client.end();
  }
}

applyMigrations()
  .then(() => {
    console.log('Supabase migrations applied successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to apply Supabase migrations:', error.message);
    process.exit(1);
  });
