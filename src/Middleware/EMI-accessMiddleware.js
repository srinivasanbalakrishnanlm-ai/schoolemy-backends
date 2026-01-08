import User from "../Models/User-Model/User-Model.js";
import Payment from "../Models/Payment-Model/Payment-Model.js";
import { calculateEmiStatus } from "../Services/EMI-Utils.js";
import mongoose from "mongoose";

export const checkCourseAccessMiddleware = async (req, res, next) => {
  const userId = req.userId;
  const courseId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid course ID format",
    });
  }

  try {
    // Full payment check
    const fullPayment = await Payment.findOne({
      userId,
      courseId,
      paymentStatus: "completed",
      paymentType: { $ne: "emi" },
    });

    if (fullPayment) {
      req.courseAccess = {
        hasAccess: true,
        reason: "full_payment",
        accessType: "full",
        paymentType: "full",
        paymentDetails: {
          amount: fullPayment.amount,
          paymentDate: fullPayment.createdAt,
          transactionId: fullPayment.transactionId,
        },
      };
      return next(); //  Grant access
    }

    // EMI access check
    const user = await User.findOne(
      {
        _id: userId,
        "enrolledCourses.course": courseId,
      },
      { "enrolledCourses.$": 1 }
    ).populate("enrolledCourses.emiPlan");

    if (user && user.enrolledCourses[0]?.emiPlan) {
      const emiPlan = user.enrolledCourses[0].emiPlan;
      const emiStatus = calculateEmiStatus(emiPlan);


      if (emiStatus.hasAccessToContent) {
        
        req.courseAccess = {
          hasAccess: true,
          reason: "emi_active",
          accessType: "full",
          paymentType: "emi",
          emiStatus: emiStatus,
          emiPlan: emiPlan,
        };
        return next(); //  Grant access
      } else {
        req.courseAccess = {
          hasAccess: false,
          reason: emiStatus.hasOverduePayments ? "emi_overdue" : "emi_locked",
          accessType: "limited",
          paymentType: "emi",
          overdueCount: emiStatus.overdueCount,
          totalOverdue: emiStatus.totalOverdue,
          nextDueAmount: emiStatus.nextDueAmount,
          nextDueDate: emiStatus.nextDueDate,
          emiStatus: emiStatus,
          emiPlan: emiPlan,
        };
        return next(); //  controller handle the response
      }
    }

    // Set access info for the controller to handle
    req.courseAccess = {
      hasAccess: false,
      reason: "payment_required",
      accessType: "limited",
      paymentType: "none",
    };
    return next(); // Let controller handle the response
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const checkPaymentStatus = async (userId, courseId) => {
  const { access } = await checkCourseAccessMiddleware(userId, courseId);
  return access;
};
