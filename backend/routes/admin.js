import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getStats, getLogs, getUsers, updateUserStatus, deleteUser, verifyLawyer } from '../controllers/admin.js';

const router = express.Router();

router.get('/stats',             authenticateToken, requireRole('admin'), getStats);
router.get('/logs',              authenticateToken, requireRole('admin'), getLogs);
router.get('/users',             authenticateToken, requireRole('admin'), getUsers);
router.patch('/users/:id/status',authenticateToken, requireRole('admin'), updateUserStatus);
router.delete('/users/:id',      authenticateToken, requireRole('admin'), deleteUser);
router.patch('/lawyers/:id/verify', authenticateToken, requireRole('admin'), verifyLawyer);

export default router;
