// File: user-backend/src/Models/NotificationBell/JoinRequestModel.js

import mongoose from 'mongoose';

const joinRequestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required.'],
  },
  courseName: {
    type: String,
    required: [true, 'Course name is required.'],
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required.'],
  },
  // Intha request-a anuppunadhu yaaru-nu track panna
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Unga User model-oda peru
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);

export default JoinRequest;