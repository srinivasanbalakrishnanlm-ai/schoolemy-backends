import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Support both MONGO_URL and MONGODB_URI environment variables
const MONGO_URI = process.env.MONGO_URL || process.env.MONGODB_URI;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const connectDB = async () => {
  try {
    // Skip if already connected (for Lambda reuse)
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    if (!MONGO_URI) {
      const errorMsg = 'MongoDB URI not found in environment variables (MONGO_URL or MONGODB_URI)';
      console.error(errorMsg);
      if (!isLambda) {
        process.exit(1);
      }
      throw new Error(errorMsg);
    }

    const options = { 
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000,
      maxPoolSize: isLambda ? 1 : 10, // Use smaller pool for Lambda
    };
    
    await mongoose.connect(MONGO_URI, options);
    console.log('MongoDB Connected successfully');
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    if (!isLambda) {
      process.exit(1); // Only exit in non-Lambda environments
    }
    throw error; // Re-throw for Lambda to handle
  }
};

export default connectDB;