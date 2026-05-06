import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getAllLawyers, getLawyerById, setAvailability, updateProfile, createAppointment } from '../controllers/lawyers.js';

const router = express.Router();

router.get('/',               getAllLawyers);
router.patch('/availability', authenticateToken, setAvailability);
router.put('/profile',        authenticateToken, updateProfile);
router.post('/appointments',  authenticateToken, createAppointment);
router.get('/:id',            getLawyerById);

export default router;
