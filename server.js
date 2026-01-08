import express from "express";
import dotenv from "dotenv";
import connectDB from "./src/DB/db.js";
import cors from "cors";
import path from "path";
import userProfileRoutes from "./src/Routes/users-routes/user-profile-routes.js";
import mongoose from "mongoose";

import { verifyToken } from "./src/Middleware/authMiddleware.js";
import courses from "./src/Routes/Course-routes/Course-routes.js";
import userRoutes from "./src/Routes/users-routes/User-Routes.js";
import Payment from "./src/Routes/Payment-Routes/Payment-Routes.js";
import Purchasedcourse from "./src/Routes/Purchased-routes/Purchased-routs.js";

import ExamQuestion from "./src/Routes/Exan-Question-Routes.js/Exam-Question-Routes.js";
import pcmClassRoutes from './src/Routes/PCM-Class-Routes/PCMClassRoutes.js';
import announcementRoutes from './src/Routes/Announcement-Routes/AnnouncementRoutes.js';
import contactRoutes from "./src/Routes/Contact-Routes/ContactRoutes.js";

// ✅ New Imports for Notification Bell Feature
import notificationRoutes from './src/Routes/NotificationBell/NotificationRoutes.js'; 
import joinRequestRoutes from './src/Routes/NotificationBell/joinRequestRoutes.js';
import materialRoutes from './src/Routes/NotificationBell/materialRoutes.js';
import evets from "./src/Routes/Event-Routes/event.routes.js"

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8000;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure CORS headers are always present (useful when running behind API Gateway)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  // For preflight requests, respond immediately
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ======================= HEALTH CHECK ROUTE =======================
app.get("/health", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const isDbConnected = dbState === 1;

    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        service: "NodeJS API",
        message: "Database connection is down.",
        dbState: mongoose.STATES[dbState],
      });
    }

    res.status(200).json({
      status: "ok",
      service: "NodeJS API",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      dependencies: {
        database: "connected",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Health check failed.",
      error: error.message,
    });
  }
});

// ======================= QUICK TEST ROUTES =======================
// Public CORS test - useful to confirm API Gateway and Lambda are returning CORS headers
app.get('/cors-test', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  return res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// Protected test - verifies auth middleware and token propagation
app.get('/protected-test', verifyToken, (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ ok: true, userId: req.userId });
});

// ======================= CHANGES START HERE =======================

// ======================= WEBHOOK ROUTES (No auth required) =======================
app.use("/webhook", express.raw({ type: "application/json" }), Payment);

// ======================= PUBLIC ROUTES (No token required) =======================
app.use("/", userRoutes);
app.use('/api/announcements', announcementRoutes); 
app.use('/api/pcm', pcmClassRoutes);
app.use('/', contactRoutes);
app.use('/events', evets);

// ======================= APPLY SECURITY MIDDLEWARE =======================
app.use(verifyToken);

// ======================= PROTECTED ROUTES (Token is required) =======================
app.use("/", userProfileRoutes);
app.use("/", courses);
app.use("/", Payment);
app.use("/", ExamQuestion);
app.use("/", Purchasedcourse);

app.use('/api/bell-notifications', notificationRoutes);
app.use('/api/join-requests', joinRequestRoutes);
app.use('/api/my-materials', materialRoutes);

// ======================= CHANGES END HERE =======================

// Connect to database immediately for Lambda
if (isLambda) {
  console.log('Running in Lambda environment');
  // Connect to DB on module load for Lambda
  connectDB().catch(err => {
    console.error('Lambda DB connection error:', err);
  });
} else {
  // Start the server for local development
  app.listen(PORT, async () => {
    await connectDB();
    const env = process.env.NODE_ENV || "development";
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${env}`);
  });
}

// Export app for lambda deployment
export default app;