import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const usingManagedPostgres = Boolean(
  (connectionString && connectionString.includes('supabase.co')) ||
  (connectionString && connectionString.includes('pooler.supabase.com'))
);

console.log(`[DB Config] Using string: ${connectionString ? 'Yes (hidden)' : 'No'}`);
console.log(`[DB Config] Managed logic: ${usingManagedPostgres}`);

const poolConfig = connectionString
  ? {
      connectionString,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'lawyerup',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

if (process.env.DB_SSL === 'false') {
  poolConfig.ssl = false;
} else if (usingManagedPostgres) {
  poolConfig.ssl = { rejectUnauthorized: false };
} else {
  poolConfig.ssl = false; // Default off for local
}

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log(
    usingManagedPostgres
      ? 'Connected to Supabase Postgres database'
      : 'Connected to PostgreSQL database'
  );
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
  process.exit(-1);
});

export default pool;
