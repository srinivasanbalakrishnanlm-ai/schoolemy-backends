import User from "../../Models/User-Model/User-Model.js";
import sharp from "sharp";

// Helper function to convert mobile string to number (removes + prefix if present)
const convertMobileToNumber = (mobile) => {
  if (typeof mobile === "number") return mobile;
  if (typeof mobile === "string") {
    // Remove + prefix and any spaces, then convert to number
    const cleaned = mobile.replace(/^\+|\s/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }
  return null;
};

const convertToBase64 = (buffer, mimetype) => {
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
};

const validateImageFile = (file) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB (reduced for better performance)

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
    };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "File size too large. Maximum 10MB allowed." };
  }

  return { valid: true };
};


// 🟢 Get User Profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get user's enrolled courses with populated course data
export const getUserEnrolledCourses = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate(
        "enrolledCourses.course",
        "coursename category price emi thumbnail"
      )
      .populate("enrolledCourses.emiPlan")
      .select("enrolledCourses");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Transform enrolled courses to include course data
    const enrolledCourses = user.enrolledCourses.map((enrollment) => ({
      _id: enrollment.course._id,
      coursename: enrollment.course.coursename,
      category: enrollment.course.category,
      price: enrollment.course.price,
      emi: enrollment.course.emi,
      thumbnail: enrollment.course.thumbnail,
      accessStatus: enrollment.accessStatus,
      emiPlan: enrollment.emiPlan,
    }));

    res.status(200).json({
      success: true,
      data: enrolledCourses,
    });
  } catch (error) {
    console.error("Error fetching user enrolled courses:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// 🟡 Update User Profile Details (except profile picture)
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Debug logging
    console.log('📝 Profile update request:', {
      userId,
      body: req.body,
      headers: {
        contentType: req.headers['content-type'],
        authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'none'
      }
    });
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }

    const {
      username, // Changed from firstName, lastName
      email,
      mobile, // Changed from mobileNumber
      fatherName, // Changed from fatherOrHusbandName
      dateofBirth, // Changed from dateOfBirth
      gender,
      bloodGroup,
      address,
      Nationality, // Added
      Occupation, // Added
    } = req.body;

    // Validate dateofBirth format if provided
    let validatedDateofBirth = null;
    if (dateofBirth) {
      const date = new Date(dateofBirth);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format for dateofBirth. Please use a valid date (YYYY-MM-DD or ISO format).",
        });
      }
      // Check if date is not in the future
      if (date > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Date of birth cannot be in the future.",
        });
      }
      // Check if date is reasonable (not more than 150 years ago)
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 150);
      if (date < minDate) {
        return res.status(400).json({
          success: false,
          message: "Date of birth is too far in the past.",
        });
      }
      validatedDateofBirth = date;
    }

    // Optional: Check if the new email already exists for another user (only if email is being updated)
    if (email) {
      const existingUserWithEmail = await User.findOne({
        email: email,
        _id: { $ne: userId }, // Exclude current user
      });
      if (existingUserWithEmail) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Email already in use by another account",
          });
      }
    }

    // Optional: Check if the new username already exists for another user (only if username is being updated)
    if (username) {
      const existingUserWithUsername = await User.findOne({
        username: username,
        _id: { $ne: userId }, // Exclude current user
      });
      if (existingUserWithUsername) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Username already in use by another account",
          });
      }
    }

    // Optional: Check if the new mobile already exists for another user (only if mobile is being updated)
    if (mobile) {
      const mobileNumber = convertMobileToNumber(mobile);
      if (!mobileNumber) {
        return res.status(400).json({
          success: false,
          message: "Invalid mobile number format",
        });
      }
      const existingUserWithMobile = await User.findOne({
        mobile: mobileNumber,
        _id: { $ne: userId }, // Exclude current user
      });
      if (existingUserWithMobile) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Mobile number already in use by another account",
          });
      }
    }

    // Validate address structure if provided
    if (address && typeof address !== 'object') {
      return res.status(400).json({
        success: false,
        message: "Address must be an object with properties: street, city, state, country, zipCode",
      });
    }

    // Validate address properties if address object is provided
    if (address) {
      const allowedAddressKeys = ['street', 'city', 'state', 'country', 'zipCode'];
      const providedKeys = Object.keys(address);
      const invalidKeys = providedKeys.filter(key => !allowedAddressKeys.includes(key));
      
      if (invalidKeys.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid address properties: ${invalidKeys.join(', ')}. Allowed properties: ${allowedAddressKeys.join(', ')}`,
        });
      }
    }

    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : undefined;
    if (mobile && !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number format",
      });
    }

    const updateData = {
      username,
      email,
      mobile: mobileNumber,
      fatherName,
      dateofBirth: validatedDateofBirth, // Use validated date
      gender,
      bloodGroup,
      address, // Address object { street, city, state, country, zipCode }
      Nationality,
      Occupation,
    };

    // Remove undefined fields so they don't overwrite existing data with nulls if not provided
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );
    if (updateData.address && Object.keys(updateData.address).length === 0) {
      delete updateData.address; // Don't send empty address object unless intended
    } else if (updateData.address) {
      Object.keys(updateData.address).forEach(
        (key) =>
          updateData.address[key] === undefined &&
          delete updateData.address[key]
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId, // Find user by ID
      { $set: updateData }, // Update specified fields
      { new: true, runValidators: true } // Enable validators for proper schema validation
    ).select("-password");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return res
        .status(400)
        .json({
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        });
    }
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(400)
        .json({
          success: false,
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`,
          error: error.message,
        });
    }
    
    res.status(500).json({
      success: false,
      message: "Update failed due to server error",
      error: error.message,
    });
  }
};


