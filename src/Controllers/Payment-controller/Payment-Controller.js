import Payment from "../../Models/Payment-Model/Payment-Model.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../../Models/User-Model/User-Model.js";
import CourseNewModel from "../../Models/Course-Model/Course-model.js";
import EMIPlan from "../../Models/Emi-Plan/Emi-Plan-Model.js";
import {
  getEmiDetails,
  validateCourseForEmi,
} from "../../Services/EMI-Utils.js";
import {
  getNextDueDate,
  getMonthNameFromDate,
} from "../../Services/EMI-DateUtils.js";
import { sendNotification } from "../../Notification/EMI-Notification.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { withTransaction } from "../../Utils/TransactionHelper.js";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const validatePaymentData = (data) => {
  const errors = [];
  if (!data.userId) errors.push("User ID is required");
  if (!data.courseId) errors.push("Course ID is required");
  if (!data.amount || isNaN(data.amount))
    errors.push("Valid amount is required");
  return errors;
};

export const createPayment = async (req, res) => {
  try {
    const userId = req.userId;

    const { courseId, amount, paymentMethod, paymentType, emiDueDay } =
      req.body;

    // Validate input data
    const validationErrors = validatePaymentData({ userId, courseId, amount });

    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, errors: validationErrors });
    }

    if (paymentType === "emi") {
      if (
        !emiDueDay ||
        !Number.isInteger(emiDueDay) ||
        emiDueDay < 1 ||
        emiDueDay > 31
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid EMI due day (1-31)" });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid course ID format" });
    }

    // Check if user is already enrolled
    const isEnrolled = await User.exists({
      _id: userId,
      "enrolledCourses.course": courseId,
    });

    if (isEnrolled) {
      return res.status(400).json({
        success: false,
        message: "User already enrolled in this course",
      });
    }

    //  APPROACH 3: Smart Hybrid - Check for existing pending payments
    const existingPendingPayment = await Payment.findOne({
      userId,
      courseId,
      paymentStatus: "pending",
    }).sort({ createdAt: -1 });

    if (existingPendingPayment) {
      const timeDiff =
        Date.now() - new Date(existingPendingPayment.createdAt).getTime();
      const minutesSinceCreated = timeDiff / (1000 * 60);
      const hoursSinceCreated = timeDiff / (1000 * 60 * 60);
      const daysSinceCreated = timeDiff / (1000 * 60 * 60 * 24);

      //  RULE 1: Within 1 hour - Always reuse (user is actively trying)
      if (hoursSinceCreated < 1) {
        return await reuseExistingPayment(
          existingPendingPayment,
          courseId,
          paymentType,
          emiDueDay,
          res
        );
      }
      //  RULE 2: 1-24 hours - Reuse but warn user
      else if (hoursSinceCreated < 24) {
        return await reuseExistingPayment(
          existingPendingPayment,
          courseId,
          paymentType,
          emiDueDay,
          res,
          {
            warningMessage:
              "You have a pending payment from earlier. Resuming your previous session...",
          }
        );
      }
      // RULE 3: 1-7 days - Expire old, create new
      else if (daysSinceCreated < 7) {
        await Payment.findByIdAndUpdate(existingPendingPayment._id, {
          paymentStatus: "expired",
        });

        // Continue to create new payment below...
      }
      //  RULE 4: >7 days - Cancel old, create new
      else {
        await Payment.findByIdAndUpdate(existingPendingPayment._id, {
          paymentStatus: "cancelled",
        });

        // Continue to create new payment below...
      }
    }

    //  Continue with creating new payment
    const [user, course] = await Promise.all([
      User.findById(userId)
        .select("username email mobile studentRegisterNumber")
        .lean(),
      CourseNewModel.findById(courseId)
        .select("coursename price courseduration thumbnail CourseMotherId emi")
        .lean(),
    ]);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    let expectedAmount, emiDetails;

    if (paymentType === "emi") {
      try {
        emiDetails = validateCourseForEmi(course);

        expectedAmount = emiDetails.monthlyAmount;

        if (amount !== expectedAmount) {
          return res.status(400).json({
            success: false,
            message: `First EMI amount must be ₹${expectedAmount}`,
          });
        }
      } catch (emiError) {
        return res.status(400).json({
          success: false,
          message: emiError.message || "EMI not available for this course",
          errorCode: "EMI_NOT_AVAILABLE",
        });
      }
    } else {
      expectedAmount = course.price.finalPrice;

      if (amount !== expectedAmount) {
        return res.status(400).json({
          success: false,
          message: "Amount doesn't match course price",
        });
      }
    }

    // Generate a unique receipt ID
    const receiptId = `receipt_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}`;

 
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(expectedAmount * 100),
      currency: "INR",
      receipt: receiptId,
      notes: {
        userId: userId.toString(),
        courseId: courseId.toString(),
        courseName: course.coursename,
        studentRegisterNumber: user.studentRegisterNumber || "N/A",
        email: user.email || "N/A",
        mobile: user.mobile || "N/A",
      },
    });

    // Create payment record
    const payment = new Payment({
      userId,
      courseId,
      CourseMotherId: course.CourseMotherId,
      studentRegisterNumber: user.studentRegisterNumber || "N/A",
      username: user.username,
      email: user.email || "N/A",
      mobile: user.mobile || "N/A",
      courseName: course.coursename,
      amount: expectedAmount,
      currency: "INR",
      transactionId: receiptId, // This should be unique
      paymentMethod,
      razorpayOrderId: razorpayOrder.id,
      ipAddress:
        req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      paymentStatus: "pending",
      paymentGateway: "razorpay",
      paymentType,
      emiDueDay: paymentType === "emi" ? emiDueDay : undefined,
      refundPolicyAcknowledged: true,
    });

    await payment.save();

    // Prepare response
    const response = {
      success: true,
      message: "Payment order created successfully",
      order: razorpayOrder,
      paymentId: payment._id,
      courseDetails: {
        name: course.coursename,
        duration: course.courseduration,
        totalAmount: course.price.finalPrice,
        thumbnail:
          course.thumbnail || "https://yourwebsite.com/default-thumbnail.jpg",
        noRefundPolicy: "As per our policy, this course is non-refunded.",
      },
    };

    if (paymentType === "emi") {
      response.emiDetails = {
        monthlyAmount: emiDetails.monthlyAmount,
        totalEmis: emiDetails.months,
        nextDueDate: getNextDueDate(new Date(), emiDueDay, 1),
      };
    }

    return res.status(201).json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error.message,
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      paymentId,
      refundRequested,
      actualPaymentMethod, //  NEW: Receive actual payment method from frontend
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !paymentId
    ) {
      return res.status(400).json({
        success: false,
        message: "All verification fields are required",
      });
    }

    if (refundRequested) {
      return res.status(400).json({
        success: false,
        message: "Refunds not permitted as per policy",
      });
    }

    // Verify Razorpay signature for production payment
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Determine if this is a test payment
    const isTestPayment =
      razorpay_payment_id.startsWith("pay_test_") ||
      razorpay_order_id.startsWith("order_test_") ||
      process.env.NODE_ENV === "development";

    // Validate paymentId format early to avoid DB errors
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid paymentId format",
      });
    }

    // Verify payment status with Razorpay (handle network/SDK errors gracefully)
    let paymentVerification;
    try {
      paymentVerification = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (razorErr) {
      console.error("Razorpay fetch error:", razorErr);
      return res.status(502).json({
        success: false,
        message: "Failed to verify payment with Razorpay",
        error: razorErr.message,
      });
    }

    if (paymentVerification.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: "Payment not captured",
        paymentStatus: paymentVerification.status,
      });
    }

    //  Extract actual payment method from Razorpay response
    const razorpayMethod = paymentVerification.method; // card, upi, netbanking, wallet
    const cardDetails = paymentVerification.card || null;
    const upiDetails = paymentVerification.vpa
      ? { upiId: paymentVerification.vpa }
      : null;
    const bankDetails = paymentVerification.bank || null;
    const walletProvider = paymentVerification.wallet || null;

    //  Map Razorpay method to your enum
    const paymentMethodMap = {
      card: "CARD",
      upi: "UPI",
      netbanking: "NETBANKING",
      wallet: "WALLET",
      emi: "EMI",
      cardless_emi: "PAYLATER",
      paylater: "PAYLATER",
    };

    const finalPaymentMethod =
      paymentMethodMap[razorpayMethod] || actualPaymentMethod || "CARD";


    // Execute all database operations within a transaction
    const result = await withTransaction(async (session) => {
      //  Update payment with actual method and details
      const updatedPayment = await Payment.findByIdAndUpdate(
        paymentId,
        {
          paymentStatus: "completed",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paymentMethod: finalPaymentMethod, //  Update with actual method
          //  Store additional payment details
          ...(cardDetails && {
            cardDetails: {
              cardBrand: cardDetails.network || cardDetails.type,
              last4: cardDetails.last4,
              bank: cardDetails.issuer,
            },
          }),
          ...(upiDetails && { upiDetails }),
          ...(bankDetails && {
            bankDetails: {
              bankName: bankDetails,
            },
          }),
          ...(walletProvider && { walletProvider }),
        },
        { new: true, session }
      );

      if (!updatedPayment) {
        console.error("Payment record not found for id:", paymentId);
        throw new Error("Payment record not found");
      }

      // Fetch course and user within transaction
      const course = await CourseNewModel.findById(updatedPayment.courseId)
        .select("coursename price courseduration thumbnail CourseMotherId emi")
        .session(session);

      const user = await User.findById(updatedPayment.userId)
        .select("username email mobile studentRegisterNumber")
        .session(session);

      if (!course || !user) {
        throw new Error("Course/User not found");
      }

      let emiPlan = null;
      let emiDetails = null;

      if (updatedPayment.paymentType === "emi") {
        emiDetails = getEmiDetails(course);
        emiPlan = await createEmiPlan(
          updatedPayment.userId,
          updatedPayment.courseId,
          course,
          user,
          updatedPayment.emiDueDay,
          emiDetails,
          session // Pass session to createEmiPlan
        );
      } else {
        // Full payment enrollment
        await User.findByIdAndUpdate(
          updatedPayment.userId,
          {
            $addToSet: {
              enrolledCourses: {
                course: updatedPayment.courseId,
                coursename: course.coursename,
                accessStatus: "active",
              },
            },
          },
          { new: true, session }
        );
      }

      // Update course enrollment count
      await CourseNewModel.findByIdAndUpdate(
        updatedPayment.courseId,
        { $inc: { studentEnrollmentCount: 1 } },
        { session }
      );

      return {
        updatedPayment,
        course,
        user,
        emiPlan,
        emiDetails,
      };
    });

    // Send notifications outside transaction (non-critical operations)
    if (result.updatedPayment.paymentType === "emi") {
      await sendNotification(result.updatedPayment.userId, "welcome", {
        courseName: result.course.coursename,
        courseDuration: result.course.courseduration,
        amountPaid: result.updatedPayment.amount,
        totalAmount: result.course.price.finalPrice,
        isEmi: true,
        emiTotalMonths: result.emiDetails.months,
        emiMonthlyAmount: result.emiDetails.monthlyAmount,
        nextDueDate: getNextDueDate(
          new Date(),
          result.updatedPayment.emiDueDay,
          1
        ).toDateString(),
        courseUrl: `https://yourwebsite.com/courses/${result.course._id}`,
        courseThumbnail:
          result.course.thumbnail ||
          "https://yourwebsite.com/default-thumbnail.jpg",
        noRefundPolicy: "As per our policy, this course is non-refunded.",
      });
    } else {
      await sendNotification(result.updatedPayment.userId, "welcome", {
        courseName: result.course.coursename,
        courseDuration: result.course.courseduration,
        amountPaid: result.updatedPayment.amount,
        totalAmount: result.course.price.finalPrice,
        isEmi: false,
        courseUrl: `https://yourwebsite.com/courses/${result.course._id}`,
        courseThumbnail:
          result.course.thumbnail ||
          "https://yourwebsite.com/default-thumbnail.jpg",
        noRefundPolicy: "As per our policy, this course is non-refunded.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and course enrolled successfully",
      payment: result.updatedPayment,
      paymentMethodUsed: finalPaymentMethod, //  Return actual method used
      courseDetails: {
        name: result.course.coursename,
        duration: result.course.courseduration,
        totalAmount: result.course.price.finalPrice,
        thumbnail:
          result.course.thumbnail ||
          "https://yourwebsite.com/default-thumbnail.jpg",
        noRefundPolicy: "As per our policy, this course is non-refunded.",
      },
      emiDetails: result.emiPlan
        ? {
            monthlyAmount: result.emiDetails.monthlyAmount,
            totalEmis: result.emiDetails.months,
            nextDueDate: getNextDueDate(
              new Date(),
              result.updatedPayment.emiDueDay,
              1
            ),
          }
        : null,
      isTestPayment,
    });
  } catch (error) {
    console.error("verifyPayment error:", error);
    const responsePayload = {
      success: false,
      message: "Payment verification failed",
      error: error.message,
    };
    if (process.env.NODE_ENV !== "production" && error.stack) {
      responsePayload.stack = error.stack;
    }
    return res.status(500).json(responsePayload);
  }
};

