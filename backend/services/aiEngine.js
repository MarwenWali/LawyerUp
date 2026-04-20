/**
 * AI Engine Service
 *
 * This module is the single interface between the backend and the ai-engine.
 * All AI-related logic (prompt formatting, HTTP calls to the engine,
 * response parsing, error handling) should live here.
 *
 * When the ai-engine is ready, implement the functions below.
 * Routes and controllers import from this file — they never call the AI directly.
 */

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8001';

async function postToAI(path, payload) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.AI_ENGINE_TIMEOUT_MS || 45000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AI_ENGINE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

/**
 * Send a user message and conversation history to the AI engine
 * and return the AI's response text.
 *
 * @param {string} userMessage - The latest user message
 * @param {Array<{sender: string, content: string}>} history - Prior messages in the session
 * @param {object} [context] - Optional context (e.g. user role, case info, lawyer profiles)
 * @returns {Promise<string>} - The AI response text
 */
export async function getAIResponse(userMessage, history = [], context = {}) {
  const payload = await postToAI('/v1/reply', {
    message: userMessage,
    history,
    context,
  });

  const text = String(payload?.response || '').trim();
  if (!text) {
    throw new Error('AI engine returned an empty response');
  }

  return text;
}

/**
 * Analyze a legal case description and return a structured summary.
 *
 * @param {object} caseData - { subject, description, category }
 * @returns {Promise<object>} - { summary, suggestedLawyerSpecialization, urgencyLevel }
 */
export async function analyzeCase(caseData) {
  return postToAI('/v1/analyze-case', { case_data: caseData });
}

/**
 * Given a user's legal query, return a ranked list of matching lawyer IDs.
 *
 * @param {string} query - Natural language description of the user's legal need
 * @param {Array<object>} lawyers - Available lawyers from the database
 * @returns {Promise<string[]>} - Ordered array of lawyer IDs
 */
export async function matchLawyers(query, lawyers) {
  const payload = await postToAI('/v1/match-lawyers', { query, lawyers });
  return Array.isArray(payload?.lawyer_ids) ? payload.lawyer_ids : [];
}
