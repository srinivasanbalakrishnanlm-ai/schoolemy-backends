import express from "express";
import {getExamQuestionsByCourseAndChapter} from "../../Controllers/Exam-Controller/Exam-Question-Controll.js";
import {submitExamAttempt , getUserExamAttempts} from "../../Controllers/Exam-Controller/User-Submit-Answer.js"
const router = express.Router();

router.get("/exam-question", getExamQuestionsByCourseAndChapter);
router.post("/user/exam/answer-submit", submitExamAttempt);
router.get("/user/exam/result", getUserExamAttempts);

export default router;