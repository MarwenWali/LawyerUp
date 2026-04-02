import pool from "../config/database.js";
import { getAIResponse } from "../services/aiEngine.js";

export async function askGuest(req, res) {
  try {
    const message = req.body?.message;
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const safeHistory = history
      .filter(
        (m) =>
          m &&
          (m.sender === "user" || m.sender === "ai") &&
          typeof m.content === "string",
      )
      .slice(-8)
      .map((m) => ({ sender: m.sender, content: m.content }));

    const aiContent = await getAIResponse(message.trim(), safeHistory, {
      mode: "guest",
    });

    res.status(200).json({
      aiMessage: {
        id: `guest-ai-${Date.now()}`,
        sender: "ai",
        content: aiContent,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /chat/guest-ask error:", err);
    res.status(500).json({ error: "Failed to process guest AI message" });
  }
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
      [req.user.id],
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error("GET /chat/sessions error:", err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

export async function createSession(req, res) {
  try {
    const { title = "New Chat" } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *`,
      [req.user.id, title],
    );
    res.status(201).json({ session: rows[0] });
  } catch (err) {
    console.error("POST /chat/sessions error:", err);
    res.status(500).json({ error: "Failed to create session" });
  }
}

export async function updateSessionTitle(req, res) {
  try {
    const { title } = req.body;
    if (!title?.trim())
      return res.status(400).json({ error: "title is required" });
    await pool.query(
      `UPDATE chat_sessions SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [title.trim(), req.params.id, req.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /chat/sessions/:id/title error:", err);
    res.status(500).json({ error: "Failed to update title" });
  }
}

export async function deleteSession(req, res) {
  try {
    await pool.query(
      `DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /chat/sessions/:id error:", err);
    res.status(500).json({ error: "Failed to delete session" });
  }
}

export async function getMessages(req, res) {
  try {
    const { rows: sess } = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!sess.length)
      return res.status(404).json({ error: "Session not found" });

    const { rows } = await pool.query(
      `SELECT id, sender, content, created_at
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [req.params.id],
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error("GET /chat/sessions/:id/messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

export async function saveMessages(req, res) {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const { rows: sess } = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!sess.length)
      return res.status(404).json({ error: "Session not found" });

    const inserted = [];
    for (const msg of messages) {
      const { rows } = await pool.query(
        `INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3) RETURNING *`,
        [req.params.id, msg.sender, msg.content],
      );
      inserted.push(rows[0]);
    }

    await pool.query(
      `UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [req.params.id],
    );

    res.status(201).json({ messages: inserted });
  } catch (err) {
    console.error("POST /chat/sessions/:id/messages error:", err);
    res.status(500).json({ error: "Failed to save messages" });
  }
}

export async function askInSession(req, res) {
  try {
    const sessionId = req.params.id;
    const message = req.body?.message;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const { rows: sess } = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.id],
    );
    if (!sess.length)
      return res.status(404).json({ error: "Session not found" });

    const { rows: historyRows } = await pool.query(
      `SELECT sender, content, created_at
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );

    const aiResponse = await getAIResponse(message.trim(), historyRows, {
      userId: req.user.id,
      sessionId,
    });

    const inserted = [];

    const { rows: userInsert } = await pool.query(
      `INSERT INTO chat_messages (session_id, sender, content)
       VALUES ($1, 'user', $2)
       RETURNING id, sender, content, created_at`,
      [sessionId, message.trim()],
    );
    inserted.push(userInsert[0]);

    const { rows: aiInsert } = await pool.query(
      `INSERT INTO chat_messages (session_id, sender, content)
       VALUES ($1, 'ai', $2)
       RETURNING id, sender, content, created_at`,
      [sessionId, aiResponse],
    );
    inserted.push(aiInsert[0]);

    await pool.query(
      `UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [sessionId],
    );

    res.status(201).json({
      userMessage: inserted[0],
      aiMessage: inserted[1],
    });
  } catch (err) {
    console.error("POST /chat/sessions/:id/ask error:", err);
    res.status(500).json({ error: "Failed to process AI chat message" });
  }
}
