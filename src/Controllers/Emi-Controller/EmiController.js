import EMIPlan from "../../Models/Emi-Plan/Emi-Plan-Model.js";
import Payment from "../../Models/Payment-Model/Payment-Model.js";
import Course from "../../Models/Course-Model/Course-model.js";
import User from "../../Models/User-Model/User-Model.js";
import {
  calculateEmiStatus,
  calculatePaymentAllocation,
  updateEmiAfterPayment,
  createEmiPaymentRecord,
} from "../../Services/EMI-Utils.js";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper function to determine payment type for a user and course
export const getPaymentType = async (userId, courseId) => {
  try {
    // Check for full payment first
    const fullPayment = await Payment.findOne({
      userId,
      courseId,
      paymentStatus: "completed",
      paymentType: { $in: ["full", "one-time", null] }, // Include legacy payments
    });

    if (fullPayment) {
      return {
        type: "full",
        hasAccess: true,
        payment: fullPayment,
      };
    }

    // Check for EMI plan
    const emiPlan = await EMIPlan.findOne({
      userId,
      courseId,
    });

    if (emiPlan) {
      const today = new Date();
      const overdueEmis = emiPlan.emis.filter(
        (emi) => emi.status === "pending" && emi.gracePeriodEnd < today
      );

      return {
        type: "emi",
        hasAccess: overdueEmis.length === 0 && emiPlan.status === "active",
        emiPlan,
        overdueCount: overdueEmis.length,
      };
    }

    return {
      type: "none",
      hasAccess: false,
      message: "No payment found for this course",
    };
  } catch (error) {
    
    throw error;
  }
};

// Get EMI status for a specific course
export const getEmiStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // First check if user has made full payment for this course
    const fullPayment = await Payment.findOne({
      userId,
      courseId,
      paymentStatus: "completed",
      paymentType: { $in: ["full", "one-time", null] }, // Include legacy payments without paymentType
    });

    if (fullPayment) {
      // User paid full amount - no EMI plan needed
      return res.status(200).json({
        success: true,
        data: {
          paymentType: "full",
          paymentStatus: "completed",
          paidAmount: fullPayment.amount,
          paymentDate: fullPayment.createdAt,
          transactionId: fullPayment.transactionId,
          hasFullAccess: true,
          message: "Course fully paid - no EMI required",
        },
      });
    }

    // Check for EMI plan
    const emiPlan = await EMIPlan.findOne({
      userId,
      courseId,
    });

    if (!emiPlan) {
      return res.status(404).json({
        success: false,
        message:
          "No payment found for this course. Please purchase the course to access EMI options.",
        paymentType: "none",
      });
    }

    // Handle EMI users
    const emiStatus = calculateEmiStatus(emiPlan);

    res.status(200).json({
      success: true,
      data: {
        paymentType: "emi",
        planStatus: emiPlan.status,

        // Enhanced EMI statistics
        totalEmis: emiStatus.totalEmis,
        paidEmis: emiStatus.paidCount,
        pendingEmis: emiStatus.pendingCount,
        overdueEmis: emiStatus.overdueCount,
        upcomingEmis: emiStatus.upcomingCount,
        gracePeriodEmis: emiStatus.gracePeriodCount,

        // Enhanced amount calculations
        totalAmount: emiStatus.totalAmount,
        totalPaid: emiStatus.totalPaid,
        totalOverdue: emiStatus.totalOverdue,
        totalRemaining: emiStatus.totalRemaining,
        nextDueAmount: emiStatus.nextDueAmount,
        nextDueDate: emiStatus.nextDueDate,

        // Access status
        isAccessLocked:
          emiPlan.status === "locked" || emiStatus.hasOverduePayments,
        hasFullAccess: emiStatus.hasAccessToContent,
        hasOverduePayments: emiStatus.hasOverduePayments,
        isCurrentOnPayments: emiStatus.isCurrentOnPayments,

        // Detailed EMI information
        gracePeriodInfo:
          emiStatus.gracePeriodEmis.length > 0
            ? {
                count: emiStatus.gracePeriodEmis.length,
                totalAmount: emiStatus.gracePeriodEmis.reduce(
                  (sum, emi) => sum + emi.amount,
                  0
                ),
                nextDueDate: emiStatus.gracePeriodEmis[0]?.dueDate,
                gracePeriodEnd: emiStatus.gracePeriodEmis[0]?.gracePeriodEnd,
              }
            : null,

        overdueInfo:
          emiStatus.overdueEmis.length > 0
            ? {
                count: emiStatus.overdueEmis.length,
                totalAmount: emiStatus.totalOverdue,
                oldestDueDate: emiStatus.overdueEmis[0]?.dueDate,
              }
            : null,
      },
    });
  } catch (error) {
 
    res.status(500).json({
      success: false,
      message: "Failed to get EMI status",
      error: error.message,
    });
  }
};

