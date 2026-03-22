import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getContacts, createContact, updateContact } from '../controllers/contacts.js';

const router = express.Router();

router.get('/',    authenticateToken,                  getContacts);
router.post('/',   authenticateToken, requireRole('user'),    createContact);
router.patch('/:id', authenticateToken, requireRole('lawyer'), updateContact);

export default router;
