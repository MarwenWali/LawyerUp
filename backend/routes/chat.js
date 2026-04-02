import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  askGuest,
  getSessions,
  createSession,
  updateSessionTitle,
  deleteSession,
  getMessages,
  saveMessages,
  askInSession,
} from "../controllers/chat.js";

const router = express.Router();

router.post("/guest-ask", askGuest);

router.use(authenticateToken);

router.get("/sessions", getSessions);
router.post("/sessions", createSession);
router.patch("/sessions/:id/title", updateSessionTitle);
router.delete("/sessions/:id", deleteSession);
router.get("/sessions/:id/messages", getMessages);
router.post("/sessions/:id/messages", saveMessages);
router.post("/sessions/:id/ask", askInSession);

export default router;
