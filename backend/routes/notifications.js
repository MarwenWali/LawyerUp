import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getNotifications, markAllRead, markRead, deleteNotification } from '../controllers/notifications.js';

const router = express.Router();

router.get('/',          authenticateToken, getNotifications);
router.patch('/read-all',authenticateToken, markAllRead);
router.patch('/:id/read',authenticateToken, markRead);
router.delete('/:id',    authenticateToken, deleteNotification);

export default router;