export const payOverdueEmis = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Check payment type first
    const paymentInfo = await getPaymentType(userId, courseId);

    if (paymentInfo.type === "full") {
      return res.status(400).json({
        success: false,
        message: "Course is already fully paid. No EMI payments required.",
        paymentType: "full",
        paymentDetails: {
          amount: paymentInfo.payment.amount,
          paymentDate: paymentInfo.payment.createdAt,
          transactionId: paymentInfo.payment.transactionId,
        },
      });
    }

    if (paymentInfo.type === "none") {
      return res.status(404).json({
        success: false,
        message:
          "No payment or EMI plan found for this course. Please purchase the course first.",
      });
    }

    // Handle EMI users only
    const emiPlan = paymentInfo.emiPlan;
    const emiStatus = calculateEmiStatus(emiPlan);

    // Check if there are any payments due (overdue or in grace period)
    if (
      emiStatus.totalOverdue === 0 &&
      emiStatus.gracePeriodEmis.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No overdue or due EMI payments found for this course.",
        paymentType: "emi",
        emiStatus: "up-to-date",
        nextDueAmount: emiStatus.nextDueAmount,
        nextDueDate: emiStatus.nextDueDate,
      });
    }

    // Calculate payment allocation
    const paymentAllocation = calculatePaymentAllocation(emiPlan, amount);

    if (!paymentAllocation.isValidAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount ₹${amount} is not valid. You can pay ₹${
          paymentAllocation.suggestedAmount
        } to clear ${paymentAllocation.emisToPay.length + 1} EMI(s).`,
        overdueDetails: {
          totalOverdue: emiStatus.totalOverdue,
          gracePeriodAmount: emiStatus.gracePeriodEmis.reduce(
            (sum, emi) => sum + emi.amount,
            0
          ),
          suggestedPayments: [
            paymentAllocation.nextEmiAmount && {
              amount: paymentAllocation.nextEmiAmount,
              description: "Next single EMI payment",
            },
            paymentAllocation.suggestedAmount && {
              amount: paymentAllocation.suggestedAmount,
              description: `Pay ${
                paymentAllocation.emisToPay.length + 1
              } EMI(s)`,
            },
          ].filter(Boolean),
        },
      });
    }

    // Get course EMI configuration for receipt details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Create Razorpay order
    const receiptId = `emi_payment_${Date.now()}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: receiptId,
      notes: {
        userId: userId.toString(),
        courseId: courseId.toString(),
        emiPlanId: emiPlan._id.toString(),
        paymentType: "emi_installment",
        emisCount: paymentAllocation.emisToPay.length,
      },
    });

    // For demo purposes - simulate successful payment
    // In production, this should be handled by webhook after actual payment
    const paymentDetails = {
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: `pay_${Date.now()}`, // This would come from actual payment
      razorpaySignature: `sig_${Date.now()}`, // This would come from actual payment
    };

    // Create payment record with proper EMI tracking
    const payment = await createEmiPaymentRecord(
      {
        userId,
        courseId,
        amount,
        transactionId: receiptId,
        paymentMethod: "CARD", // Would be dynamic in production
        ipAddress:
          req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        platform: "web",
      },
      emiPlan,
      paymentAllocation,
      paymentDetails
    );

    // Update EMI plan with payment details
    const updateResult = await updateEmiAfterPayment(
      emiPlan,
      paymentAllocation,
      paymentDetails
    );

    // Update user course access if plan was unlocked
    if (
      updateResult.newPlanStatus === "active" &&
      emiPlan.status === "locked"
    ) {
      await User.updateOne(
        {
          _id: userId,
          "enrolledCourses.course": courseId,
        },
        {
          $set: {
            "enrolledCourses.$.accessStatus": "active",
          },
        }
      );
    }

    res.status(200).json({
      success: true,
      message: `Successfully paid ${updateResult.updatedEmis} EMI installment(s)`,
      paymentDetails: {
        amount: amount,
        transactionId: receiptId,
        razorpayOrderId: razorpayOrder.id,
        emisPaid: updateResult.updatedEmis,
        planStatus: updateResult.newPlanStatus,
      },
      emiStatus: updateResult.emiStatus,
    });
  } catch (error) {
   
    res.status(500).json({
      success: false,
      message: "Failed to process EMI payment",
      error: error.message,
    });
  }
};

