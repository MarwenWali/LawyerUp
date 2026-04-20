/**
 * AI Chat Route – /api/ai/chat
 *
 * Public endpoint (no authentication required) that proxies a user message
 * to the Python AI engine running on localhost:8001 and returns the response.
 * Authenticated users get the same experience; auth is optional here.
 */
import express from 'express';
import { getAIResponse } from '../services/aiEngine.js';

const router = express.Router();

/**
 * POST /api/ai/chat
 * Body: { message: string, history?: Array<{ sender: string, content: string }> }
 * Returns: { response: string }
 */
router.post('/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim();

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // history is an optional array of past messages for context
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  try {
    const aiText = await getAIResponse(message, history, {});
    return res.json({ response: aiText });
  } catch (err) {
    console.error('[AI Proxy] Error calling AI engine:', err.message);

    // Return a user-friendly message instead of a 500
    return res.status(502).json({
      error: 'AI assistant is unavailable right now. Please try again in a moment.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * GET /api/ai/health
 * Proxies the health check to the Python AI engine.
 */
router.get('/health', async (_req, res) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(
      `${process.env.AI_ENGINE_URL || 'http://127.0.0.1:8001'}/health`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const data = await r.json();
    return res.json({ aiEngine: data, status: r.ok ? 'online' : 'degraded' });
  } catch (err) {
    return res.status(503).json({ aiEngine: 'offline', error: err.message });
  }
});

export default router;
