import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
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
router.get('/',                                                    getAllUsers);
router.get('/:id',                                                 getUserById);
router.put('/:id',                                                 updateUser);
router.delete('/:id',                                              deleteUser);

export default router;