// Get general payment status for any course (works for both EMI and full payment users)
export const getPaymentStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    const paymentInfo = await getPaymentType(userId, courseId);

    res.status(200).json({
      success: true,
      data: paymentInfo,
    });
  } catch (error) {
  
    res.status(500).json({
      success: false,
      message: "Failed to get payment status",
      error: error.message,
    });
  }
};

// Get monthly due amount for existing EMI users
export const getMonthlyDueAmount = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    const paymentInfo = await getPaymentType(userId, courseId);

    if (paymentInfo.type === "full") {
      return res.status(200).json({
        success: true,
        paymentType: "full",
        message: "Course is fully paid. No monthly payments required.",
        data: {
          isDue: false,
          dueAmount: 0,
          currentMonth: null,
        },
      });
    }

    if (paymentInfo.type === "none") {
      return res.status(404).json({
        success: false,
        message: "No EMI plan found. Please purchase the course first.",
      });
    }

    const emiPlan = paymentInfo.emiPlan;
    const emiStatus = calculateEmiStatus(emiPlan);
    const today = new Date();

    // Find current month's EMI
    const currentMonthEmi = emiPlan.emis.find((emi) => {
      const emiDate = new Date(emi.dueDate);
      return (
        emi.status === "pending" &&
        emiDate.getMonth() === today.getMonth() &&
        emiDate.getFullYear() === today.getFullYear()
      );
    });

    // Find next unpaid EMI if current month is not available
    const nextDueEmi = emiPlan.emis
      .filter((emi) => emi.status === "pending")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

    const targetEmi = currentMonthEmi || nextDueEmi;

    if (!targetEmi) {
      return res.status(200).json({
        success: true,
        paymentType: "emi",
        message: "All EMI payments are completed.",
        data: {
          isDue: false,
          dueAmount: 0,
          currentMonth: null,
          allPaid: true,
        },
      });
    }

    const isOverdue = targetEmi.gracePeriodEnd < today;
    const isInGracePeriod =
      targetEmi.dueDate <= today && targetEmi.gracePeriodEnd >= today;

    res.status(200).json({
      success: true,
      paymentType: "emi",
      data: {
        isDue: true,
        dueAmount: targetEmi.amount,
        currentMonth: targetEmi.monthName,
        dueDate: targetEmi.dueDate,
        gracePeriodEnd: targetEmi.gracePeriodEnd,
        isOverdue,
        isInGracePeriod,
        emiStatus: isOverdue
          ? "overdue"
          : isInGracePeriod
          ? "grace"
          : "upcoming",
        daysOverdue: isOverdue
          ? Math.ceil(
              (today - targetEmi.gracePeriodEnd) / (1000 * 60 * 60 * 24)
            )
          : 0,
        totalOverdueAmount: emiStatus.totalOverdue,
        hasOtherOverdue: emiStatus.overdueCount > (isOverdue ? 1 : 0),
        paymentOptions: {
          singleEmi: {
            amount: targetEmi.amount,
            description: `Pay ${targetEmi.monthName} EMI`,
          },
          allOverdue:
            emiStatus.totalOverdue > 0
              ? {
                  amount: emiStatus.totalOverdue,
                  description: `Pay all ${emiStatus.overdueCount} overdue EMI(s)`,
                }
              : null,
        },
      },
    });
  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Failed to get monthly due amount",
      error: error.message,
    });
  }
};

