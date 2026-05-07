import { getAIResponse } from '../services/aiEngine.js';

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-30)
    .map((item) => ({
      sender: String(item?.sender || '').trim().toLowerCase(),
      content: String(item?.content || '').trim(),
    }))
    .filter((item) => (item.sender === 'user' || item.sender === 'ai') && item.content);
}

export async function generatePublicReply(req, res) {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const history = sanitizeHistory(req.body?.history);
    const response = await getAIResponse(content, history, {
      source: 'public_guest_chat',
    });

    return res.json({ response });
  } catch (error) {
    console.error('POST /api/ai/reply error:', error);
    return res.status(502).json({
      error: 'AI assistant unavailable right now. Please try again.',
    });
  }
}
