// File: user-backend/src/Routes/NotificationBell/materialRoutes.js

import express from 'express';
import { getMyMaterials } from '../../Controllers/NotificationBell/MaterialController.js';

const router = express.Router();

router.get('/', getMyMaterials); 

export default router;