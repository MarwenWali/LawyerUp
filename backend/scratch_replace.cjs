const fs = require('fs');
const path = 'c:/Users/Mega Pc/OneDrive - South Mediterranean University/Desktop/el7ayYrawah/backend/controllers/users.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /export async function getVaultFiles[\s\S]*?}\s*$/;
const replacement = `export async function getVaultFiles(req, res) {
  try {
    const result = await pool.query(
      \`SELECT
         m.id,
         m.message_type,
         m.attachment_name,
         m.attachment_url,
         m.created_at,
         'lawyer' AS source,
         u.full_name AS receiver_name
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       JOIN users u ON ((c.lawyer_id = u.id AND c.citizen_id = $1) OR (c.citizen_id = u.id AND c.lawyer_id = $1)) AND u.id != $1
       WHERE m.sender_id = $1 AND m.message_type IN ('file', 'image') AND m.attachment_url IS NOT NULL
       
       UNION ALL
       
       SELECT
         cm.id,
         cm.message_type,
         cm.attachment_name,
         cm.attachment_url,
         cm.created_at,
         'ai' AS source,
         'AI' AS receiver_name
       FROM chat_messages cm
       JOIN chat_sessions cs ON cm.session_id = cs.id
       WHERE cs.user_id = $1 AND cm.sender = 'user' AND cm.message_type IN ('file', 'image') AND cm.attachment_url IS NOT NULL
       
       ORDER BY created_at DESC\`,
      [req.user.id]
    );
    res.json({ files: result.rows });
  } catch (error) {
    console.error('getVaultFiles error:', error);
    res.status(500).json({ error: 'Failed to fetch vault files' });
  }
}
`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
