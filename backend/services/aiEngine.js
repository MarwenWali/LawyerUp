import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const AI_ENGINE_PROVIDER = String(process.env.AI_ENGINE_PROVIDER || 'local_python')
  .trim()
  .toLowerCase();
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8001';
const AI_ENGINE_TIMEOUT_MS = Number(process.env.AI_ENGINE_TIMEOUT_MS || 120000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AI_ISS_DIR = path.join(REPO_ROOT, 'ai_iss');
const AI_ISS_BRIDGE_SCRIPT = path.join(AI_ISS_DIR, 'api_reply.py');

const PYTHON_CANDIDATES = [
  process.env.AI_ISS_PYTHON,
  path.join(AI_ISS_DIR, '.venv', 'Scripts', 'python.exe'),
  path.join(AI_ISS_DIR, 'mistral_env', 'Scripts', 'python.exe'),
  'C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\python\\python.exe',
  'C:\\Program Files\\PostgreSQL\\17\\pgAdmin 4\\python\\python.exe',
];

let pythonRuntimePromise = null;

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-40)
    .map((msg) => ({
      sender: String(msg?.sender || '').trim().toLowerCase(),
      content: String(msg?.content || '').trim(),
    }))
    .filter((msg) => (msg.sender === 'user' || msg.sender === 'ai') && msg.content);
}

async function postToAI(routePath, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_ENGINE_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_ENGINE_URL}${routePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = data?.error || data?.message || `AI engine request failed (${response.status})`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function checkPythonRuntime(exePath) {
  return new Promise((resolve) => {
    if (!exePath || !fs.existsSync(exePath)) {
      resolve(false);
      return;
    }

    const child = spawn(exePath, ['-c', "print('ok')"], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill();
      resolve(false);
    }, 5000);

    child.on('error', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(false);
    });

    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

async function resolvePythonRuntime() {
  if (pythonRuntimePromise) return pythonRuntimePromise;

  pythonRuntimePromise = (async () => {
    for (const candidate of dedupe(PYTHON_CANDIDATES)) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await checkPythonRuntime(candidate);
      if (!ok) continue;

      const lower = candidate.toLowerCase();
      return {
        pythonExe: candidate,
        isPgAdminRuntime: lower.includes('pgadmin 4\\python\\python.exe'),
      };
    }

    throw new Error(
      'No working Python runtime found for ai_iss. Set AI_ISS_PYTHON or install a local Python runtime.'
    );
  })();

  return pythonRuntimePromise;
}

function runLocalAiBridge({ runtime, message, history, context }) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(AI_ISS_BRIDGE_SCRIPT)) {
      reject(new Error(`ai_iss bridge script not found: ${AI_ISS_BRIDGE_SCRIPT}`));
      return;
    }

    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
    };

    if (runtime.isPgAdminRuntime && !process.env.AI_ISS_DISABLE_TORCH) {
      // pgAdmin's Python is isolated and may not have full torch/transformers runtime.
      env.AI_ISS_DISABLE_TORCH = '1';
    }

    const child = spawn(runtime.pythonExe, [AI_ISS_BRIDGE_SCRIPT], {
      cwd: AI_ISS_DIR,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(new Error('Local ai_iss process timed out'));
    }, AI_ENGINE_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      let parsed = null;
      try {
        parsed = JSON.parse(String(stdout || '').trim() || '{}');
      } catch {
        parsed = null;
      }

      if (code !== 0) {
        const details = parsed?.error || stderr || stdout || `Process exited with code ${code}`;
        reject(new Error(`ai_iss runtime failed: ${details}`));
        return;
      }

      if (parsed?.error) {
        reject(new Error(`ai_iss returned error: ${parsed.error}`));
        return;
      }

      const text = String(parsed?.response || '').trim();
      if (!text) {
        reject(new Error('ai_iss returned an empty response'));
        return;
      }

      resolve(text);
    });

    child.stdin.write(
      JSON.stringify({
        message,
        history,
        context,
      })
    );
    child.stdin.end();
  });
}

/**
 * Send a user message and conversation history to the AI engine and return the AI response text.
 *
 * By default this calls the local trained ai_iss pipeline through Python.
 * Set AI_ENGINE_PROVIDER=http to use external AI_ENGINE_URL endpoints instead.
 */
export async function getAIResponse(userMessage, history = [], context = {}) {
  const message = String(userMessage || '').trim();
  if (!message) {
    throw new Error('userMessage is required');
  }

  const safeHistory = sanitizeHistory(history);

  if (AI_ENGINE_PROVIDER === 'http') {
    const payload = await postToAI('/v1/reply', {
      message,
      history: safeHistory,
      context,
    });

    const text = String(payload?.response || '').trim();
    if (!text) {
      throw new Error('AI engine returned an empty response');
    }

    return text;
  }

  try {
    const runtime = await resolvePythonRuntime();
    return await runLocalAiBridge({
      runtime,
      message,
      history: safeHistory,
      context,
    });
  } catch (error) {
    // Allow recovery if runtime availability changes during process lifetime.
    pythonRuntimePromise = null;
    throw error;
  }
}

export async function analyzeCase(caseData) {
  if (AI_ENGINE_PROVIDER !== 'http') {
    throw new Error('Case analysis endpoint is only available in HTTP AI engine mode');
  }
  return postToAI('/v1/analyze-case', { case_data: caseData });
}

export async function matchLawyers(query, lawyers) {
  if (AI_ENGINE_PROVIDER !== 'http') {
    throw new Error('Lawyer matching endpoint is only available in HTTP AI engine mode');
  }
  const payload = await postToAI('/v1/match-lawyers', { query, lawyers });
  return Array.isArray(payload?.lawyer_ids) ? payload.lawyer_ids : [];
}
