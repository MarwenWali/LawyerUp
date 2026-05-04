import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { getSessions, createSession, updateSessionTitle, deleteSession, getMessages, saveMessages, generateReply } from '../controllers/chat.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/sessions',                  getSessions);
router.post('/sessions',                 createSession);
router.patch('/sessions/:id/title',      updateSessionTitle);
router.delete('/sessions/:id',           deleteSession);
router.get('/sessions/:id/messages',     getMessages);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10485760 }, // 10MB
});

router.post('/sessions/:id/messages',    saveMessages);
router.post('/sessions/:id/reply',       upload.single('attachment'), generateReply);

export default router;
