import { Router } from "express";

import { createRoomCollection, deleteRoomCollection } from "../controllers/mongodb.controller.js";

const router = Router();

router.post("/create", createRoomCollection);
router.delete("/delete", deleteRoomCollection);

export default router;