import pool from '../config/database.js';
import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '../config/supabase.js';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30000 }
});

export async function getSessions(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         cs.id,
         cs.title,
         cs.created_at,
         cs.updated_at,
         COUNT(cm.id)::int                                    AS message_count,
         (SELECT cm2.content
          FROM chat_messages cm2
          WHERE cm2.session_id = cs.id
          ORDER BY cm2.created_at DESC
          LIMIT 1)                                            AS last_message
       FROM chat_sessions cs
       LEFT JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.user_id = $1
       GROUP BY cs.id
       ORDER BY cs.updated_at DESC`,
      [req.user.id]
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error('GET /chat/sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}

export async function createSession(req, res) {
  try {
    const { title = 'New Chat' } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *`,
      [req.user.id, title]
    );
    res.status(201).json({ session: rows[0] });
  } catch (err) {
    console.error('POST /chat/sessions error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
}

export async function updateSessionTitle(req, res) {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    await pool.query(
      `UPDATE chat_sessions SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [title.trim(), req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /chat/sessions/:id/title error:', err);
    res.status(500).json({ error: 'Failed to update title' });
  }
}

export async function deleteSession(req, res) {
  try {
    await pool.query(
      `DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /chat/sessions/:id error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
}

export async function getMessages(req, res) {
  try {
    const { rows: sess } = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!sess.length) return res.status(404).json({ error: 'Session not found' });

    const { rows } = await pool.query(
      `SELECT id, sender, content, created_at
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error('GET /chat/sessions/:id/messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

export async function saveMessages(req, res) {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const { rows: sess } = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!sess.length) return res.status(404).json({ error: 'Session not found' });

    const inserted = [];
    for (const msg of messages) {
      const { rows } = await pool.query(
        `INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3) RETURNING *`,
        [req.params.id, msg.sender, msg.content]
      );
      inserted.push(rows[0]);
    }

    await pool.query(
      `UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.status(201).json({ messages: inserted });
  } catch (err) {
    console.error('POST /chat/sessions/:id/messages error:', err);
    res.status(500).json({ error: 'Failed to save messages' });
  }
}

export async function generateReply(req, res) {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const { rows: sess } = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!sess.length) return res.status(404).json({ error: 'Session not found' });

    const { rows: insertedUserRows } = await pool.query(
      `INSERT INTO chat_messages (session_id, sender, content)
       VALUES ($1, 'user', $2)
       RETURNING id, sender, content, created_at`,
      [req.params.id, content]
    );
    const userMessage = insertedUserRows[0];

    const { rows: historyRows } = await pool.query(
      `SELECT sender, content
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT 40`,
      [req.params.id]
    );

    let aiText;
    try {
      // 1. Vectorize
      const embedResult = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: content,
        config: { outputDimensionality: 768 },
      });
      const query_embedding = embedResult.embeddings[0].values;

      // 2. Query Supabase
      const { data: docs, error: rpcError } = await supabaseAdmin.rpc('match_legal_docs', {
        query_embedding,
        match_threshold: 0.5,
        match_count: 3,
      });

      if (rpcError) throw new Error(`Supabase RPC Error: ${rpcError.message}`);

      let contextText = '';
      if (docs && docs.length > 0) {
        contextText = docs.map((doc) => {
          const articleName = doc.metadata?.article_name || 'Unknown Article';
          const source = doc.metadata?.source || 'Unknown Source';
          return `[Source: ${source} | Article: ${articleName}]\n${doc.content}`;
        }).join('\n\n');
      }

      // 3. Inference
      const systemInstruction = `You are the LawyerUp AI Assistant, an expert in Tunisian Law. Use the provided Arabic legal context to answer the user's question accurately.
DETECTION: Identify the language the user is speaking (Tunisian Derja, Standard Arabic, French, or English) and respond ONLY in that exact language. If the answer isn't in the context, inform them politely in their language.

CITATION: At the end of your response, you MUST cite the article_name from the metadata provided in the context so the user knows which law is being cited.

Context:
${contextText}`;

      const chatResult = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: content,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
        },
      });

      aiText = chatResult.text;
    } catch (aiError) {
      console.log('AI Error:', aiError);
      console.error('POST /chat/sessions/:id/reply ai error:', aiError);
      await pool.query('DELETE FROM chat_messages WHERE id = $1', [userMessage.id]);
      return res.status(502).json({ error: 'AI assistant unavailable right now. Please try again.' });
    }

    const { rows: insertedAiRows } = await pool.query(
      `INSERT INTO chat_messages (session_id, sender, content)
       VALUES ($1, 'ai', $2)
       RETURNING id, sender, content, created_at`,
      [req.params.id, aiText]
    );
    const aiMessage = insertedAiRows[0];

    await pool.query(
      `UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.status(201).json({ userMessage, aiMessage });
  } catch (err) {
    console.error('POST /chat/sessions/:id/reply error:', err);
    res.status(500).json({ error: 'Failed to generate AI reply' });
  }
}
