import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_ADMIN,
    pass: process.env.EMAIL_PASS,
  },
});
export const sendOtpEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_ADMIN,
      to: email,
      subject: "Verify Your schoolemy Account",
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #ddd;">
          <h2>Hello,${email}</h2>
          <p>To continue setting up your schoolemy account, please verify your account with the code below:</p>
          <h1 style="font-size: 48px; margin: 20px 0; color: #333;">${otp}</h1>
          <p style="color: #777;">This code will expire in 2 minutes. Please do not disclose this code to others.</p>
          <p style="color: #777;">If you did not make this request, please disregard this email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #999;">© 2025 Schoolemy. All Rights Reserved.</p>
        </div>
      `,
    });
    return { success: true, message: "OTP sent to Email successfully" };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, message: "Error sending OTP email.", error: error.message };
  }
};
export default transporter;
