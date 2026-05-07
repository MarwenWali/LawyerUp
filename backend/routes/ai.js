/**
 * AI Chat Route – /api/ai/chat
 *
 * Public endpoint (no authentication required) that proxies a user message
 * to the Python AI engine running on localhost:8001 and returns the response.
 * Authenticated users get the same experience; auth is optional here.
 */
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { getAIResponse } from '../services/aiEngine.js';
import { askRAG } from '../controllers/aiController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
let geminiAi;

function getGeminiAi() {
  if (!geminiAi) {
    geminiAi = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 30000 },
    });
  }
  return geminiAi;
}

async function transcribeWithGemini(file) {
  let lastError;
  const transcriptionModels = [
    process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
  ];
  const ai = getGeminiAi();
  const models = [...new Set(transcriptionModels.filter(Boolean))];

  for (const model of models) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Transcribe the spoken words in this audio file. Return only the transcript text. If there is no speech, return an empty string.',
              },
              {
                inlineData: {
                  data: file.buffer.toString('base64'),
                  mimeType: file.mimetype || 'audio/webm',
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0,
        },
      });

      return String(result.text || '').trim();
    } catch (err) {
      const errMsg = String(err?.message || err?.toString() || '');
      const errStatus = err?.status || err?.httpStatusCode || err?.code;
      lastError = err;

      const isRetryable =
        errStatus === 429 ||
        errStatus === 503 ||
        errStatus === 404 ||
        /429|quota|rate.?limit|resource.?exhausted|overload|not.?found|unavailable/i.test(errMsg);

      if (!isRetryable) throw err;
      console.warn(`[AI Transcribe] Gemini model ${model} failed; trying fallback.`, errMsg.slice(0, 200));
    }
  }

  throw lastError;
}

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
 * POST /api/ai/transcribe
 * Multipart body: audio=<webm|mp4|mpeg|mp3|m4a|wav file>
 * Returns: { transcript: string }
 *
 * The server keeps the upload in memory only, sends it to Gemini for
 * transcription, and drops the buffer when the request finishes.
 */
router.post('/transcribe', optionalAuth, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'audio file is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the backend' });
  }

  try {
    const transcript = await transcribeWithGemini(req.file);
    if (!transcript) {
      return res.status(422).json({ error: 'No speech was detected in the recording' });
    }

    return res.json({ transcript });
  } catch (err) {
    console.error('[AI Transcribe] Error:', err);
    return res.status(502).json({
      error: 'Transcription service is unavailable right now.',
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

/**
 * POST /api/ai/ask
 * Body: { message: string }
 * Multilingual RAG Controller: Vectorizes the query, retrieves Supabase context,
 * and responds in the detected language using Gemini 1.5 Flash.
 */
router.post('/ask', optionalAuth, askRAG);

export default router;
