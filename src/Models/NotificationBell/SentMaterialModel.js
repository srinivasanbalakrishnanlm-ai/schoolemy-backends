// File: user-backend/src/Models/NotificationBell/SentMaterialModel.js
import mongoose from 'mongoose';

const sentMaterialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  materialName: { type: String, required: true },
  filePath: { type: String, required: true },
  courseName: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

const SentMaterial = mongoose.model('SentMaterial', sentMaterialSchema);
export default SentMaterial;