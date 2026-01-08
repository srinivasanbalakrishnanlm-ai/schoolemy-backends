import express from "express";
import {
  register,
  verifyOtp,
  createPassword,
  login,
  logoutUser,
  forgotPassword,
  verifyForgotPasswordOtp,
  ForgotResetPassword,
  registerForm,
  resendOtp,
  completeRegistration,
} from "../../Controllers/user-Controller/User-Auth-Controller.js";
import multer from "multer";
const router = express.Router();

// Configure multer for memory storage (Base64)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."
        ),
        false
      );
    }
  },
});

router.post("/complete-registration",upload.single("profilePicture"),completeRegistration);
// Registration Flow
router.post("/register", register);
router.post("/resend-otp", resendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/create-password", createPassword);

//form
router.post("/form", upload.single("profilePicture"), registerForm);
//login
router.post("/login", login);

//logout
router.post("/logout", logoutUser);

// Forgot Password Flow
router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-password-otp", verifyForgotPasswordOtp);
router.post("/reset-password", ForgotResetPassword);

export default router;
