import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getLawyerReviews, getMyReview, submitReview, deleteReview } from '../controllers/reviews.js';

const router = express.Router();

router.get('/lawyer/:id',     getLawyerReviews);
router.get('/mine/:lawyerId', authenticateToken, getMyReview);
router.post('/',              authenticateToken, requireRole('user'), submitReview);
router.delete('/:id',         authenticateToken, deleteReview);

export default router;
