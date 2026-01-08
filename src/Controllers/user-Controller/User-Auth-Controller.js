import { sendOtpEmail } from "../../Notification/EmailTransport.js";
import { sendOtpSMS } from "../../Utils/MobileTranspost.js";
import User from "../../Models/User-Model/User-Model.js";
import { generateOtp } from "../../Utils/OTPGenerate.js";
import { JwtToken } from "../../Utils/JwtToken.js";
import {
  isValidEmail,
  isValidPassword,
  isValidMobile,
} from "../../Utils/validate.js";
import bcrypt from "bcryptjs";
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


// Add Base64 utility function
const convertToBase64 = (buffer, mimetype) => {
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
};

// Add file validation function
const validateImageFile = (file) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
    };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "File size too large. Maximum 5MB allowed." };
  }

  return { valid: true };
};

export const register = async (req, res) => {
  try {
    const { email, mobile } = req.body;

    if (email && !isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format." });
    }

    if (mobile && !isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number format. Include country code.",
      });
    }

    if (!email && !mobile) {
      return res
        .status(400)
        .json({ success: false, message: "Email or mobile is required." });
    }

    if (email && mobile) {
      return res.status(400).json({
        success: false,
        message: "Provide only one: email or mobile.",
      });
    }

    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };
    const existingUser = await User.findOne(query);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User  with these credentials already exists.",
      });
    }


    // NOTE: We only need the OTP value now
    const { otp } = generateOtp();
    

    const result = email
      ? await sendOtpEmail(email, otp)
      : await sendOtpSMS(mobile, otp);
    

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: `Failed to send OTP. ${result.message}`,
      });
    }

    // IMPORTANT: We REMOVED the user creation and user.save() logic here.

    // NEW: Return the OTP in the response for frontend verification
    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email || mobile}`,
      otp_for_verification: otp, // This is the new part!
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const completeRegistration = async (req, res) => {
  try {
    // 1. Extract ALL data from the request
    const {
      email,
      mobile,
      password,
      username,
      fatherName,
      dateofBirth,
      gender,
      bloodGroup,
      Nationality,
      Occupation,
      street,
      city,
      state,
      country,
      zipCode,
    } = req.body;

    // 2. Basic Validation for essential fields
    if (!password || !username || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Password, username, and profile picture are required.",
      });
    }
    if (!email && !mobile) {
      return res.status(400).json({
        success: false,
        message: "Email or mobile is required.",
      });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 8+ characters with a mix of uppercase, lowercase, number & special character.",
      });
    }
    // 3. Validate uploaded file
    if (req.file) {
      const validation = validateImageFile(req.file);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }
    }

    // 3. Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    
    // 4. Check again if user already exists
    const query = email ? { email } : { mobile: mobileNumber };
    const existingUser = await User.findOne(query);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email/mobile already exists.",
      });
    }

    // 5. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Handle file conversion to optimized Base64 (resize & compress to reduce size)
    let profilePictureData = null;
    if (req.file) {
      try {
        // Resize and compress image using sharp to significantly reduce stored size
        const optimizedBuffer = await sharp(req.file.buffer)
          .resize({ width: 512, height: 512, fit: "inside" }) // keep aspect ratio, max 512px
          .jpeg({ quality: 70 }) // compress to reasonable quality
          .toBuffer();

        // Store size in kilobytes (KB), rounded to 2 decimal places
        const sizeInKB = Number((optimizedBuffer.length / 1024).toFixed(2));

        profilePictureData = {
          data: convertToBase64(optimizedBuffer, "image/jpeg"),
          filename: req.file.originalname,
          mimetype: "image/jpeg",
          size: sizeInKB,
          uploadDate: new Date(),
        };
        
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Failed to process profile picture.",
        });
      }
    }

    // 7. Create the new user with ALL data at once
    //    - Always include email/mobile from `query`
    //    - Additionally, if a mobile was provided here, persist it on the user
    const newUserPayload = {
      ...query,
      password: hashedPassword,
      username,
      fatherName,
      dateofBirth: dateofBirth ? new Date(dateofBirth) : null,
      gender,
      bloodGroup,
      Nationality,
      Occupation,
      address: { street, city, state, country, zipCode },
      profilePicture: profilePictureData,
      registerOtpVerified: true,
    };

    // If mobile was sent in this step (even when OTP was via email), save it as well
    if (mobileNumber) {
      newUserPayload.mobile = mobileNumber;
    }

    const newUser = new User(newUserPayload);

    // 7. Save the user to the database
    await newUser.save();


    return res.status(201).json({
      success: true,
      message: "Registration complete! Welcome.",
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
       
      },
    });
  } catch (error) {
    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error during registration.",
      error: error.message,
    });
  }
};

export const resendOtp = async (req, res) => {
  try {

    const { email, mobile } = req.body;

    // ---  validation logic ---
    if (email && !isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format." });
    }
    if (mobile && !isValidMobile(mobile)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mobile number format." });
    }
    if (!email && !mobile) {
      return res
        .status(400)
        .json({ success: false, message: "Email or mobile is required." });
    }
    // --- End of validation ---

    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };
    const existingUser = await User.findOne(query);

    if (existingUser) {
      // The user already exists in the DB, meaning they are a registered user.
      // It's better to guide them to login or forgot password.
      return res.status(409).json({
        success: false,
        message:
          "An account with this email/mobile already exists. Please login.",
      });
    }

    // If user does NOT exist, we proceed to send a new OTP, just like the 'register' function.
    const { otp } = generateOtp();
  

    const result = email
      ? await sendOtpEmail(email, otp)
      : await sendOtpSMS(mobile, otp);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: `Failed to resend OTP. ${result.message}`,
      });
    }

    // Just like 'register', we send the new OTP back to the frontend
    return res.status(200).json({
      success: true,
      message: `New OTP sent to ${email || mobile}`,
      otp_for_verification: otp, // Send the new OTP back
    });
  } catch (error) {
    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, mobile, otp } = req.body;


  if (email && !isValidEmail(email)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid email format." });
  }

  try {
    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };
   

    const user = await User.findOne(query);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }


    if (
      user.registerOtp !== otp.toString() ||
      new Date() > new Date(user.registerOtpExpiresAt)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    const updatedUser = await User.findOneAndUpdate(
      query,
      {
        registerOtpVerified: true,
        registerOtp: undefined,
        registerOtpExpiresAt: undefined,
      },
      { new: true }
    );

    return res
      .status(200)
      .json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.mesage,
    });
  }
};

export const createPassword = async (req, res) => {
  try {
    const { email, mobile, password } = req.body;


    if (email && !isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format." });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 8+ characters with a mix of uppercase, lowercase, number & special character.",
      });
    }

    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };


    const user = await User.findOne(query).lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }



    if (!user.registerOtpVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Please verify OTP first" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { password: hashedPassword },
      { new: true }
    );


    return res
      .status(200)
      .json({ success: true, message: "Password created successfully" });
  } catch (error) {
    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const registerForm = async (req, res) => {
  try {
    const {
      email,
      mobile,
      username,
      fatherName,
      dateofBirth,
      gender,
      address,
      bloodGroup,
      Nationality,
      Occupation,
    } = req.body;

    const requiredFields = {
      email,
      username,

      fatherName,
      dateofBirth,
      gender,
      address,
      bloodGroup,
      Nationality,
      Occupation,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(
        ([key, value]) => value === undefined || value === null || value === ""
      )
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    if (!email && !mobile) {
      return res.status(400).json({
        success: false,
        message: "Email or mobile is required",
      });
    }

    // Validate uploaded file if present
    if (req.file) {
      const validation = validateImageFile(req.file);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }
    }

    // Find user - Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please complete registration first.",
      });
    }

    // Check registration completion
    if (!user.registerOtpVerified || !user.password) {
      return res.status(400).json({
        success: false,
        message: "Please complete the registration process first",
      });
    }

    // Validate date format if provided
    if (req.body.dateofBirth) {
      const dob = new Date(req.body.dateofBirth);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date of birth format",
        });
      }
      req.body.dateofBirth = dob;
    }

    // Prepare update data
    const updateData = {
      username,

      fatherName: req.body.fatherName || null,
      dateofBirth: req.body.dateofBirth || null,
      gender: req.body.gender || null,
      address: {
        street: req.body.address?.street || null,
        city: req.body.address?.city || null,
        state: req.body.address?.state || null,
        country: req.body.address?.country || null,
        zipCode: req.body.address?.zipCode || null,
      },
      bloodGroup: req.body.bloodGroup || null,
      Nationality: req.body.Nationality || null,
      Occupation: req.body.Occupation || null,
    };

    // Handle file upload if present
    if (req.file) {
      try {
        const profilePictureData = {
          data: convertToBase64(req.file),
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          uploadDate: new Date(),
        };
        updateData.profilePicture = profilePictureData;
       
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Failed to process profile picture.",
        });
      }
    }

    // Update user
    const updatedUser = await User.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -registerOtp -forgotPasswordOtp");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  const { email, mobile, password } = req.body;

  if (mobile && !isValidMobile(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Invalid mobile number format. Include country code.",
    });
  }

  if (email && !isValidEmail(email)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid email format." });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be 8+ characters with a mix of uppercase, lowercase, number & special character.",
    });
  }

  if (!(email || mobile) || !password) {
    return res.status(400).json({
      success: false,
      message: "Email/Mobile and password are required",
    });
  }

  try {
    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };

    const user = await User.findOne(query);


    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.registerOtpVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify OTP before logging in",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Password not set. Please reset your password.",
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email/mobile or password. Please try again",
      });
    }

    const token = JwtToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful! Welcome back.",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        //profilePicture: user.profilePicture, 
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("💥 Login Error:", error);  
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//forgot password api
export const forgotPassword = async (req, res) => {
  try {

    const { email, mobile } = req.body;

    if (email && !isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format." });
    }

    if (mobile && !isValidMobile(mobile)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mobile number format." });
    }

    if (!email && !mobile) {
      
      return res
        .status(400)
        .json({ success: false, message: "Email or mobile is required." });
    }

    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };
   
    const user = await User.findOne(query);

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found." });
    }

    // Generate OTP
    const { otp, otpExpiresAt } = generateOtp();
  

    // Save OTP to user document
    user.forgotPasswordOtp = otp;
    user.forgotPasswordOtpExpiresAt = otpExpiresAt;
    user.forgotPasswordOtpVerified = false;
    await user.save();


    // Send OTP
    const result = email
      ? await sendOtpEmail(email, otp)
      : await sendOtpSMS(mobile, otp);

    if (!result.success) {
      
      return res.status(400).json({
        success: false,
        message: `Failed to send OTP. ${result.message}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email || mobile} for password reset`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const verifyForgotPasswordOtp = async (req, res) => {
  try {

    const { email, mobile, otp } = req.body;

    if (email && !isValidEmail(email)) {

      return res
        .status(400)
        .json({ success: false, message: "Invalid email format." });
    }

    if (mobile && !isValidMobile(mobile)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mobile number format." });
    }

    const query = email ? { email } : { mobile };
    const user = await User.findOne(query);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Check OTP
    if (
      user.forgotPasswordOtp !== otp.toString() ||
      new Date() > new Date(user.forgotPasswordOtpExpiresAt)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Mark OTP as verified
    user.forgotPasswordOtpVerified = true;
    user.forgotPasswordOtp = undefined;
    user.forgotPasswordOtpExpiresAt = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const ForgotResetPassword = async (req, res) => {
  try {
    const { email, mobile, newPassword } = req.body;

    if (email && !isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format." });
    }

    if (mobile && !isValidMobile(mobile)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mobile number format." });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 8+ characters with a mix of uppercase, lowercase, number & special character.",
      });
    }

    // Convert mobile to number if provided
    const mobileNumber = mobile ? convertMobileToNumber(mobile) : null;
    const query = email ? { email } : { mobile: mobileNumber };
    const user = await User.findOne(query);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (!user.forgotPasswordOtpVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Please verify OTP first" });
    }

    // Hash new password

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and reset OTP fields
    user.password = hashedPassword;
    user.forgotPasswordOtpVerified = false;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//logout
export const logoutUser = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User  not found" });
    }

    const currentTime = new Date();

    // Find the latest login session without a logoutTime
    const latestSession = user.loginHistory.find(
      (session) => !session.logoutTime
    );
    if (latestSession) {
      latestSession.logoutTime = currentTime;
      latestSession.sessionDuration = Math.floor(
        (currentTime - latestSession.loginTime) / (1000 * 60)
      ); // in minutes
    }

    user.status = "logged-out";
    user.lastLogout = currentTime; // Update last logout time
    await user.save();

    // Calculate days since last logout
    const daysSinceLogout = Math.floor(
      (currentTime - user.lastLogout) / (1000 * 60 * 60 * 24)
    );

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
      daysSinceLogout: daysSinceLogout,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
