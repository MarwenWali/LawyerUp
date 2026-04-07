import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  getMe, updateMe, changePassword, uploadPhoto,
  getAllUsers, getUserById, updateUser, deleteUser,
} from '../controllers/users.js';

const router = express.Router();

router.get('/me',             authenticateToken,                  getMe);
router.put('/me',             authenticateToken,                  updateMe);
router.patch('/me/password',  authenticateToken,                  changePassword);
router.post('/me/photo',      authenticateToken, upload.single('photo'), uploadPhoto);
router.get('/',             authenticateToken, requireRole('admin'), getAllUsers);
router.get('/:id',          authenticateToken, requireRole('admin'), getUserById);
router.put('/:id',          authenticateToken, requireRole('admin'), updateUser);
router.delete('/:id',       authenticateToken, requireRole('admin'), deleteUser);

export default router;
