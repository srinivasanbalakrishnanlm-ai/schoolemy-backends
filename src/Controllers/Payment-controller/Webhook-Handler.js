
import crypto from "crypto";
import dotenv from "dotenv";
import Payment from "../../Models/Payment-Model/Payment-Model.js";
import User from "../../Models/User-Model/User-Model.js";
import Course from "../../Models/Course-Model/Course-model.js";
import { createEmiPlan } from "../Payment-controller/Payment-Controller.js";
import { withTransaction } from "../../Utils/TransactionHelper.js";
dotenv.config();

// Webhook signature verification
const verifyWebhookSignature = (body, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(signature, "hex")
  );
};

// Main webhook handler
export const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Missing webhook signature",
      });
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const { event, payload } = req.body;
    let result;

    switch (event) {
      case "payment.captured":
        result = await handlePaymentCaptured(payload.payment.entity);
        break;

      case "payment.failed":
        result = await handlePaymentFailed(payload.payment.entity);
        break;

      case "order.paid":
        result = await handleOrderPaid(payload.order.entity);
        break;

      default:
        return res.status(200).json({
          success: true,
          message: `Webhook event ${event} received but not processed`,
          event: event
        });
    }

     return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
      event: event,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// Handle successful payment capture
const handlePaymentCaptured = async (paymentData) => {
  try {
    const {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      amount,
      method,
    } = paymentData;

    // Execute all operations within a transaction
    const result = await withTransaction(async (session) => {
      // Find and update payment record
      const payment = await Payment.findOne({
        razorpayOrderId,
        paymentStatus: "pending",
      }).session(session);

      if (!payment) {
        throw new Error("Payment record not found");
      }

      // Update payment status
      payment.paymentStatus = "completed";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.paymentMethod = method.toUpperCase();
      await payment.save({ session });

      // Handle course enrollment based on payment type
      let enrollmentResult;
      if (payment.paymentType === "emi") {
        enrollmentResult = await handleEmiEnrollment(payment, session);
      } else {
        enrollmentResult = await handleFullPaymentEnrollment(payment, session);
      }

      return {
        payment,
        enrollmentResult,
      };
    });

    return {
      success: true,
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      paymentType: result.payment.paymentType,
      enrollment: result.enrollmentResult,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to handle payment capture",
      error: error.message,
    };
  }
};

// Handle EMI enrollment after payment
const handleEmiEnrollment = async (payment, session = null) => {
  try {
    const [user, course] = await Promise.all([
      User.findById(payment.userId).session(session || null),
      Course.findById(payment.courseId).session(session || null),
    ]);

    if (!user) {
      throw new Error("User not found");
    }

    if (!course) {
      throw new Error("Course not found");
    }

    // Create EMI plan with session
    const emiPlan = await createEmiPlan(
      payment.userId,
      payment.courseId,
      course,
      user,
      payment.emiDueDay,
      {
        monthlyAmount: payment.amount,
        totalAmount: course.price.finalPrice,
        //months: Math.ceil(course.price.finalPrice / payment.amount),
        months: course.emi.emiDurationMonths,
      },
      session // Pass session to createEmiPlan
    );

    return {
      success: true,
      emiPlanId: emiPlan._id,
      userId: payment.userId,
      courseId: payment.courseId,
    };
  } catch (error) {
    throw error; // Re-throw to trigger transaction rollback
  }
};

// Handle full payment enrollment
const handleFullPaymentEnrollment = async (payment, session = null) => {
  try {
    const updateOptions = session ? { session } : {};

    // Update user's enrolled courses
    await User.findByIdAndUpdate(
      payment.userId,
      {
        $addToSet: {
          enrolledCourses: {
            course: payment.courseId,
            coursename: payment.courseName,
            accessStatus: "active",
          },
        },
      },
      updateOptions
    );

    // Update course enrollment count
    await Course.findByIdAndUpdate(
      payment.courseId,
      { $inc: { studentEnrollmentCount: 1 } },
      updateOptions
    );

    console.log(
      `Full payment enrollment completed for payment: ${payment._id}`
    );
  } catch (error) {
    throw error; // Re-throw to trigger transaction rollback
  }
};

// Handle failed payments
const handlePaymentFailed = async (paymentData) => {
  try {
    const {
      order_id: razorpayOrderId,
      error_code,
      error_description,
    } = paymentData;

    // Use transaction for consistency
    const result = await withTransaction(async (session) => {
      const updatedPayment = await Payment.findOneAndUpdate(
        { razorpayOrderId },
        {
          paymentStatus: "failed",
          errorCode: error_code,
          errorDescription: error_description,
        },
        { new: true, session }
      );

      if (!updatedPayment) {
        throw new Error("Payment record not found");
      }

      return updatedPayment;
    });

    return {
      success: true,
      orderId: razorpayOrderId,
      errorCode: error_code,
      errorDescription: error_description,
      paymentId: result._id,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to handle payment failure",
      error: error.message,
    };
  }
};

// Handle order paid event
const handleOrderPaid = async (orderData) => {

  try {
    const { id: razorpayOrderId, amount_paid } = orderData;

    // Additional verification can be done here
    const payment = await Payment.findOne({ razorpayOrderId });
    
    if (payment) {
      return {
        success: true,
        orderId: razorpayOrderId,
        amountPaid: amount_paid,
        paymentId: payment._id,
        paymentStatus: payment.paymentStatus
      };
    } else {
      return {
        success: true,
        orderId: razorpayOrderId,
        amountPaid: amount_paid,
        message: "Order paid but no payment record found"
      };
    }

  } catch (error) {
    return {
      success: false,
      message: "Failed to handle order paid event",
      error: error.message
    };
  }
};

export default {
  handleRazorpayWebhook,
};