// Process monthly EMI payment for existing users
export const payMonthlyEmi = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId, amount, paymentType = "monthly" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required",
      });
    }

    const paymentInfo = await getPaymentType(userId, courseId);

    if (paymentInfo.type === "full") {
      return res.status(400).json({
        success: false,
        message: "Course is already fully paid. No EMI payments required.",
      });
    }

    if (paymentInfo.type === "none") {
      return res.status(404).json({
        success: false,
        message: "No EMI plan found for this course.",
      });
    }

    const emiPlan = paymentInfo.emiPlan;
    const emiStatus = calculateEmiStatus(emiPlan);

    // Validate payment amount
    const paymentAllocation = calculatePaymentAllocation(emiPlan, amount);
    if (!paymentAllocation.isValidAmount) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment amount ₹${amount}. Suggested amounts:`,
        suggestions: [
          {
            amount: emiStatus.nextDueAmount,
            description: "Next single EMI payment",
          },
          emiStatus.totalOverdue > 0 && {
            amount: emiStatus.totalOverdue,
            description: "All overdue EMI payments",
          },
        ].filter(Boolean),
      });
    }

    // Create Razorpay order for monthly EMI payment
    const receiptId = `monthly_emi_${Date.now()}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: receiptId,
      notes: {
        userId: userId.toString(),
        courseId: courseId.toString(),
        emiPlanId: emiPlan._id.toString(),
        paymentType: "monthly_emi",
        emisCount: paymentAllocation.emisToPay.length,
      },
    });

    res.status(200).json({
      success: true,
      message: "Razorpay order created for monthly EMI payment",
      data: {
        orderId: razorpayOrder.id,
        amount: amount,
        currency: "INR",
        paymentAllocation: {
          emisToPay: paymentAllocation.emisToPay.length,
          totalAmount: amount,
          willUnlockAccess:
            paymentAllocation.emisToPay.some((emi) => emi.isOverdue) &&
            emiPlan.status === "locked",
        },
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
 
    res.status(500).json({
      success: false,
      message: "Failed to process monthly EMI payment",
      error: error.message,
    });
  }
};

// Verify EMI payment after Razorpay success
export const verifyEmiPayment = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      courseId,
      amount,
    } = req.body;

    

    // Validate required fields
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !courseId ||
      !amount
    ) {
      return res.status(400).json({
        success: false,
        message: "All payment verification fields are required",
      });
    }

    // Verify Razorpay signature
    const crypto = await import("crypto");
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
    
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }


    // Find the EMI plan
    const emiPlan = await EMIPlan.findOne({ userId, courseId });
    if (!emiPlan) {
      return res.status(404).json({
        success: false,
        message: "EMI plan not found",
      });
    }

    // Calculate which EMIs to mark as paid
    const paymentAllocation = calculatePaymentAllocation(emiPlan, amount);
    if (!paymentAllocation.isValidAmount) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    // Validate payment allocation has EMIs to pay
    if (
      !paymentAllocation.emisToPay ||
      paymentAllocation.emisToPay.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No EMIs found to process with this payment amount",
      });
    }

   

    // Update EMI plan - mark EMIs as paid
    const currentDate = new Date();
    let accessShouldBeUnlocked = false;

    paymentAllocation.emisToPay.forEach((emi) => {
      // Validate EMI object has required properties
      if (!emi.emiId) {
       
        throw new Error("Invalid EMI data: missing emiId");
      }

      const emiIndex = emiPlan.emis.findIndex(
        (e) => e._id.toString() === emi.emiId.toString()
      );
      if (emiIndex !== -1) {
        emiPlan.emis[emiIndex].status = "paid";
        emiPlan.emis[emiIndex].paymentDate = currentDate;

        // If this was an overdue EMI, it might unlock access
        if (emi.isOverdue) {
          accessShouldBeUnlocked = true;
        }

      } else {
      
        throw new Error(`EMI not found in plan: ${emi.emiId}`);
      }
    });

    // Recalculate EMI status after payment
    const updatedStatus = calculateEmiStatus(emiPlan);
   

    // Update plan status based on new EMI status
    // If user is current on payments (no overdue EMIs), unlock the plan
    if (updatedStatus.isCurrentOnPayments && emiPlan.status === "locked") {
      emiPlan.status = "active";
      accessShouldBeUnlocked = true;
   
    }

    // Save EMI plan changes
    await emiPlan.save();

    // Recalculate final status after plan update
    const finalStatus = calculateEmiStatus(emiPlan);
   

    // Update user's course access status if needed
    if (accessShouldBeUnlocked) {
     
      await User.findOneAndUpdate(
        { _id: userId, "enrolledCourses.course": courseId },
        { $set: { "enrolledCourses.$.accessStatus": "active" } }
      );
    }

 

    res.status(200).json({
      success: true,
      message: "EMI payment verified and processed successfully",
      data: {
        paidEmis: paymentAllocation.emisToPay.length,
        accessUnlocked: accessShouldBeUnlocked,
        emiStatus: finalStatus,
        planStatus: emiPlan.status,
      },
    });
  } catch (error) {
   
    res.status(500).json({
      success: false,
      message: "Failed to verify EMI payment",
      error: error.message,
    });
  }
};

