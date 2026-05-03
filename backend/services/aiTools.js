import pool from '../config/database.js';

export const lawyerAppTools = [
  {
    name: "getLawyers",
    description: "Queries the database for all lawyers or filters by specialty, rating, and name. Returns each lawyer's id, name, specialization, and rating. Always call this when the user asks about lawyers or mentions a specific lawyer name.",
    parameters: {
      type: "object",
      properties: {
        specialty: {
          type: "string",
          description: "Optional. The legal specialty to filter by (e.g. 'Criminal', 'Corporate', 'Family'). Leave empty to get all lawyers."
        },
        minRating: {
          type: "number",
          description: "Optional. The minimum rating out of 5.0 to filter by."
        },
        name: {
          type: "string",
          description: "Optional. The name of the lawyer to search for (e.g. 'Gharbi')."
        }
      },
      required: []
    }
  },
  {
    name: "sendMessageToLawyer",
    description: "Sends a contact request message to a specific lawyer on behalf of the authenticated user. Only call this after the user explicitly confirms they want to send.",
    parameters: {
      type: "object",
      properties: {
        lawyerId: {
          type: "string",
          description: "The UUID of the lawyer to contact. Get this from getLawyers first."
        },
        messageBody: {
          type: "string",
          description: "The full text of the message to send to the lawyer."
        }
      },
      required: ["lawyerId", "messageBody"]
    }
  }
];

export async function getLawyers(specialty, minRating, name) {
  try {
    let query = `
      SELECT u.id, u.full_name as name, lp.specialization, lp.rating 
      FROM users u
      JOIN lawyer_profiles lp ON u.id = lp.user_id
      WHERE u.role = 'lawyer' AND u.is_verified = true
    `;
    const params = [];
    
    if (specialty) {
      params.push(`%${specialty}%`);
      query += ` AND lp.specialization ILIKE $${params.length}`;
    }
    
    if (minRating !== undefined && minRating !== null) {
      params.push(minRating);
      query += ` AND lp.rating >= $${params.length}`;
    }

    if (name) {
      const nameParts = name.trim().split(/\s+/);
      for (const part of nameParts) {
        params.push(`%${part}%`);
        query += ` AND u.full_name ILIKE $${params.length}`;
      }
    }

    query += ` ORDER BY lp.rating DESC`;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return { message: 'No lawyers found matching those criteria.' };
    }
    return result.rows;
  } catch (error) {
    console.error('Error in getLawyers tool:', error);
    return { error: 'Failed to fetch lawyers from the database.' };
  }
}

export async function sendMessageToLawyer(lawyerId, messageBody, userId) {
  if (!userId) {
    return { error: 'User must be logged in to send a message.' };
  }

  // Guard: lawyerId must be a valid UUID or we'll crash Postgres
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!lawyerId || !UUID_REGEX.test(lawyerId)) {
    return { error: `Invalid lawyer ID "${lawyerId}". Please call getLawyers first to obtain the correct UUID.` };
  }

  if (!messageBody || !messageBody.trim()) {
    return { error: 'Message body cannot be empty.' };
  }

  try {
    // 0. Verify the lawyer actually exists in the database
    const lawyerCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND role = $2', [lawyerId, 'lawyer']);
    if (lawyerCheck.rows.length === 0) {
      return { error: `Lawyer with ID "${lawyerId}" does not exist. Please call the getLawyers tool first to find a real lawyer ID from the database.` };
    }

    // 1. Find or create conversation
    let convResult = await pool.query(
      'SELECT id FROM conversations WHERE citizen_id = $1 AND lawyer_id = $2 LIMIT 1',
      [userId, lawyerId]
    );
    
    let conversationId;
    if (convResult.rows.length > 0) {
      conversationId = convResult.rows[0].id;
    } else {
      const colCheck = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'conversations' AND column_name = 'type' LIMIT 1`
      );
      const hasTypeCol = colCheck.rows.length > 0;
      
      const insertQuery = hasTypeCol
        ? `INSERT INTO conversations (citizen_id, lawyer_id, type) VALUES ($1, $2, 'lawyer_user') RETURNING id`
        : `INSERT INTO conversations (citizen_id, lawyer_id) VALUES ($1, $2) RETURNING id`;
        
      const insertResult = await pool.query(insertQuery, [userId, lawyerId]);
      conversationId = insertResult.rows[0].id;
    }

    // 2. Insert the message
    const msgResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, is_read)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [conversationId, userId, messageBody]
    );

    // 3. Update conversation last_message_at
    await pool.query(
      `UPDATE conversations
       SET last_message_at = CURRENT_TIMESTAMP, status = 'active'
       WHERE id = $1`,
      [conversationId]
    );

    return { success: true, message: 'Your message has been sent to the lawyer successfully.', messageId: msgResult.rows[0].id };
  } catch (error) {
    console.error('Error in sendMessageToLawyer tool:', error);
    return { error: 'Failed to send message. Please try again.' };
  }
}