// 🔵 Update Profile Picture - Updated to use Base64
export const updateProfilePicture = async (req, res) => {
  try {
    console.log("🖼️ Uploading profile picture for userId:", req.userId);

    // Debugging info to help diagnose multipart/form-data issues on AWS
    console.log("🔧 profile upload Content-Type:", req.headers && req.headers['content-type']);
    try {
      console.log("🔧 req.is('multipart/form-data'):", typeof req.is === 'function' ? req.is('multipart/form-data') : 'n/a');
    } catch(e) { console.warn('🔧 req.is check failed', e); }
    console.log("🔧 req.file present:", !!req.file, req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : null);

    if (!req.userId) {
      console.log("⚠️ User ID not provided");
      return res
        .status(401)
        .json({ 
          success: false,
          message: "Unauthorized: User not authenticated" 
        });
    }

    if (!req.file) {
      console.log("⚠️ No file uploaded");
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }

    // Validate file buffer exists
    if (!req.file.buffer || !Buffer.isBuffer(req.file.buffer)) {
      console.log("⚠️ Invalid file buffer");
      return res.status(400).json({
        success: false,
        message: "Invalid file data. Please try uploading again.",
      });
    }

    // Validate uploaded file
    const validation = validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Convert file to optimized Base64 (resize & compress to reduce size)
    let profilePictureData;
    try {
      // Sanitize filename - remove path and special characters
      const sanitizedFilename = req.file.originalname
        .replace(/^.*[\\\/]/, '') // Remove path
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
        .substring(0, 255); // Limit length

      // Resize and compress image using sharp to significantly reduce stored size
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize({ width: 512, height: 512, fit: "inside" }) // keep aspect ratio, max 512px
        .jpeg({ quality: 70 }) // compress to reasonable quality
        .toBuffer();

      const mime = "image/jpeg";
      const rawBase64 = optimizedBuffer.toString('base64');
      const dataUri = convertToBase64(optimizedBuffer, mime);

      // Store size in kilobytes (KB), rounded to 2 decimal places
      const sizeInKB = Number((optimizedBuffer.length / 1024).toFixed(2));

      profilePictureData = {
        // Keep old 'data' field (may contain data URI for backward compatibility)
        data: dataUri,
        // New 'base64' field stores raw base64 without data URI prefix (preferred)
        base64: rawBase64,
        filename: sanitizedFilename || 'profile-picture',
        mimetype: mime,
        size: sizeInKB,
        uploadDate: new Date(),
      };
      console.log("📷 Profile picture converted to Base64 successfully (dataUri length)", dataUri.length);
    } catch (error) {
      console.error("⚠️ Error converting image to Base64:", error);
      return res.status(400).json({
        success: false,
        message: "Failed to process profile picture.",
        error: error.message,
      });
    }

    // Update user profile picture in database
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: { profilePicture: profilePictureData },
      },
      { new: true, runValidators: true } // Enable validators for proper schema validation
    ).select("-password");

    if (!updatedUser) {
      console.log("❌ User not found during profile picture update");
      return res
        .status(404)
        .json({ 
          success: false,
          message: "User not found, cannot update profile picture" 
        });
    }

    console.log("✅ Profile picture updated for user:", updatedUser._id);

    // Prepare a reduced response to avoid sending large base64 data through API Gateway
    // Add null safety check for profilePicture
    const safeProfilePicture = updatedUser.profilePicture ? {
      filename: updatedUser.profilePicture.filename || 'profile-picture',
      mimetype: updatedUser.profilePicture.mimetype || 'image/jpeg',
      size: updatedUser.profilePicture.size || 0,
      uploadDate: updatedUser.profilePicture.uploadDate || new Date(),
    } : {
      filename: 'profile-picture',
      mimetype: 'image/jpeg',
      size: 0,
      uploadDate: new Date(),
    };

    console.log("🔐 Returning safe profile picture metadata (data omitted) - size:", safeProfilePicture.size);

    res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: safeProfilePicture,
    });
  } catch (error) {
    console.error("🔥 Error updating profile picture:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return res
        .status(400)
        .json({
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        });
    }
    
    // Handle MongoDB duplicate key error (unlikely for profile picture, but good to have)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(400)
        .json({
          success: false,
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`,
          error: error.message,
        });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to upload photo", 
      error: error.message 
    });
  }
};