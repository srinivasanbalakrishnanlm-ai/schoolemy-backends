import express from "express";
import multer from "multer";
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} from "../../Controllers/Evet-Controller/event.controller.js";

const router = express.Router();

// Multer Memory Storage for Images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ------------------------
// Routes
// ------------------------
router.post("/", upload.array("coverImages"), createEvent);
router.get("/", getAllEvents);
router.get("/:id", getEventById);
router.put("/:id", upload.array("coverImages"), updateEvent);
router.delete("/:id", deleteEvent);

export default router;
