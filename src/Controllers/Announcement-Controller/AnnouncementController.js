import Announcement from '../../Models/Announcement-Model/Announcement.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create new announcement
export const createAnnouncement = async (req, res) => {
    try {
        const { title, content, button_text, button_url, priority } = req.body;
        
        let image_path = '';
        if (req.file) {
            // Save relative path for database
            image_path = `/uploads/announcements/${req.file.filename}`;
        }

        const announcement = new Announcement({
            title,
            content,
            button_text: button_text || '',
            button_url: button_url || '',
            image_path,
            priority: priority || 0
        });

        await announcement.save();
        
        res.status(201).json({
            success: true,
            message: 'Announcement created successfully',
            data: announcement
        });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating announcement',
            error: error.message
        });
    }
};

// Get all active announcements
export const getActiveAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find({ isActive: true })
            .sort({ priority: -1, createdAt: -1 })
            .select('-__v');

        res.status(200).json({
            success: true,
            count: announcements.length,
            data: announcements
        });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching announcements',
            error: error.message
        });
    }
};

// Get all announcements (admin)
export const getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .sort({ priority: -1, createdAt: -1 })
            .select('-__v');

        res.status(200).json({
            success: true,
            count: announcements.length,
            data: announcements
        });
    } catch (error) {
        console.error('Error fetching all announcements:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching announcements',
            error: error.message
        });
    }
};

// Get single announcement by ID
export const getAnnouncementById = async (req, res) => {
    try {
        const { id } = req.params;
        const announcement = await Announcement.findById(id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        res.status(200).json({
            success: true,
            data: announcement
        });
    } catch (error) {
        console.error('Error fetching announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching announcement',
            error: error.message
        });
    }
};

// Update announcement
export const updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, button_text, button_url, priority, isActive } = req.body;

        const announcement = await Announcement.findById(id);
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        // Update fields
        if (title) announcement.title = title;
        if (content) announcement.content = content;
        if (button_text !== undefined) announcement.button_text = button_text;
        if (button_url !== undefined) announcement.button_url = button_url;
        if (priority !== undefined) announcement.priority = priority;
        if (isActive !== undefined) announcement.isActive = isActive;

        // Handle new image upload
        if (req.file) {
            // Delete old image if exists
            if (announcement.image_path) {
                const oldImagePath = path.join(__dirname, '../../../', announcement.image_path);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            announcement.image_path = `/uploads/announcements/${req.file.filename}`;
        }

        await announcement.save();

        res.status(200).json({
            success: true,
            message: 'Announcement updated successfully',
            data: announcement
        });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating announcement',
            error: error.message
        });
    }
};

// Delete announcement
export const deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const announcement = await Announcement.findById(id);
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        // Delete associated image if exists
        if (announcement.image_path) {
            const imagePath = path.join(__dirname, '../../../', announcement.image_path);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await Announcement.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Announcement deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting announcement',
            error: error.message
        });
    }
};

// Toggle announcement active status
export const toggleAnnouncementStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const announcement = await Announcement.findById(id);
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        announcement.isActive = !announcement.isActive;
        await announcement.save();

        res.status(200).json({
            success: true,
            message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
            data: announcement
        });
    } catch (error) {
        console.error('Error toggling announcement status:', error);
        res.status(500).json({
            success: false,
            message: 'Error toggling announcement status',
            error: error.message
        });
    }
};
