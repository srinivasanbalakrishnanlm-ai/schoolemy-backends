import express from "express";
import { sendContactEmail } from "../../Controllers/ContactController.js";

const router = express.Router();

// POST /contact
router.post("/contact", sendContactEmail);

export default router;