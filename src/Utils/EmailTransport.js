import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const rawPort = process.env.SMTP_PORT || "587";
const smtpPort = Number(rawPort);
const smtpSecure = smtpPort === 465;

const hasAuthUser = Boolean(process.env.EMAIL_ADMIN);
const hasAuthPass = Boolean(process.env.EMAIL_PASS);

// Extended timeouts (30s for connection, 30s for greeting) to handle slow/congested networks
const connectionTimeout = Number(process.env.SMTP_CONNECTION_TIMEOUT || 30000); // 30s
const greetingTimeout = Number(process.env.SMTP_GREETING_TIMEOUT || 30000); // 30s
const socketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT || 30000); // 30s

console.info("SMTP Config (Init):", {
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  authAvailable: hasAuthUser && hasAuthPass,
  connectionTimeout,
  greetingTimeout,
  socketTimeout,
});

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
  connectionTimeout,
  greetingTimeout,
  socketTimeout,
  logger: process.env.DEBUG_SMTP === "true",
  debug: process.env.DEBUG_SMTP === "true",
});

// Retry helper: attempt send up to 2 times with exponential backoff
const sendOtpEmailWithRetry = async (email, otp, attempt = 1) => {
  try {
    console.info(`[OTP-Send] Attempt ${attempt} for ${email}`);
    
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
    
    console.info(`[OTP-Send] Success on attempt ${attempt}`);
    return { success: true, message: "OTP sent to Email successfully" };
  } catch (error) {
    const isRetryable =
      error?.code === "ETIMEDOUT" ||
      error?.code === "ECONNREFUSED" ||
      error?.code === "ENOTFOUND" ||
      error?.message?.includes?.("Connection timeout") ||
      error?.message?.includes?.("socket hang up");

    const errorInfo = {
      code: error?.code,
      command: error?.command,
      message: error?.message,
      attempt,
      retryable: isRetryable,
    };

    if (isRetryable && attempt < 2) {
      console.warn(`[OTP-Send] Retryable error on attempt ${attempt}:`, errorInfo);
      const waitMs = attempt === 1 ? 2000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return sendOtpEmailWithRetry(email, otp, attempt + 1);
    }

    console.error(`[OTP-Send] Failed after ${attempt} attempt(s):`, errorInfo);
    return { success: false, message: "Error sending OTP email.", error: error?.message };
  }
};

export const sendOtpEmail = async (email, otp) => {
  try {
    try {
      console.info("[SMTP] Verifying connection...");
      await transporter.verify();
      console.info("[SMTP] Verify: connection OK");
    } catch (verifyErr) {
      const verifyErrInfo = {
        code: verifyErr?.code,
        command: verifyErr?.command,
        message: verifyErr?.message,
      };
      console.error("[SMTP] Verify failed:", verifyErrInfo);
      
      console.info("[SMTP] Attempting send despite verify failure...");
      return sendOtpEmailWithRetry(email, otp);
    }

    return sendOtpEmailWithRetry(email, otp);
  } catch (error) {
    console.error("[OTP-Send] Unexpected error:", {
      code: error?.code,
      message: error?.message,
    });
    return { success: false, message: "Error sending OTP email.", error: error?.message };
  }
};
export default transporter;