// routes/courseRoutes.js
import express from "express";
import { getPurchasedCoursesByUser } from "../../Controllers/Purchased-courses/purchasedcourse-controller.js";

const router = express.Router();

router.get("/user/purchased-courses/:userId", getPurchasedCoursesByUser);

export default router;
