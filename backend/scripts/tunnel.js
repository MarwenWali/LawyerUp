/**
 * npm run tunnel
 * ─────────────
 * 1. Kills anything on port 3000
 * 2. Starts the backend (server.js)
 * 3. Opens a localtunnel → public HTTPS URL
 * 4. Writes EXPO_PUBLIC_API_URL to frontend/.env.local
 * 5. Prints the Expo start command to use
 *
 * On any device / any network, just run:
 *   cd backend && npm run tunnel
 * then in a second terminal:
 *   cd frontend && npm start
 */

import localtunnel from 'localtunnel';
import { spawn, execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const BACKEND_DIR = resolve(__dirname, '..');
const FRONTEND_ENV = resolve(ROOT, 'frontend/.env.local');
const PORT = 3000;

// ── 1. Free the port ────────────────────────────────────────────────────────
try {
  const out = execSync(`netstat -ano | findstr ":${PORT} "`, { encoding: 'utf8' });
  const pids = [...new Set(
    out.trim().split('\n')
      .map(l => l.trim().split(/\s+/).pop())
      .filter(p => p && p !== '0' && /^\d+$/.test(p))
  )];
  for (const p of pids) {
    try { execSync(`taskkill /PID ${p} /F`, { stdio: 'ignore' }); } catch {}
  }
  if (pids.length) console.log(`🔄 Freed port ${PORT} (PIDs: ${pids.join(', ')})`);
} catch {}

// ── 2. Start the backend ────────────────────────────────────────────────────
console.log('🚀 Starting backend…');
const server = spawn('node', ['server.js'], {
  cwd: BACKEND_DIR,
  stdio: 'inherit',
  shell: false,
});

server.on('error', err => { console.error('Backend error:', err); process.exit(1); });

// Give the server 2 s to bind before opening the tunnel
await new Promise(r => setTimeout(r, 2000));

// ── 3. Open the tunnel ──────────────────────────────────────────────────────
console.log('\n🌐 Opening public tunnel…');
let tunnel;
try {
  tunnel = await localtunnel({ port: PORT });
} catch (err) {
  console.error('Failed to open tunnel:', err.message);
  server.kill();
  process.exit(1);
}

const url = tunnel.url;
console.log(`\n✅ Tunnel ready: ${url}`);

// ── 4. Write to frontend/.env.local ────────────────────────────────────────
writeFileSync(FRONTEND_ENV, `EXPO_PUBLIC_API_URL=${url}\n`);
console.log(`📝 Written to frontend/.env.local`);

// ── 5. Print instructions ───────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────');
console.log('📱 Open a NEW terminal and run:');
console.log('   cd frontend && npm start');
console.log('   The app will now work on ANY network/device.');
console.log('─────────────────────────────────────────────\n');
console.log('Press Ctrl+C to stop the backend and close the tunnel.\n');

// ── Cleanup on exit ─────────────────────────────────────────────────────────
tunnel.on('close', () => {
  console.log('\nTunnel closed.');
  server.kill();
  process.exit(0);
});

const shutdown = () => {
  console.log('\n🛑 Shutting down…');
  try { tunnel.close(); } catch {}
  server.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
