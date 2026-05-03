import pool from '../config/database.js';
import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '../config/supabase.js';
import { lawyerAppTools, getLawyers, sendMessageToLawyer } from '../services/aiTools.js';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30000 }
});

// ── Model fallback chain (confirmed available on this API key) ──────────────
// gemini-2.5-flash: powerful default
// gemini-2.0-flash: fallback
// gemini-2.5-flash-lite: high-quota last resort
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite-001'];

async function geminiGenerate(params) {
  let lastError;
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[AI Agent] Trying model: ${model}`);
      const result = await ai.models.generateContent({ ...params, model });
      console.log(`[AI Agent] Success with model: ${model}`);
      return result;
    } catch (err) {
      const errMsg = String(err?.message || err?.toString() || '');
      const errStatus = err?.status || err?.httpStatusCode || err?.code;
      console.warn(`[AI Agent] Model ${model} failed (status=${errStatus}): ${errMsg.slice(0, 200)}`);
      lastError = err;
      // Retry on quota exhaustion, rate limits, overload, or model not found
      const isRetryable =
        errStatus === 429 || errStatus === 503 || errStatus === 404 ||
        /429|quota|rate.?limit|resource.?exhausted|overload|not.?found|unavailable/i.test(errMsg);
      if (!isRetryable) throw err;
      console.log(`[AI Agent] Retryable error — trying next model in fallback list...`);
    }
  }
  throw lastError;
}

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

    // Save user message
    const { rows: insertedUserRows } = await pool.query(
      `INSERT INTO chat_messages (session_id, sender, content)
       VALUES ($1, 'user', $2)
       RETURNING id, sender, content, created_at`,
      [req.params.id, content]
    );
    const userMessage = insertedUserRows[0];

    // Load last 40 messages for context
    const { rows: historyRows } = await pool.query(
      `SELECT sender, content FROM chat_messages
       WHERE session_id = $1 ORDER BY created_at ASC LIMIT 40`,
      [req.params.id]
    );

    let aiText;
    try {
      // ── STEP 1: RAG embedding (non-fatal — falls back if Supabase RPC missing) ──
      let contextText = '';
      try {
        console.log('[AI Agent] Step 1: Embedding user message...');
        const embedResult = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: content,
          config: { outputDimensionality: 768 },
        });
        const query_embedding = embedResult.embeddings[0].values;
        console.log('[AI Agent] Step 2: Querying Supabase match_legal_docs...');
        const { data: docs, error: rpcError } = await supabaseAdmin.rpc('match_legal_docs', {
          query_embedding,
          match_threshold: 0.5,
          match_count: 3,
        });
        if (rpcError) {
          console.warn('[AI Agent] RAG RPC error (non-fatal):', rpcError.message);
        } else if (docs && docs.length > 0) {
          contextText = docs.map((doc) => {
            const articleName = doc.metadata?.article_name || 'Unknown Article';
            const source = doc.metadata?.source || 'Unknown Source';
            return `[Source: ${source} | Article: ${articleName}]\n${doc.content}`;
          }).join('\n\n');
          console.log(`[AI Agent] RAG found ${docs.length} relevant documents.`);
        } else {
          console.log('[AI Agent] RAG returned no documents for this query.');
        }
      } catch (ragErr) {
        // RAG is optional — log and continue without context
        console.warn('[AI Agent] RAG step failed (non-fatal), continuing without context:', ragErr.message);
      }

      // ── STEP 2: Build system instruction + conversation history ──
      const systemInstruction = `You are the LawyerUp Assistant. You have access to the app's database and can perform actions on behalf of the user.

Lawyer Recommendations: If the user asks about lawyers, finding a lawyer, or who is the best lawyer, ALWAYS call the getLawyers tool to fetch real data. Never make up lawyer names or IDs. Only recommend lawyers found in the database.

Messaging: If the user wants to contact or message a lawyer, FIRST you must have their valid lawyerId.
- If you DO NOT have the lawyerId (e.g., the user only gave a name), silently call the getLawyers tool to search for the lawyer. DO NOT tell the user you need to find the ID.
- Once you have the lawyerId and the user wants to send a message, draft a professional message and ask the user: "Here is the draft message: [message]. Should I send it?"
- Do NOT call sendMessageToLawyer until the user explicitly confirms they want to send it.

Important: When calling sendMessageToLawyer, you MUST use a valid lawyerId. Do NOT guess or hallucinate UUIDs.

Confirmation: ONLY call sendMessageToLawyer after the user explicitly confirms (e.g., 'Yes', 'Send it', 'Go ahead').

Tone: Be professional but friendly. Respond in Tunisian Derja if the user writes in Derja, in French if they write in French, otherwise English or Arabic.

Legal Context (use this to answer law questions):
${contextText || 'No specific legal articles found for this query. Answer based on general Tunisian law knowledge.'}`;

      const conversationHistory = historyRows.map(row => ({
        role: row.sender === 'user' ? 'user' : 'model',
        parts: [{ text: row.content }],
      }));

      // Safety: Gemini requires at least one user-role content
      let currentContents = conversationHistory.length > 0
        ? [...conversationHistory]
        : [{ role: 'user', parts: [{ text: content }] }];

      let MAX_TURNS = 5;
      let turnCount = 0;
      aiText = '';

      while (turnCount < MAX_TURNS) {
        turnCount++;
        console.log(`[AI Agent] Step 3: Calling Gemini (Turn ${turnCount})...`);
        const result = await geminiGenerate({
          contents: currentContents,
          config: {
            systemInstruction,
            temperature: 0.4,
            tools: [{ functionDeclarations: lawyerAppTools }],
          },
        });

        const responseParts = result.candidates?.[0]?.content?.parts || [];
        const functionCallPart = responseParts.find(p => p.functionCall);
        const textPart = responseParts.find(p => p.text);

        if (functionCallPart) {
          const call = functionCallPart.functionCall;
          let toolResult;

          console.log(`[AI Agent] Function call requested: ${call.name}`, call.args);

          if (call.name === 'getLawyers') {
            toolResult = await getLawyers(call.args.specialty, call.args.minRating, call.args.name);
          } else if (call.name === 'sendMessageToLawyer') {
            let lawyerId = call.args.lawyerId;
            const messageBody = call.args.messageBody;

            // Validate lawyerId — must be a UUID.
            const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!lawyerId || !UUID_REGEX.test(lawyerId)) {
              console.log(`[AI Agent] lawyerId "${lawyerId}" is not a UUID — auto-resolving via getLawyers...`);
              const nameHint = (!lawyerId || lawyerId === 'undefined') ? '' : lawyerId;
              const lawyerList = await getLawyers(undefined, undefined, nameHint);
              if (Array.isArray(lawyerList) && lawyerList.length > 0) {
                lawyerId = lawyerList[0].id;
                console.log(`[AI Agent] Resolved lawyerId to: ${lawyerId} (${lawyerList[0].name})`);
              } else {
                toolResult = { error: 'Could not find a lawyer matching that name. Please ask the user to clarify.' };
                lawyerId = null;
              }
            }

            if (lawyerId) {
              toolResult = await sendMessageToLawyer(lawyerId, messageBody, req.user.id);
            }
          } else {
            toolResult = { error: `Unknown function: ${call.name}` };
          }

          console.log(`[AI Agent] Tool result:`, JSON.stringify(toolResult));

          // Append model's tool call AND the tool's response to contents for the next turn
          currentContents.push({ role: 'model', parts: [{ functionCall: call }] });
          currentContents.push({ role: 'tool', parts: [{ functionResponse: { name: call.name, response: { output: toolResult } } }] });
          
          // Loop continues to let Gemini generate text based on the tool result
        } else {
          // No function call, we have our final text response
          aiText = textPart?.text || result.text || 'I was unable to generate a response.';
          break;
        }
      }

      if (!aiText && turnCount >= MAX_TURNS) {
         aiText = "I had to stop thinking because I reached my maximum number of steps. Please try again.";
      }
    } catch (aiError) {
      console.error('[AI Agent] Error details:', {
        message: aiError.message,
        status: aiError.status,
        stack: aiError.stack,
      });
      await pool.query('DELETE FROM chat_messages WHERE id = $1', [userMessage.id]);
      return res.status(502).json({ 
        error: 'AI assistant unavailable right now. Please try again.',
        detail: process.env.NODE_ENV === 'development' ? aiError.message : undefined,
      });
    }

    // 7. Save AI response and return
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
