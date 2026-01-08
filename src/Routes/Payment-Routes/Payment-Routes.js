//Routes/Payment-Routes/Payment-Routes.js
import express from "express";
import {
  createPayment,
  verifyPayment,
  getEmiDetailsForCourse,
  getUserPayments,
  getUserPaymentById,
} from "../../Controllers/Payment-controller/Payment-Controller.js";
import {
  payOverdueEmis,
  getEmiStatus,
  getPaymentStatus,
  getEmiDueAmounts,
  getMonthlyDueAmount,
  payMonthlyEmi,
  verifyEmiPayment,
  getUserEmiSummary,
} from "../../Controllers/Emi-Controller/EmiController.js";
import { handleRazorpayWebhook } from "../../Controllers/Payment-controller/Webhook-Handler.js";

const router = express.Router();

// Webhook Route (No auth required - must be before middleware)
router.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  handleRazorpayWebhook
);

// User Payment Dashboard
router.post("/user/payment/create", createPayment);
router.post("/user/payment/verify", verifyPayment);
router.get("/user/payment/emi-details/:courseId", getEmiDetailsForCourse);

// EMI Management Routes
router.post("/user/emi/pay-overdue", payOverdueEmis);
router.post("/user/emi/pay-monthly", payMonthlyEmi); // New: Monthly EMI payment for existing users
router.post("/user/emi/verify-payment", verifyEmiPayment); // New: Verify EMI payment after Razorpay success
router.get("/user/emi/status/:courseId", getEmiStatus);
router.get("/user/emi/due-amounts/:courseId", getEmiDueAmounts); // Get due amounts and payment options
router.get("/user/emi/monthly-due/:courseId", getMonthlyDueAmount); // New: Get monthly due amount
router.get("/user/emi/summary", getUserEmiSummary); // New: Get comprehensive EMI summary
router.get("/user/payment/status/:courseId", getPaymentStatus); // Works for both EMI and full payment users

router.get("/user/payment", getUserPayments);
router.get("/user/payment/:id", getUserPaymentById);

export default router;
