import express from "express";
import {
	getClassesBySubject
} from "../../Controllers/PCM-Class-Controller/PCMClassController.js";

const router = express.Router();

// Get PCM classes by subject (changed to POST to accept body parameters)
router.post("/classes-pcm", getClassesBySubject);

export default router;
