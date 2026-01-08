//Routes/Course-routes/Course-routes.js
import express from "express";
import { getCourseDetailWithPaymentCheck,getCoursesForUserView,getCourseContent,getCoursesByCategory} from "../../Controllers/Course-Controller/Course-Controller.js";
import {checkCourseAccessMiddleware} from "../../Middleware/EMI-accessMiddleware.js"
const router = express.Router();

router.get("/courses/user-view", getCoursesForUserView);   // For grid view
router.get("/courses/category/:categoryName", getCoursesByCategory); // For category filtering - must come before /:id
router.get("/courses/:id",checkCourseAccessMiddleware, getCourseDetailWithPaymentCheck); // For detail view with payment check
router.get("/courses/:id/content",checkCourseAccessMiddleware, getCourseContent);      // For actual content access For detail view

export default router;
