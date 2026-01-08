//Models/Course-Model/Course-model.js
import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false, timestamps: true }
);

const lessonSchema = new mongoose.Schema(
  {
    lessonname: { type: String, required: true },
    audioFile: [MediaSchema],
    videoFile: [MediaSchema],
    pdfFile: [MediaSchema],
  },
  { timestamps: true }
);

const chapterSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    lessons: [lessonSchema],
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref:"ExamQuestion"
    }
  },
  { timestamps: true }
);

const instructorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: String,
    socialmedia_id: String,
  },
  { _id: false }
);

// EMI Schema (for students)
const emiSchema = new mongoose.Schema(
  {
    isAvailable: { type: Boolean, default: false }, // whether EMI is available
    emiDurationMonths: { type: Number, default: null }, // e.g. 6, 12, 24 months
    monthlyAmount: { type: Number }, // admin defined monthly emi amount
    totalAmount: { type: Number }, // total amount to be paid via EMI
    notes: { type: String }, // admin remarks or conditions
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    CourseMotherId: { type: String, required: true },
    coursename: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    courseduration: {
      type: String,
      enum: ["6 months", "1 year", "2 years"],
      required: true,
    },
    thumbnail: { type: String },
    previewvedio: { type: String },
    contentduration: {
      hours: { type: Number, default: 0 },
      minutes: { type: Number, default: 0 },
    },
    chapters: [chapterSchema],
    price: {
      amount: { type: Number, required: true }, // MRP (what you set)
      currency: { type: String, required: true, default: "INR" },
      discount: { type: Number, default: 0, min: 0, max: 100 },
      finalPrice: { type: Number }, // What customer pays (all-inclusive)
      // Breakdown (visible to users for transparency)
      breakdown: {
        courseValue: { type: Number }, // Net course value (after removing taxes)

        gst: {
          cgst: { type: Number }, // CGST amount (9%)
          sgst: { type: Number }, // SGST amount (9%)
          total: { type: Number }, // Total GST (18%)
        },

        transactionFee: { type: Number }, // Transaction fee (2%)
      },
    },
    emi: emiSchema,
    level: {
      type: String,
      enum: ["beginner", "medium", "hard"],
      required: true,
    },
    language: {
      type: String,
      enum: ["english", "tamil"],
      required: true,
    },
    certificates: {
      type: String,
      enum: ["yes", "no"],
      required: true,
    },
    instructor: instructorSchema,
    description: { type: String },
    whatYoullLearn: [String],
    review: [{ type: String }],
    rating: { type: Number, min: 0, max: 5 },
    studentEnrollmentCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);
// Automatically calculate finalPrice before saving
courseSchema.pre("save", function (next) {
  if (this.isModified("price.amount") || this.isModified("price.discount")) {
    const mrp = this.price.amount;
    const discountPercent = this.price.discount || 0;

    // Step 1: Calculate final price after discount
    this.price.finalPrice = mrp * (1 - discountPercent / 100);

    // Step 2: Reverse calculate breakdown
    // Formula: finalPrice = courseValue + (courseValue × 18%) + (courseValue × 2%)
    // finalPrice = courseValue × (1 + 0.18 + 0.02)
    // finalPrice = courseValue × 1.20
    // Therefore: courseValue = finalPrice ÷ 1.20

    const courseValue = this.price.finalPrice / 1.2;
    const cgst = courseValue * 0.09;
    const sgst = courseValue * 0.09;
    const gstTotal = cgst + sgst;
    const transactionFee = courseValue * 0.02;

    // Round to 2 decimal places
    this.price.breakdown = {
      courseValue: Math.round(courseValue * 100) / 100,
      gst: {
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        total: Math.round(gstTotal * 100) / 100,
      },
      transactionFee: Math.round(transactionFee * 100) / 100,
    };

    // Round final price
    this.price.finalPrice = Math.round(this.price.finalPrice * 100) / 100;
  }
  next();
});

// Indexes for better performance

courseSchema.index({ category: 1 });
courseSchema.index({ "price.finalPrice": 1 });
courseSchema.index({ studentEnrollmentCount: -1 });
courseSchema.index({ level: 1 });
courseSchema.index({ language: 1 });
courseSchema.index({ createdAt: -1 });
courseSchema.index({ category: 1, "price.finalPrice": 1 });

export default mongoose.model("Course", courseSchema);
