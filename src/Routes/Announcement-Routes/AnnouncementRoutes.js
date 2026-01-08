import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
    createAnnouncement,
    getActiveAnnouncements,
    getAllAnnouncements,
    getAnnouncementById,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementStatus
} from '../../Controllers/Announcement-Controller/AnnouncementController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for announcement image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../uploads/announcements');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'announcement-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Public routes
router.get('/active', getActiveAnnouncements);
router.get('/:id', getAnnouncementById);

// Admin routes (add authentication middleware as needed)
// router.use(authMiddleware); // Uncomment and add your auth middleware

router.post('/', upload.single('image'), createAnnouncement);
router.get('/', getAllAnnouncements);
router.put('/:id', upload.single('image'), updateAnnouncement);
router.delete('/:id', deleteAnnouncement);
router.patch('/:id/toggle-status', toggleAnnouncementStatus);

export default router;