// Get comprehensive EMI summary for user dashboard
export const getUserEmiSummary = async (req, res) => {
  try {
    const userId = req.userId;

    // Get all EMI plans for this user
    const emiPlans = await EMIPlan.find({ userId }).populate(
      "courseId",
      "coursename price"
    );

    if (emiPlans.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No EMI plans found for this user",
        data: {
          totalActivePlans: 0,
          totalOverdueAmount: 0,
          totalMonthlyDue: 0,
          upcomingPayments: [],
          overduePayments: [],
          activePlans: [],
        },
      });
    }

    let totalOverdueAmount = 0;
    let totalMonthlyDue = 0;
    let upcomingPayments = [];
    let overduePayments = [];
    const activePlans = [];

    const today = new Date();

    for (const emiPlan of emiPlans) {
      const emiStatus = calculateEmiStatus(emiPlan);

      // Add to active plans summary
      activePlans.push({
        planId: emiPlan._id,
        courseId: emiPlan.courseId,
        courseName: emiPlan.coursename,
        planStatus: emiPlan.status,
        totalAmount: emiPlan.totalAmount,
        totalPaid: emiStatus.totalPaid,
        totalRemaining: emiStatus.totalRemaining,
        overdueCount: emiStatus.overdueCount,
        overdueAmount: emiStatus.totalOverdue,
        nextDueAmount: emiStatus.nextDueAmount,
        nextDueDate: emiStatus.nextDueDate,
        hasAccess: emiStatus.hasAccessToContent,
      });

      // Add to totals
      totalOverdueAmount += emiStatus.totalOverdue;

      // Find current month's due EMI
      const currentMonthEmi = emiPlan.emis.find((emi) => {
        const emiDate = new Date(emi.dueDate);
        return (
          emi.status === "pending" &&
          emiDate.getMonth() === today.getMonth() &&
          emiDate.getFullYear() === today.getFullYear()
        );
      });

      if (currentMonthEmi && !emiStatus.hasOverduePayments) {
        totalMonthlyDue += currentMonthEmi.amount;
      }

      // Collect overdue payments
      const overdueEmis = emiPlan.emis.filter(
        (emi) => emi.status === "pending" && emi.gracePeriodEnd < today
      );

      overdueEmis.forEach((emi) => {
        overduePayments.push({
          planId: emiPlan._id,
          courseId: emiPlan.courseId,
          courseName: emiPlan.coursename,
          month: emi.month,
          monthName: emi.monthName,
          amount: emi.amount,
          dueDate: emi.dueDate,
          daysOverdue: Math.ceil(
            (today - emi.gracePeriodEnd) / (1000 * 60 * 60 * 24)
          ),
        });
      });

      // Collect upcoming payments (all remaining months)
      const upcomingEmis = emiPlan.emis
        .filter((emi) => emi.status === "pending" && emi.dueDate > today)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

      upcomingEmis.forEach((emi) => {
        upcomingPayments.push({
          planId: emiPlan._id,
          courseId: emiPlan.courseId,
          courseName: emiPlan.coursename,
          month: emi.month,
          monthName: emi.monthName,
          amount: emi.amount,
          dueDate: emi.dueDate,
          daysUntilDue: Math.ceil(
            (emi.dueDate - today) / (1000 * 60 * 60 * 24)
          ),
        });
      });
    }

    // Sort payments by date
    overduePayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    upcomingPayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    res.status(200).json({
      success: true,
      data: {
        totalActivePlans: emiPlans.length,
        totalOverdueAmount,
        totalMonthlyDue,
        hasOverduePayments: overduePayments.length > 0,
        hasUpcomingPayments: upcomingPayments.length > 0,
        upcomingPayments: upcomingPayments, // Show all upcoming payments
        overduePayments,
        activePlans,
        quickActions: {
          payAllOverdue:
            totalOverdueAmount > 0
              ? {
                  amount: totalOverdueAmount,
                  count: overduePayments.length,
                  description: `Pay all ${overduePayments.length} overdue EMI(s)`,
                }
              : null,
          payCurrentMonth:
            totalMonthlyDue > 0
              ? {
                  amount: totalMonthlyDue,
                  description: "Pay current month's EMI",
                }
              : null,
        },
      },
    });
  } catch (error) {
 
    res.status(500).json({
      success: false,
      message: "Failed to get user EMI summary",
      error: error.message,
    });
  }
};

