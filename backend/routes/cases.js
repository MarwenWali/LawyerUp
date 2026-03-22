import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getAllCases, createCase, updateCaseStatus, getCaseById } from '../controllers/cases.js';

const router = express.Router();

router.get('/',             authenticateToken,                    getAllCases);
router.post('/',            authenticateToken, requireRole('user'),   createCase);
router.patch('/:id/status', authenticateToken, requireRole('lawyer'), updateCaseStatus);
router.get('/:id',          authenticateToken,                    getCaseById);

export default router;
