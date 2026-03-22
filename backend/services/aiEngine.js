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

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

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
  // TODO: implement when ai-engine is ready
  throw new Error('AI Engine not yet connected');
}

/**
 * Analyze a legal case description and return a structured summary.
 *
 * @param {object} caseData - { subject, description, category }
 * @returns {Promise<object>} - { summary, suggestedLawyerSpecialization, urgencyLevel }
 */
export async function analyzeCase(caseData) {
  // TODO: implement when ai-engine is ready
  throw new Error('AI Engine not yet connected');
}

/**
 * Given a user's legal query, return a ranked list of matching lawyer IDs.
 *
 * @param {string} query - Natural language description of the user's legal need
 * @param {Array<object>} lawyers - Available lawyers from the database
 * @returns {Promise<string[]>} - Ordered array of lawyer IDs
 */
export async function matchLawyers(query, lawyers) {
  // TODO: implement when ai-engine is ready
  throw new Error('AI Engine not yet connected');
}
