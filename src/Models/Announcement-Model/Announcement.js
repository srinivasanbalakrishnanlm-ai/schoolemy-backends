import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    button_text: { 
        type: String, 
        default: '' 
    },
    button_url: { 
        type: String, 
        default: '' 
    },
    // Public path to the uploaded announcement image (e.g. /uploads/announcements/uuid.jpg)
    image_path: { 
        type: String, 
        default: '' 
    },
    isActive: {
        type: Boolean,
        default: true
    },
    priority: {
        type: Number,
        default: 0 // Higher number = higher priority
    }
}, 
{
    timestamps: true // This automatically adds createdAt, updatedAt
});

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;
