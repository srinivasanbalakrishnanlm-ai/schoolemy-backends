import crypto from 'crypto';

export const generateOtp = () => {
    const otp = crypto.randomInt(100000, 999999).toString(); 
    const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); 
    return { otp, otpExpiresAt };
};

