import express from 'express';
import { generatePublicReply } from '../controllers/ai.js';

const router = express.Router();

router.post('/reply', generatePublicReply);

export default router;
