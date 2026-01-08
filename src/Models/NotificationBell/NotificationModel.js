// File: user-folder/backend/Models/NotificationModel.js

import mongoose from 'mongoose';

const notificationBellSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  joinLink: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Miga mukkiyam: Inga 'NotificationBell' endra peru, Admin backend-la
// use panna adhe pera irukkanum. Appo thaan ore collection-a access pannum.
const NotificationBell = mongoose.model('NotificationBell', notificationBellSchema);

export default NotificationBell;