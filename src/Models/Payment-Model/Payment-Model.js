//Models/Payment-Model/Payment-Model.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // User & Course References
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    // Basic Metadata
    username: { type: String, required: true },
    studentRegisterNumber: { type: String, index: true },
    email: { type: String, index: true },
    mobile: { type: String, index: true },

    // Course Information
    CourseMotherId: { type: String, required: true },
    courseName: { type: String, required: true },
    // Payment Information
    paymentType: {
      type: String,
      enum: ["full", "emi", "emi_overdue", "emi_installment", "one-time"],
      required: true,
    },
    emiDueDay: { type: Number, min: 1, max: 31 },

    // EMI Payment Tracking
    emiPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EMIPlan",
      index: true,
    },
    emiInstallments: [
      {
        emiId: { type: mongoose.Schema.Types.ObjectId },
        month: { type: Number },
        monthName: { type: String },
        amount: { type: Number },
        dueDate: { type: Date },
        wasOverdue: { type: Boolean, default: false },
      },
    ],

    amount: {
      type: Number,
      required: true,
      min: 0,
      set: (v) => parseFloat(v.toFixed(2)),
    },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "INR",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: [
        "UPI",
        "CARD",
        "DEBIT_CARD",
        "CREDIT_CARD",
        "NETBANKING",
        "WALLET",
        "EMI",
        "COD",
        "PAYLATER",
        "BANK_TRANSFER",
        "QR_CODE",
        "AUTO_DEBIT",
      ],
      required: true,
    },
    paymentGateway: {
      type: String,
      default: "razorpay",
    },
    // Razorpay Specific Fields (optional for other gateways)
    razorpayOrderId: {
      type: String,
      index: true,
    },
    razorpayPaymentId: String,
    razorpaySignature: String,

    // Device & Technical Info
    ipAddress: String,
    platform: {
      type: String,
      enum: ["web", "android", "ios"],
      default: "web",
    },
    isInternational: {
      type: Boolean,
      default: false,
    },

    // Optional Gateway Details
    cardDetails: {
      cardBrand: String, // VISA, MasterCard, etc.
      last4: String, // Last 4 digits of card
      bank: String,
    },
    upiDetails: {
      upiId: String,
      payerName: String,
    },
    bankDetails: {
      bankName: String,
      accountNumberMasked: String,
      ifscCode: String,
    },
    walletProvider: String,
  },
  {
    timestamps: true,
  }
);


// indexes for fast queries
paymentSchema.index({ userId: 1, paymentStatus: 1 });
paymentSchema.index({ userId: 1, courseId: 1 });
paymentSchema.index({ email: 1, paymentStatus: 1 });
paymentSchema.index({ emiPlanId: 1, paymentType: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ razorpayPaymentId: 1 });


const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
