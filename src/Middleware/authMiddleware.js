
// Middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const { JWT_SECRET } = process.env;

// List of public routes that do NOT require authentication
const PUBLIC_ROUTES = [
  "/register",
  "/verify-otp",
  "/resend-otp",
  "/create-password",
  "/login",
  "/forget-password",
  "/password-otp-verify",
  "/forget-reset-password",
  "/profile",
  "/allcourses",
  "/courses/user-view",
  "/form",
  "/courses/:id", // keep this only if route is not protected
  "/contact",
  "/events",
  "/events/:id",
  
];

const verifyToken = async (req, res, next) => {
  try {
    // Allow CORS preflight to pass without auth
    if (req.method === 'OPTIONS') return next();

    const PATH = req.path;

    // Bypass token verification for public routes
    if (PUBLIC_ROUTES.includes(PATH)) {
      return next();
    }

    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header not found or malformed" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Access token not found" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token has expired" });
    }
    return res.status(403).json({ message: "Token verification failed", error: error.message });
  }
};

export { verifyToken };