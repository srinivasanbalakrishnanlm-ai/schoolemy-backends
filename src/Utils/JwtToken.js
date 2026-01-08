import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET
export const JwtToken = (user) => {
    return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '5d' });
};