import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createChatRoom,
  deleteChatRoom,
} from "../controllers/mongodb.controller.js";

const router = Router();

router.post("/create", asyncHandler(createChatRoom, true));
router.delete("/delete", asyncHandler(deleteChatRoom, true));

export default router;
