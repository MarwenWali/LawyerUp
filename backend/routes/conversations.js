import express from 'express';
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

const router = express.Router();

router.use(authenticateToken);

router.post('/', startConversation);
router.get('/', listConversations);
router.get('/:id/messages', getConversationMessages);
router.post('/:id/messages', sendConversationMessage);
router.patch('/:id/read', markConversationRead);

export default router;
