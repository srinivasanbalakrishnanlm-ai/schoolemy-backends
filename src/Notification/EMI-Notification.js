// notification/EMI-Notification.js
import User from "../Models/User-Model/User-Model.js";
import Twilio from "twilio";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = new Twilio(accountSid, authToken);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_ADMIN,
    pass: process.env.EMAIL_PASS,
  },
});

const normalizePhoneNumber = (mobile) => {
  let cleaned = mobile.replace(/[^+\d]/g, "");
  if (cleaned.startsWith("+91") && cleaned.length === 13) {
    return cleaned;
  }

  if (!cleaned.startsWith("+91") && cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  console.warn(`Invalid phone number format: ${mobile}`);
  return null;
};

export const sendNotification = async (userId, type, data) => {
  const user = await User.findById(userId);
  if (!user) {
    console.error(`User not found: ${userId}`);
    return;
  }

  const emailTemplates = {
    welcome: (user, data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; background-color: #F5F5F5; color: #2D2F31; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background-color: #2D2F31; color: #FFFFFF; text-align: center; padding: 20px; }
          .content { padding: 20px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666666; background-color: #F5F5F5; }
          .button { background-color: #A435F0; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; }
          .button:hover { background-color: #8B2CD6; }
          .highlight { color: #A435F0; font-weight: bold; }
          .disclaimer { color: #FF5722; font-size: 14px; }
          ul { list-style: none; padding: 0; }
          @media (max-width: 600px) {
            .container { margin: 10px; }
            .content { padding: 15px; }
            .button { padding: 10px 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Your Learning Journey!</h1>
          </div>
          <div class="content">
            <h2 style="color: #2D2F31;">Hello, ${user.username}!</h2>
            <p>You’ve successfully enrolled in <span class="highlight">${
              data.courseName
            }</span>.</p>
            <h3 style="color: #2D2F31;">Course Details</h3>
            <ul style="color: #2D2F31;">
              <li><strong>Name:</strong> ${data.courseName}</li>
              <li><strong>Duration:</strong> ${data.courseDuration}</li>
              <li><strong>Total Amount:</strong> ₹${
                data.isEmi ? data.totalAmount : data.amountPaid
              }</li>
            </ul>
            ${
              data.isEmi
                ? `
            <h3 style="color: #2D2F31;">EMI Details</h3>
            <ul style="color: #2D2F31;">
              <li><strong>First EMI Paid:</strong> ₹${data.amountPaid}</li>
              <li><strong>Total EMIs:</strong> ${data.emiTotalMonths}</li>
              <li><strong>Monthly EMI Amount:</strong> ₹${data.emiMonthlyAmount}</li>
              <li><strong>Next Due Date:</strong> ${data.nextDueDate}</li>
            </ul>`
                : ""
            }
            <p class="disclaimer"><strong>Disclaimer:</strong> ${
              data.noRefundPolicy
            }</p>
            <p>Start learning today and unlock your potential!</p>
            <a href="${data.courseUrl}" class="button">Go to Course</a>
          </div>
          <div class="footer">
            <p>Contact us at <a href="mailto:support@example.com" style="color: #666666;">support@example.com</a> </p>
          </div>
        </div>
      </body>
      </html>
    `,
    reminder: (user, data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fa; color: #1c1d1f; line-height: 1.6; }
          .email-wrapper { background-color: #f7f9fa; padding: 40px 20px; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #ff9800 0%, #ffa726 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; margin-bottom: 8px; }
          .header p { color: #fff3e0; font-size: 16px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 22px; color: #1c1d1f; font-weight: 700; margin-bottom: 16px; }
          .intro-text { font-size: 16px; color: #2d2f31; margin-bottom: 30px; line-height: 1.5; }
          .course-name { color: #5624d0; font-weight: 700; }
          .payment-card { background: linear-gradient(135deg, #fff8e1 0%, #fffbf0 100%); border-left: 4px solid #ff9800; padding: 24px; margin: 24px 0; border-radius: 4px; }
          .payment-amount { font-size: 32px; font-weight: 700; color: #e65100; margin: 16px 0; }
          .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e4e8eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #6a6f73; min-width: 140px; font-size: 14px; }
          .detail-value { color: #1c1d1f; font-weight: 500; font-size: 14px; }
          .warning-box { background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin: 24px 0; border-radius: 4px; }
          .warning-box p { color: #e65100; font-size: 14px; line-height: 1.5; font-weight: 600; }
          .cta-section { text-align: center; margin: 32px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #ff9800 0%, #ffa726 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3); transition: all 0.3s ease; }
          .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(255, 152, 0, 0.4); }
          .footer { background-color: #1c1d1f; padding: 30px; text-align: center; }
          .footer-text { color: #9da3a7; font-size: 14px; margin-bottom: 12px; }
          .footer-link { color: #c0c4c8; text-decoration: none; }
          .footer-link:hover { color: #ffffff; }
          @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 20px 10px; }
            .content { padding: 30px 20px; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 24px; }
            .greeting { font-size: 20px; }
            .payment-amount { font-size: 28px; }
            .detail-row { flex-direction: column; }
            .detail-label { margin-bottom: 4px; }
            .cta-button { padding: 14px 32px; font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <h1>⏰ Payment Reminder</h1>
              <p>Your EMI payment is coming up</p>
            </div>
            <div class="content">
              <div class="greeting">Hi ${user.username},</div>
              <p class="intro-text">
                This is a friendly reminder that your next EMI payment for <span class="course-name">${
                  data.courseName
                }</span> is approaching.
              </p>
              
              <div class="payment-card">
                <div style="text-align: center;">
                  <div style="font-size: 14px; color: #6a6f73; margin-bottom: 8px;">Amount Due</div>
                  <div class="payment-amount">₹${data.amount}</div>
                  <div style="font-size: 14px; color: #6a6f73; margin-top: 8px;">Due on ${data.dueDate.toDateString()}</div>
                </div>
              </div>
              
              <div style="background-color: #f7f9fa; padding: 20px; border-radius: 4px; margin: 24px 0;">
                <div class="detail-row">
                  <span class="detail-label">Course</span>
                  <span class="detail-value">${data.courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount</span>
                  <span class="detail-value">₹${data.amount}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Due Date</span>
                  <span class="detail-value">${data.dueDate.toDateString()}</span>
                </div>
              </div>
              
              <div class="warning-box">
                <p>💡 Pay on time to keep your course access uninterrupted</p>
              </div>
              
              <div class="cta-section">
                <a href="${data.paymentUrl}" class="cta-button">Pay Now →</a>
              </div>
            </div>
            <div class="footer">
              <p class="footer-text">Questions? Contact us at <a href="mailto:support@schoolemy.com" class="footer-link">support@schoolemy.com</a></p>
              <p class="footer-text">© ${new Date().getFullYear()} Schoolemy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    late: (user, data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fa; color: #1c1d1f; line-height: 1.6; }
          .email-wrapper { background-color: #f7f9fa; padding: 40px 20px; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #f44336 0%, #e57373 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; margin-bottom: 8px; }
          .header p { color: #ffcdd2; font-size: 16px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 22px; color: #1c1d1f; font-weight: 700; margin-bottom: 16px; }
          .intro-text { font-size: 16px; color: #2d2f31; margin-bottom: 30px; line-height: 1.5; }
          .course-name { color: #5624d0; font-weight: 700; }
          .urgent-card { background: linear-gradient(135deg, #ffebee 0%, #fff5f5 100%); border-left: 4px solid #f44336; padding: 24px; margin: 24px 0; border-radius: 4px; }
          .urgent-amount { font-size: 32px; font-weight: 700; color: #c62828; margin: 16px 0; }
          .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e4e8eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #6a6f73; min-width: 140px; font-size: 14px; }
          .detail-value { color: #1c1d1f; font-weight: 500; font-size: 14px; }
          .alert-box { background-color: #fff3e0; border: 2px solid #f44336; padding: 20px; margin: 24px 0; border-radius: 4px; }
          .alert-box p { color: #c62828; font-size: 15px; line-height: 1.6; font-weight: 600; text-align: center; }
          .cta-section { text-align: center; margin: 32px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #f44336 0%, #e57373 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3); transition: all 0.3s ease; }
          .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(244, 67, 54, 0.4); }
          .footer { background-color: #1c1d1f; padding: 30px; text-align: center; }
          .footer-text { color: #9da3a7; font-size: 14px; margin-bottom: 12px; }
          .footer-link { color: #c0c4c8; text-decoration: none; }
          .footer-link:hover { color: #ffffff; }
          @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 20px 10px; }
            .content { padding: 30px 20px; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 24px; }
            .greeting { font-size: 20px; }
            .urgent-amount { font-size: 28px; }
            .detail-row { flex-direction: column; }
            .detail-label { margin-bottom: 4px; }
            .cta-button { padding: 14px 32px; font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <h1>🚨 Urgent: Payment Overdue</h1>
              <p>Immediate action required</p>
            </div>
            <div class="content">
              <div class="greeting">Hi ${user.username},</div>
              <p class="intro-text">
                Your EMI payment for <span class="course-name">${
                  data.courseName
                }</span> is now overdue. 
                Please make the payment immediately to avoid course access suspension.
              </p>
              
              <div class="urgent-card">
                <div style="text-align: center;">
                  <div style="font-size: 14px; color: #6a6f73; margin-bottom: 8px;">Overdue Amount</div>
                  <div class="urgent-amount">₹${data.amount}</div>
                  <div style="font-size: 14px; color: #c62828; margin-top: 8px; font-weight: 600;">⚠️ Payment Overdue</div>
                </div>
              </div>
              
              <div style="background-color: #f7f9fa; padding: 20px; border-radius: 4px; margin: 24px 0;">
                <div class="detail-row">
                  <span class="detail-label">Course</span>
                  <span class="detail-value">${data.courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount</span>
                  <span class="detail-value">₹${data.amount}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Original Due Date</span>
                  <span class="detail-value">${data.dueDate.toDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Grace Period Ends</span>
                  <span class="detail-value">${data.gracePeriodEnd.toDateString()}</span>
                </div>
              </div>
              
              <div class="alert-box">
                <p>⚠️ WARNING: Your course access will be locked if payment is not received by ${data.gracePeriodEnd.toDateString()}</p>
              </div>
              
              <div class="cta-section">
                <a href="${
                  data.paymentUrl
                }" class="cta-button">Pay Immediately →</a>
              </div>
            </div>
            <div class="footer">
              <p class="footer-text">Questions? Contact us at <a href="mailto:support@schoolemy.com" class="footer-link">support@schoolemy.com</a></p>
              <p class="footer-text">© ${new Date().getFullYear()} Schoolemy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    lock: (user, data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fa; color: #1c1d1f; line-height: 1.6; }
          .email-wrapper { background-color: #f7f9fa; padding: 40px 20px; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%); padding: 40px 30px; text-align: center; }
          .header-icon { font-size: 48px; margin-bottom: 12px; }
          .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; margin-bottom: 8px; }
          .header p { color: #ffcdd2; font-size: 16px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 22px; color: #1c1d1f; font-weight: 700; margin-bottom: 16px; }
          .intro-text { font-size: 16px; color: #2d2f31; margin-bottom: 30px; line-height: 1.5; }
          .course-name { color: #5624d0; font-weight: 700; }
          .lock-card { background: linear-gradient(135deg, #ffebee 0%, #fff 100%); border: 2px solid #d32f2f; padding: 24px; margin: 24px 0; border-radius: 4px; text-align: center; }
          .lock-icon { font-size: 64px; color: #d32f2f; margin-bottom: 16px; }
          .lock-title { font-size: 20px; font-weight: 700; color: #c62828; margin-bottom: 8px; }
          .lock-subtitle { font-size: 14px; color: #6a6f73; }
          .steps-box { background-color: #f7f9fa; padding: 24px; border-radius: 4px; margin: 24px 0; }
          .steps-title { font-size: 18px; font-weight: 700; color: #1c1d1f; margin-bottom: 16px; }
          .step { padding: 12px 0; border-bottom: 1px solid #e4e8eb; }
          .step:last-child { border-bottom: none; }
          .step-number { display: inline-block; width: 24px; height: 24px; background-color: #5624d0; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; margin-right: 12px; }
          .step-text { color: #2d2f31; font-size: 14px; }
          .cta-section { text-align: center; margin: 32px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #5624d0 0%, #7c4dff 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(86, 36, 208, 0.3); transition: all 0.3s ease; }
          .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(86, 36, 208, 0.4); }
          .support-box { background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; margin: 24px 0; border-radius: 4px; }
          .support-box p { color: #2e7d32; font-size: 14px; }
          .footer { background-color: #1c1d1f; padding: 30px; text-align: center; }
          .footer-text { color: #9da3a7; font-size: 14px; margin-bottom: 12px; }
          .footer-link { color: #c0c4c8; text-decoration: none; }
          .footer-link:hover { color: #ffffff; }
          @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 20px 10px; }
            .content { padding: 30px 20px; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 24px; }
            .greeting { font-size: 20px; }
            .lock-icon { font-size: 48px; }
            .cta-button { padding: 14px 32px; font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="header-icon">🔒</div>
              <h1>Course Access Locked</h1>
              <p>Action required to restore access</p>
            </div>
            <div class="content">
              <div class="greeting">Hi ${user.username},</div>
              <p class="intro-text">
                Your access to <span class="course-name">${
                  data.courseName
                }</span> has been temporarily locked due to outstanding EMI payments.
              </p>
              
              <div class="lock-card">
                <div class="lock-icon">🚫</div>
                <div class="lock-title">Course Access Suspended</div>
                <div class="lock-subtitle">Reason: Unpaid EMI installments</div>
              </div>
              
              <div class="steps-box">
                <div class="steps-title">How to Restore Access</div>
                <div class="step">
                  <span class="step-number">1</span>
                  <span class="step-text">Clear all outstanding EMI payments</span>
                </div>
                <div class="step">
                  <span class="step-number">2</span>
                  <span class="step-text">Payment will be verified automatically</span>
                </div>
                <div class="step">
                  <span class="step-number">3</span>
                  <span class="step-text">Course access will be restored immediately</span>
                </div>
              </div>
              
              <div class="cta-section">
                <a href="${
                  data.paymentUrl
                }" class="cta-button">Pay Overdue EMIs Now →</a>
              </div>
              
              <div class="support-box">
                <p>💬 Need help or have questions? Our support team is ready to assist you at support@schoolemy.com</p>
              </div>
            </div>
            <div class="footer">
              <p class="footer-text">Contact us at <a href="mailto:support@schoolemy.com" class="footer-link">support@schoolemy.com</a></p>
              <p class="footer-text">© ${new Date().getFullYear()} Schoolemy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    unlock: (user, data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fa; color: #1c1d1f; line-height: 1.6; }
          .email-wrapper { background-color: #f7f9fa; padding: 40px 20px; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); padding: 40px 30px; text-align: center; }
          .header-icon { font-size: 48px; margin-bottom: 12px; }
          .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; margin-bottom: 8px; }
          .header p { color: #c8e6c9; font-size: 16px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 22px; color: #1c1d1f; font-weight: 700; margin-bottom: 16px; }
          .intro-text { font-size: 16px; color: #2d2f31; margin-bottom: 30px; line-height: 1.5; }
          .course-name { color: #5624d0; font-weight: 700; }
          .success-card { background: linear-gradient(135deg, #e8f5e9 0%, #fff 100%); border-left: 4px solid #4caf50; padding: 24px; margin: 24px 0; border-radius: 4px; text-align: center; }
          .success-icon { font-size: 64px; color: #4caf50; margin-bottom: 16px; }
          .success-title { font-size: 20px; font-weight: 700; color: #2e7d32; margin-bottom: 8px; }
          .success-subtitle { font-size: 14px; color: #6a6f73; }
          .info-box { background-color: #f7f9fa; padding: 20px; border-radius: 4px; margin: 24px 0; }
          .info-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e4e8eb; align-items: center; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 600; color: #6a6f73; min-width: 140px; font-size: 14px; }
          .info-value { color: #1c1d1f; font-weight: 500; font-size: 14px; }
          .cta-section { text-align: center; margin: 32px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #5624d0 0%, #7c4dff 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(86, 36, 208, 0.3); transition: all 0.3s ease; }
          .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(86, 36, 208, 0.4); }
          .tips-box { background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 20px; margin: 24px 0; border-radius: 4px; }
          .tips-title { font-weight: 700; color: #f57c00; margin-bottom: 12px; }
          .tip { padding: 8px 0; color: #6a6f73; font-size: 14px; }
          .footer { background-color: #1c1d1f; padding: 30px; text-align: center; }
          .footer-text { color: #9da3a7; font-size: 14px; margin-bottom: 12px; }
          .footer-link { color: #c0c4c8; text-decoration: none; }
          .footer-link:hover { color: #ffffff; }
          @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 20px 10px; }
            .content { padding: 30px 20px; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 24px; }
            .greeting { font-size: 20px; }
            .success-icon { font-size: 48px; }
            .info-row { flex-direction: column; align-items: flex-start; }
            .info-label { margin-bottom: 4px; }
            .cta-button { padding: 14px 32px; font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="header-icon">🎉</div>
              <h1>Welcome Back!</h1>
              <p>Your course access has been restored</p>
            </div>
            <div class="content">
              <div class="greeting">Hi ${user.username},</div>
              <p class="intro-text">
                Great news! Your access to <span class="course-name">${
                  data.courseName
                }</span> has been fully restored. 
                Thank you for settling your outstanding payments.
              </p>
              
              <div class="success-card">
                <div class="success-icon">✅</div>
                <div class="success-title">Access Restored Successfully</div>
                <div class="success-subtitle">You can now continue your learning journey</div>
              </div>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Course</span>
                  <span class="info-value">${data.courseName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status</span>
                  <span class="info-value" style="color: #4caf50; font-weight: 700;">✓ Active</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Next EMI Due</span>
                  <span class="info-value">${data.nextDueDate.toDateString()}</span>
                </div>
              </div>
              
              <div class="cta-section">
                <a href="${
                  data.courseUrl
                }" class="cta-button">Continue Learning →</a>
              </div>
              
              <div class="tips-box">
                <div class="tips-title">💡 Tips to Stay on Track:</div>
                <div class="tip">• Set payment reminders for your next EMI</div>
                <div class="tip">• Enable auto-pay to never miss a payment</div>
                <div class="tip">• Contact support if you need payment assistance</div>
              </div>
            </div>
            <div class="footer">
              <p class="footer-text">Questions? Contact us at <a href="mailto:support@schoolemy.com" class="footer-link">support@schoolemy.com</a></p>
              <p class="footer-text">© ${new Date().getFullYear()} Schoolemy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  const smsTemplates = {
    welcome: (user, data) =>
      data.isEmi
        ? `Welcome to ${data.courseName}, ${user.username}! EMI enrolled. Duration: ${data.courseDuration}, First EMI: ₹${data.amountPaid}, Total EMIs: ${data.emiTotalMonths}, Monthly: ₹${data.emiMonthlyAmount}, Next Due: ${data.nextDueDate}. ${data.noRefundPolicy} Start: ${data.courseUrl}`
        : `Welcome to ${data.courseName}, ${user.username}! Enrolled. Duration: ${data.courseDuration}, Paid: ₹${data.amountPaid}. ${data.noRefundPolicy} Start: ${data.courseUrl}`,
    reminder: (user, data) =>
      `Reminder: EMI of ₹${data.amount} for ${
        data.courseName
      } due on ${data.dueDate.toDateString()}. Pay now: ${data.paymentUrl}`,
    late: (user, data) =>
      `Alert: EMI of ₹${data.amount} for ${
        data.courseName
      } overdue since ${data.dueDate.toDateString()}. Pay now to avoid lock: ${
        data.paymentUrl
      }`,
    lock: (user, data) =>
      `${data.courseName} access locked due to overdue EMIs. Pay all dues to unlock: ${data.paymentUrl}. Contact support@example.com`,
    unlock: (user, data) =>
      `${data.courseName} access restored, ${
        user.username
      }! Next EMI due ${data.nextDueDate.toDateString()}. Continue learning: ${
        data.courseUrl
      }`,
  };

  const whatsappTemplates = {
    welcome: (user, data) =>
      data.isEmi
        ? `🌟 *Welcome to ${data.courseName}, ${user.username}!* 🌟\nEnrolled with EMI!\n- *Duration*: ${data.courseDuration}\n- *First EMI*: ₹${data.amountPaid}\n- *Total EMIs*: ${data.emiTotalMonths}\n- *Monthly EMI*: ₹${data.emiMonthlyAmount}\n- *Next Due*: ${data.nextDueDate}\n⚠️ *${data.noRefundPolicy}*\nStart learning: ${data.courseUrl}\nHappy learning! 🚀`
        : `🌟 *Welcome to ${data.courseName}, ${user.username}!* 🌟\nEnrolled!\n- *Duration*: ${data.courseDuration}\n- *Paid*: ₹${data.amountPaid}\n⚠️ *${data.noRefundPolicy}*\nStart learning: ${data.courseUrl}\nHappy learning! 🚀`,
    reminder: (user, data) =>
      `⏰ *EMI Reminder for ${data.courseName}* ⏰\nHi ${
        user.username
      },\n- *Amount*: ₹${
        data.amount
      }\n- *Due*: ${data.dueDate.toDateString()}\nPay now to keep learning: ${
        data.paymentUrl
      }\nDon’t delay! 🚨`,
    late: (user, data) =>
      `🚨 *Overdue EMI Alert for ${data.courseName}* 🚨\nHi ${
        user.username
      },\n- *Amount*: ₹${
        data.amount
      }\n- *Due*: ${data.dueDate.toDateString()}\n- *Grace Period Ends*: ${data.gracePeriodEnd.toDateString()}\nPay now to avoid lock: ${
        data.paymentUrl
      }\nAct fast! ⏳`,
    lock: (user, data) =>
      `🔒 *${data.courseName} Access Locked* 🔒\nHi ${user.username},\nYour course is locked due to unpaid EMIs.\n*Action*: Pay all dues to unlock: ${data.paymentUrl}\nNeed help? Email support@example.com`,
    unlock: (user, data) =>
      `✅ *${data.courseName} Access Restored* ✅\nHi ${
        user.username
      },\nYour course is back!\n- *Next EMI Due*: ${data.nextDueDate.toDateString()}\nKeep learning: ${
        data.courseUrl
      }\nHappy studying! 🎉`,
  };

  const template = emailTemplates[type];
  const smsTemplate = smsTemplates[type];
  const whatsappTemplate = whatsappTemplates[type];

  if (!template || !smsTemplate || !whatsappTemplate) {
    console.error(`Invalid notification type: ${type}`);
    return;
  }

  // Send notifications based on available contact details
  if (user.email) {
    try {
      await transporter.sendMail({
        from: `"Schoolemy Support" <${process.env.EMAIL_ADMIN}>`,
        to: user.email,
        subject:
          type === "welcome"
            ? `🎉 Welcome to ${data.courseName}!`
            : type === "reminder"
            ? `⏰ Upcoming EMI Payment for ${data.courseName}`
            : type === "late"
            ? `🚨⚠️ Overdue EMI Payment for ${data.courseName}`
            : type === "lock"
            ? `🔒 Course Access Locked for ${data.courseName}`
            : `✅ Course Access Restored for ${data.courseName}`,
        html: template(user, data),
      });
      console.log(`Email sent: ${type} to ${user.email}`);
    } catch (error) {
      console.error(`Failed to send email to ${user.email}:`, error);
    }
  }

  // Send SMS if mobile is available
  if (user.mobile) {
    const normalizedMobile = normalizePhoneNumber(user.mobile);
    if (normalizedMobile) {
      try {
        const smsResponse = await client.messages.create({
          body: smsTemplate(user, data),
          from: twilioPhone,
          to: normalizedMobile,
        });
        console.log(
          `SMS sent: ${type} to ${normalizedMobile}, SID: ${smsResponse.sid}, Status: ${smsResponse.status}`
        );
        console.log(`SMS sent: ${type} to ${user.mobile}`);
      } catch (error) {
        console.error(`Failed to send SMS to ${user.mobile}:`, error);
      }

      //  Send WhatsApp MSG if available
      if (user.whatsappOptIn) {
        try {
          const whatsappResponse = await client.messages.create({
            body: whatsappTemplate(user, data),
            from: `whatsapp:${
              process.env.TWILIO_WHATSAPP_NUMBER || twilioPhone
            }`,
            to: `whatsapp:${normalizedMobile}`,
          });
          console.log(
            `WhatsApp sent: ${type} to ${user.mobile}, SID: ${whatsappResponse.sid}, Status: ${whatsappResponse.status}`
          );
        } catch (error) {
          console.error(`Failed to send WhatsApp to ${user.mobile}:`, error);
        }
      } else {
        console.log(
          `Skipping WhatsApp for ${user.mobile}: User has not opted in`
        );
      }
    } else {
      console.error(
        `Skipping SMS/WhatsApp due to invalid phone number: ${user.mobile}`
      );
    }
  }

  console.log(`Notification sent: ${type} to user ${userId}`);
};
