//Models/User-Model/User-Model.js
import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    studentRegisterNumber: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple documents to have null for this field if it's not set
      default: null,
    },
    //1st section
    email: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    mobile: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },
    password: { type: String }, // Should be selected: false by default if not needed in most queries
    role: { type: String, default: "user" },

    //2-section
    username: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    fatherName: { type: String, default: null, trim: true },
    dateofBirth: { type: Date, default: null },
    gender: { type: String, enum: ["Male", "Female", "Other"], default: null },
    address: {
      street: { type: String, default: null, trim: true },
      city: { type: String, default: null, trim: true },
      state: { type: String, default: null, trim: true },
      country: { type: String, default: null, trim: true },
      zipCode: { type: String, default: null, trim: true },
    },
    bloodGroup: { type: String, default: null, trim: true },
    Nationality: { type: String, default: null, trim: true },
    Occupation: { type: String, default: null, trim: true },

    //3rd section - Profile Picture stored as Base64 in DB
    // NOTE: Base64 storage increases size by ~33%. Consider migrating to S3/cloud storage in future.
    // Current optimization: getUserProfile excludes base64 by default, use getProfilePicture endpoint when needed.
    profilePicture: {
      data: {
        type: String, // Base64 encoded image data OR data URI (backwards compatible)
        default: null,
      },
      base64: { // Raw base64 WITHOUT data: prefix (new, preferred) - excluded from getUserProfile by default
        type: String,
        default: null,
      },
      filename: {
        type: String,
        default: null,
      },
      mimetype: {
        type: String,
        default: null,
      },
      size: {
        type: Number,
        default: null,
      },
      uploadDate: {
        type: Date,
        default: null,
      },
    },

    //User Activity Tracking
    loginHistory: [
      {
        loginTime: { type: Date, required: true },
        ipAddress: { type: String },
        userAgent: { type: String },
        logoutTime: { type: Date },
        sessionDuration: { type: Number }, // in minutes
      },
    ],
    lastActivity: { type: Date },
    status: {
      type: String,
      enum: ["active", "inactive", "logged-out"],
      default: "inactive", // Changed from null to a valid enum
    },
    lastLogout: { type: Date },

    // Registration OTP
    registerOtp: { type: String, default: undefined },
    registerOtpExpiresAt: { type: Date, default: undefined },
    registerOtpVerified: { type: Boolean, default: false },

    // Forgot Password OTP
    forgotPasswordOtp: { type: String, default: undefined },
    forgotPasswordOtpExpiresAt: { type: Date, default: undefined },
    forgotPasswordOtpVerified: { type: Boolean, default: false },

    //User EMI- Details
    enrolledCourses: [
      {
        course: {
          type: Schema.Types.ObjectId,
          ref: "Course",
        },
        coursename: String,
        emiPlan: {
          type: Schema.Types.ObjectId,
          ref: "EMIPlan",
        },
        accessStatus: {
          type: String,
          enum: ["active", "locked"],
          default: "active",
        },
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isNew || this.studentRegisterNumber) return next();

  try {
    const COMPANY_CODE = "GKVK";
    const currentYear = new Date().getFullYear() % 100;
    const yearPrefix = `${COMPANY_CODE}${currentYear}`;

    const lastUser = await this.constructor.findOne(
      { studentRegisterNumber: new RegExp(`^${yearPrefix}`) },
      { studentRegisterNumber: 1 },
      { sort: { studentRegisterNumber: -1 } }
    );

    let newSerial = 1;
    if (lastUser && lastUser.studentRegisterNumber) {
      const lastSerial = parseInt(lastUser.studentRegisterNumber.slice(-4), 10);
      newSerial = lastSerial + 1;
    }

    this.studentRegisterNumber = `${yearPrefix}B1${newSerial
      .toString()
      .padStart(4, "0")}`;
    next();
  } catch (err) {
    console.error("Error generating studentRegisterNumber:", err);
    next(err);
  }
});
const User = model("User", userSchema);
export default User;
