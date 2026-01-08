import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Derive SMTP connection settings safely
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const rawPort = process.env.SMTP_PORT || "587"; // default to STARTTLS
const smtpPort = Number(rawPort);
const smtpSecure = smtpPort === 465; // 465 -> secure true, 587 -> secure false

const hasAuthUser = Boolean(process.env.EMAIL_ADMIN);
const hasAuthPass = Boolean(process.env.EMAIL_PASS);

// Log non-sensitive SMTP config for diagnostics
console.info(
  "SMTP Config:",
  {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    authAvailable: hasAuthUser && hasAuthPass,
  }
);

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: hasAuthUser && hasAuthPass
    ? {
        user: process.env.EMAIL_ADMIN,
        pass: process.env.EMAIL_PASS,
      }
    : undefined,
  // Safe timeouts to surface ETIMEDOUT/connection issues faster
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000), // 10s
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000), // 10s
});

export const sendOtpEmail = async (email, otp) => {
  try {
    // Verify SMTP connection before attempting to send
    try {
      await transporter.verify();
      console.info("SMTP verify: connection OK");
    } catch (verifyErr) {
      console.error(
        "SMTP verify failed:",
        {
          code: verifyErr?.code,
          command: verifyErr?.command,
          message: verifyErr?.message,
        }
      );
      return {
        success: false,
        message: "Error sending OTP email.",
        error: verifyErr?.message,
      };
    }

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
    // Enhanced error logging for SMTP/network issues
    console.error(
      "Error sending OTP email:",
      {
        code: error?.code,
        command: error?.command,
        message: error?.message,
      }
    );
    return { success: false, message: "Error sending OTP email.", error: error.message };
  }
};
export default transporter;
