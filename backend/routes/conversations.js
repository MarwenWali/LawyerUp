import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import {
  startConversation,
  listConversations,
  markConversationRead,
} from '../controllers/conversationController.js';
import {
  getConversationMessages,
  sendConversationMessage,
} from '../controllers/messageController.js';

// ── Multer: memory storage so we can stream bytes to Supabase ────────────────
// No local disk writes — files go straight to Supabase Storage.
function messageFileFilter(_req, file, cb) {
  const ALLOWED_MIME = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Allowed: images, PDF, Word, Excel, and plain text.'));
  }
}

const uploadMessage = multer({
  storage: multer.memoryStorage(), // ← keep bytes in RAM, upload to Supabase in controller
  fileFilter: messageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = express.Router();

router.use(authenticateToken);

router.post('/', startConversation);
router.get('/', listConversations);
router.get('/:id/messages', getConversationMessages);
// Accept an optional single file field named "attachment"
router.post('/:id/messages', uploadMessage.single('attachment'), sendConversationMessage);
router.patch('/:id/read', markConversationRead);

export default router;