// Get due amounts and payment options for EMI users
export const getEmiDueAmounts = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Check payment type first
    const paymentInfo = await getPaymentType(userId, courseId);

    if (paymentInfo.type === "full") {
      return res.status(200).json({
        success: true,
        paymentType: "full",
        message: "Course is fully paid. No EMI payments required.",
        data: {
          hasPayments: false,
          totalDue: 0,
          paymentOptions: [],
        },
      });
    }

    if (paymentInfo.type === "none") {
      return res.status(404).json({
        success: false,
        message: "No payment or EMI plan found for this course.",
      });
    }

    // Handle EMI users
    const emiPlan = paymentInfo.emiPlan;
    const emiStatus = calculateEmiStatus(emiPlan);

    // Calculate different payment options
    const paymentOptions = [];

    // Option 1: Pay next single EMI (overdue or current)
    if (emiStatus.nextDueAmount > 0) {
      const nextEmiAllocation = calculatePaymentAllocation(
        emiPlan,
        emiStatus.nextDueAmount
      );
      paymentOptions.push({
        type: "single_emi",
        amount: emiStatus.nextDueAmount,
        description: "Pay next single EMI",
        emisCount: nextEmiAllocation.emisToPay.length,
        willUnlock:
          nextEmiAllocation.emisToPay.some((emi) => emi.isOverdue) &&
          emiPlan.status === "locked",
      });
    }

    // Option 2: Pay all overdue EMIs
    if (emiStatus.totalOverdue > 0) {
      const overdueAllocation = calculatePaymentAllocation(
        emiPlan,
        emiStatus.totalOverdue
      );
      paymentOptions.push({
        type: "all_overdue",
        amount: emiStatus.totalOverdue,
        description: `Pay all ${emiStatus.overdueCount} overdue EMI(s)`,
        emisCount: overdueAllocation.emisToPay.length,
        willUnlock: emiPlan.status === "locked",
      });
    }

    // Option 3: Pay multiple EMIs (2-3 months ahead)
    const upcomingPaymentAmounts = [2, 3, 6]
      .map((months) => {
        const emis = [
          ...emiStatus.overdueEmis,
          ...emiStatus.gracePeriodEmis,
          ...emiStatus.upcomingEmis,
        ]
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
          .slice(0, months);
        return {
          months,
          amount: emis.reduce((sum, emi) => sum + emi.amount, 0),
          count: emis.length,
        };
      })
      .filter(
        (option) =>
          option.count > 1 &&
          option.count <= emiStatus.totalEmis - emiStatus.paidCount
      );

    upcomingPaymentAmounts.forEach((option) => {
      const allocation = calculatePaymentAllocation(emiPlan, option.amount);
      if (allocation.isValidAmount) {
        paymentOptions.push({
          type: "multiple_emis",
          amount: option.amount,
          description: `Pay ${option.count} EMI(s) in advance`,
          emisCount: allocation.emisToPay.length,
          willUnlock:
            allocation.emisToPay.some((emi) => emi.isOverdue) &&
            emiPlan.status === "locked",
        });
      }
    });

    // Option 4: Pay remaining balance
    if (emiStatus.totalRemaining > 0) {
      paymentOptions.push({
        type: "full_remaining",
        amount: emiStatus.totalRemaining,
        description: `Pay full remaining balance (${
          emiStatus.pendingCount + emiStatus.lateCount
        } EMI(s))`,
        emisCount: emiStatus.pendingCount + emiStatus.lateCount,
        willUnlock: true,
        willComplete: true,
      });
    }

    res.status(200).json({
      success: true,
      paymentType: "emi",
      data: {
        hasPayments: emiStatus.totalRemaining > 0,
        emiStatus: {
          totalPaid: emiStatus.totalPaid,
          totalRemaining: emiStatus.totalRemaining,
          totalOverdue: emiStatus.totalOverdue,
          nextDueAmount: emiStatus.nextDueAmount,
          nextDueDate: emiStatus.nextDueDate,
          hasOverduePayments: emiStatus.hasOverduePayments,
          hasAccessToContent: emiStatus.hasAccessToContent,
          planStatus: emiPlan.status,
        },
        paymentOptions: paymentOptions.slice(0, 5), // Limit to 5 options
        recommendations: {
          urgent: emiStatus.hasOverduePayments
            ? paymentOptions.find((opt) => opt.type === "all_overdue")
            : null,
          suggested:
            paymentOptions.find((opt) => opt.type === "single_emi") ||
            paymentOptions.find((opt) => opt.type === "multiple_emis"),
          economical: paymentOptions.find(
            (opt) => opt.type === "full_remaining"
          ),
        },
      },
    });
  } catch (error) {
  
    res.status(500).json({
      success: false,
      message: "Failed to get EMI due amounts",
      error: error.message,
    });
  }
};
