import Twilio from "twilio";
import dotenv from "dotenv";
dotenv.config(); // Load .env variables

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const client = new Twilio(accountSid, authToken);

export const sendOtpSMS = async (to, otp) => {
  try {
    const message = await client.messages.create({
      from: twilioPhone,
      to,
      body: `Your OTP is: ${otp}`,
    });

    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.log("error", error);
    return { success: false, error: error.message };
  }
};