export const getEmiDetailsForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    const course = await CourseNewModel.findById(courseId).select(
      "coursename price courseduration"
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const emiDetails = getEmiDetails(course);

    return res.status(200).json({
      success: true,
      eligible: emiDetails.eligible,
      monthlyAmount: emiDetails.monthlyAmount,
      totalAmount: emiDetails.totalAmount,
      duration: course.courseduration,
      emiPeriod: emiDetails.months,
      notes: emiDetails.notes,
      emiConfiguration: course.emi,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Helper: Create EMI Plan (Optimized) - Exported for webhook use
export const createEmiPlan = async (
  userId,
  courseId,
  course,
  user,
  dueDay,
  emiDetails,
  session = null // Optional session parameter for transactions
) => {
  const emis = [];
  const now = new Date();

  // First EMI (paid now)
  emis.push({
    month: 1,
    monthName: getMonthNameFromDate(now),
    dueDate: now,
    amount: emiDetails.monthlyAmount,
    status: "paid",
    paymentDate: now,
    //gracePeriodEnd: new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000), // 7-day grace period
  });

  // Subsequent EMIs
  for (let month = 2; month <= emiDetails.months; month++) {
    const dueDate = getNextDueDate(now, dueDay, month - 1);
    emis.push({
      month,
      monthName: getMonthNameFromDate(dueDate),
      dueDate,
      amount: emiDetails.monthlyAmount,
      status: "pending",
      gracePeriodEnd: new Date(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000), // 3-day grace period
    });
  }

  const emiPlan = new EMIPlan({
    userId,
    courseId,
    CourseMotherId: course.CourseMotherId,
    coursename: course.coursename,
    coursePrice: course.price.finalPrice,
    courseduration: course.courseduration,
    username: user.username,
    studentRegisterNumber: user.studentRegisterNumber,
    email: user.email,
    mobile: user.mobile,
    totalAmount: emiDetails.totalAmount,
    emiPeriod: emiDetails.months,
    selectedDueDay: dueDay,
    startDate: now,
    status: "active",
    emis,
  });

  // Save with session if provided
  const saveOptions = session ? { session } : {};
  const savedPlan = await emiPlan.save(saveOptions);

  // Update user enrollment with session
  const userUpdateOptions = session ? { session, new: true } : { new: true };
  await User.findByIdAndUpdate(
    userId,
    {
      $addToSet: {
        enrolledCourses: {
          course: courseId,
          coursename: course.coursename,
          emiPlan: savedPlan._id,
          accessStatus: "active",
        },
      },
    },
    userUpdateOptions
  );

  // Update course enrollment count with session
  const courseUpdateOptions = session ? { session } : {};
  await CourseNewModel.findByIdAndUpdate(
    courseId,
    { $inc: { studentEnrollmentCount: 1 } },
    courseUpdateOptions
  );

  return savedPlan;
};

//  Helper function: Reuse existing payment
async function reuseExistingPayment(
  existingPayment,
  courseId,
  paymentType,
  emiDueDay,
  res,
  options = {}
) {
  const course = await CourseNewModel.findById(courseId)
    .select("coursename price courseduration thumbnail CourseMotherId emi")
    .lean();

  if (!course) {
    return res.status(404).json({
      success: false,
      message: "Course not found",
    });
  }

  let emiDetails;
  if (paymentType === "emi") {
    try {
      emiDetails = validateCourseForEmi(course);
    } catch (emiError) {
      return res.status(400).json({
        success: false,
        message: emiError.message || "EMI not available for this course",
        errorCode: "EMI_NOT_AVAILABLE",
      });
    }
  }

  const response = {
    success: true,
    message: options.warningMessage || "Resuming your previous payment session",
    order: {
      id: existingPayment.razorpayOrderId,
      amount: Math.round(existingPayment.amount * 100),
      currency: existingPayment.currency,
    },
    paymentId: existingPayment._id,
    courseDetails: {
      name: course.coursename,
      duration: course.courseduration,
      totalAmount: course.price.finalPrice,
      thumbnail:
        course.thumbnail || "https://yourwebsite.com/default-thumbnail.jpg",
      noRefundPolicy: "As per our policy, this course is non-refunded.",
    },
  };

  if (paymentType === "emi") {
    response.emiDetails = {
      monthlyAmount: emiDetails.monthlyAmount,
      totalEmis: emiDetails.months,
      nextDueDate: getNextDueDate(new Date(), emiDueDay, 1),
    };
  }

  return res.status(200).json(response);
}

/**
 * =========== GET APIS
 */

export const getUserPayments = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 5, status = "", sort = "-createdAt" } = req.query;

    // Build the query
    const query = { userId };

    // Status filter
    if (status) {
      query.paymentStatus = status;
    }

    // Execute query with pagination
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("courseId", "coursename thumbnail duration")
        .lean(),
      Payment.countDocuments(query),
    ]);

    // Get user's total spending
    const totalSpent = await Payment.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          paymentStatus: "completed",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const completed = await Payment.countDocuments({
      userId,
      paymentStatus: "completed",
    });

    const pending = await Payment.countDocuments({
      userId,
      paymentStatus: "pending",
    });

    res.status(200).json({
      success: true,
      data: {
        payments,
        summary: {
          totalPayments: total,
          totalSpent,
          completed,
          pending,
        },
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error.message,
    });
  }
};

/**
 * @desc    Get single payment details (User)
 * @route   GET /api/user/payments/:id
 * @access  Private
 */
export const getUserPaymentById = async (req, res) => {
  try {
    const userId = req.userId;

    const payment = await Payment.findOne({
      _id: req.params.id,
      userId,
    }).populate("courseId", "coursename price duration instructor");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found or unauthorized",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
      error: error.message,
    });
  }
};


