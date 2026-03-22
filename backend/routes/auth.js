import express from 'express';
import { body } from 'express-validator';
import { upload } from '../middleware/upload.js';
import { register, login, verifyToken } from '../controllers/auth.js';

const router = express.Router();

router.post('/register',
  upload.single('diploma'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').trim().notEmpty(),
    body('phoneNumber').optional().trim(),
    body('role').isIn(['user', 'lawyer']),
  ],
  register
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    body('role').optional().isIn(['user', 'lawyer', 'admin']),
  ],
  login
);

router.get('/verify', verifyToken);

export default router;
