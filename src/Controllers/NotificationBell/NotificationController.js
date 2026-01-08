// File: user-folder/backend/Controllers/NotificationController.js

import NotificationBell from '../../Models/NotificationBell/NotificationModel.js'; // This is the correct path// Step 1-la create panna model

// Intha function-a thaan User frontend call pannum
export async function getAllNotifications(req, res) {
  try {
    // Database-la irundhu ella notifications-ayum eduthu anuppurom
    const notifications = await NotificationBell.find({}).sort({ timestamp: -1 });

    // Request successful. Notifications-a frontend-ku anuppurom.
    res.status(200).json(notifications);

  } catch (error) {
    console.error('Error fetching notifications for user:', error);
    res.status(500).json({
      message: 'Server could not fetch notifications.',
    });
  }
}
