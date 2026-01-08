// File: user-backend/src/Controllers/NotificationBell/JoinRequestController.js

import JoinRequest from '../../Models/NotificationBell/JoinRequestModel.js';

export async function submitJoinRequest(req, res) {
  try {
    const { name, courseName, mobileNumber } = req.body;
    
    // Unga middleware-la irundhu user ID-a edukurom (req.userId)
    const userId = req.userId;

    // Validation (Idhu apdiye irukkattum)
    if (!name || !courseName || !mobileNumber) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // ================================================================
    // ✅ ITHU THAAN ANTHA PUTHU, POWERFUL-AANA LOGIC ✅
    // ================================================================
    // Step 1: Intha user ippave intha course-ku register pannitaaraanu DB-la thedurom
    const existingRequest = await JoinRequest.findOne({
      userId: userId,
      courseName: courseName,
    });

    // Step 2: Oru vela avar ippave register pannirundha...
    if (existingRequest) {
      // 409 Conflict - Intha status code "already exists"-nu solradhukku sariya irukkum
      return res.status(409).json({ message: `You have already registered for "${courseName}".` });
    }
    // ================================================================
    
    // Oru vela avar register pannala-na mattum, puthusa create panrom
    await JoinRequest.create({
      name,
      courseName,
      mobileNumber,
      userId,
    });

    res.status(201).json({ message: 'Your request has been submitted successfully!' });

  } catch (error) {
    console.error('Error submitting join request:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}