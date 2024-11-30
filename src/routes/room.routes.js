import { Router } from "express";

import { createChatRoom, deleteChatRoom } from "../controllers/mongodb.controller.js";

const router = Router();

router.post("/create", createChatRoom);
router.delete("/delete", deleteChatRoom);

export default router;