//Models/Emi-plan/Emi-Plan-Model.js
import mongoose from "mongoose";

// ===== EMI Schema ===== //
// Stores individual EMI installment details for a particular EMI plan
const EMISchema = new mongoose.Schema({
  month: { type: Number, required: true }, // EMI month number (e.g., 1, 2, 3…)
  monthName: { type: String, required: true }, // e.g. "January", "February"
  dueDate: { type: Date, required: true }, // EMI due date
  amount: { type: Number, required: true }, // EMI amount (dynamic based on course configuration)
  status: {
    type: String,
    enum: ["pending", "paid", "late"], // EMI payment status
    default: "pending",
  },
  paymentDate: { type: Date }, // Date when payment was made
  razorpayOrderId: { type: String }, // Razorpay order ID for tracking payment
  razorpayPaymentId: { type: String }, // Razorpay payment ID for tracking transaction
  razorpaySignature: { type: String }, // Razorpay signature for verification
  gracePeriodEnd: { type: Date }, // End date for EMI's grace period
});

// ===== EMI Plan Schema ===== //
// Stores EMI plans linked to users and courses, along with payment, notifications, and lock history
const EMIPlanSchema = new mongoose.Schema(
  {
    // ===== User Details ===== //
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to User collection
      required: true,
      index: true,
    },
    username: { type: String, required: true }, // User's name
    studentRegisterNumber: { type: String, index: true, required: true }, // Unique registration number
    email: { type: String, index: true }, // User's email
    mobile: { type: String, index: true }, // User's mobile number

    // ===== Course Details ===== //
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course", // Reference to Course collection
      required: true,
      index: true,
    },
    CourseMotherId: { type: String, required: true }, // Parent course identifier
    coursename: { type: String, required: true }, // Course name
    coursePrice: { type: Number, required: true }, // Total course price
    courseduration: { type: String, required: true }, // Course duration

    // ===== EMI Plan Info ===== //
    totalAmount: { type: Number, required: true }, // Total EMI amount
    emiPeriod: { type: Number, required: true }, // EMI duration in months (6, 12, 24 etc.)
    selectedDueDay: { type: Number, required: true, min: 1, max: 15 }, // Preferred EMI due day of month
    startDate: { type: Date, required: true }, // EMI start date
    status: {
      type: String,
      enum: ["active", "locked", "completed", "cancelled"], // EMI plan status
      default: "active",
    },

    // ===== EMI Installments ===== //
    emis: [EMISchema], // Array of EMI records

    // ===== Lock History ===== //
    lockHistory: [
      {
        lockDate: { type: Date, required: true }, // When EMI plan was locked
        unlockDate: { type: Date }, // When EMI plan was unlocked
        overdueMonths: { type: Number, required: true }, // Overdue EMI months count
        reasonForLock: { type: String, required: true }, // Reason for locking the EMI plan
        lockedBy: {
          type: String,
          default: "system", // Could be admin ID or 'system'
        },
      },
    ],

    // ===== Notification Tracking ===== //
    notifications: [
      {
        type: {
          type: String,
          enum: [
            "reminder",
            "overdue",
            "final_notice",
            "welcome",
            "lock",
            "unlock",
          ], // Type of notification
        },
        sentAt: Date, // When notification was sent
        channel: {
          type: String,
          enum: ["gmail", "sms", "whatsapp"], // Communication channel
        },
        status: {
          type: String,
          enum: ["sent", "failed", "pending"], // Delivery status of notification
        },
        errorMessage: String, // Store error details if failed
        retryCount: {
          type: Number,
          default: 0,
          min: 0,
          max: 5,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
    optimisticConcurrency: true, // Enable versioning for concurrency control
  }
);

// ===== Indexes for Performance ===== //
EMIPlanSchema.index({ "emis.dueDate": 1, status: 1 }); // For cron jobs and overdue checks
EMIPlanSchema.index({ userId: 1, status: 1 }); // For user-specific queries
EMIPlanSchema.index({ courseId: 1, status: 1 }); // For course-specific queries
EMIPlanSchema.index({ "emis.status": 1, "emis.dueDate": 1 }); // For EMI status queries
EMIPlanSchema.index({ studentRegisterNumber: 1, isDeleted: 1 }); // For student lookup
EMIPlanSchema.index({ createdAt: -1 }); // For recent EMI plans
EMIPlanSchema.index({ status: 1, "lockHistory.unlockDate": 1 }); // For locked plans
EMIPlanSchema.index({ userId: 1, courseId: 1 }, { unique: true });
EMIPlanSchema.index({ status: 1 });
EMIPlanSchema.index({ 'emis.dueDate': 1 });
EMIPlanSchema.index({ 'emis.status': 1 });
// Export the EMIPlan model
const EMIPlan = mongoose.model("EMIPlan", EMIPlanSchema);
export default EMIPlan;
