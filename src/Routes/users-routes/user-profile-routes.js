import express from "express";
import multer from "multer";
import {
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  getUserEnrolledCourses,
} from "../../Controllers/user-Controller/user-profile-controller.js";

const router = express.Router();



// Updated multer configuration to use memory storage for Base64
const upload = multer({
  storage: multer.memoryStorage(), // Changed from diskStorage to memoryStorage
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit (aligned with controller validation)
  fileFilter: function (req, file, cb) {
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

router.get("/profiles", getUserProfile); // Get user profile (excludes base64 by default, use ?includeImage=true to include)
router.get("/user/courses", getUserEnrolledCourses); // Get user's enrolled courses
router.put("/putprofile", updateUserProfile); 
router.put("/profile-picture", upload.single("profilePicture"), updateProfilePicture);

export default router;