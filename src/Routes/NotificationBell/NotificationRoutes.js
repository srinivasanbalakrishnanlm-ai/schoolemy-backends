// File: user-folder/backend/routes/notificationRoutes.js

import express from 'express';
const router = express.Router();

import { getAllNotifications } from '../../Controllers/NotificationBell/NotificationController.js';



// Intha route-ku request varum bodhu, verifyToken velai seiyum
router.get('/',  getAllNotifications);

export default router;