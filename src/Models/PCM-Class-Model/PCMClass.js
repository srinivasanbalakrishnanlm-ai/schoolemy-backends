import { Schema, model } from "mongoose";

// Main PCM Class schema for Student PCM live classes
const pcmClassSchema = new Schema(
	{
		className: {
			type: String,
			required: true,
			trim: true,
		},
		batch: {
			type: String,
			required: true,
			trim: true,
		},
		academicYear: {
			type: String,
			required: true,
			trim: true,
		},
		// Google Meet link for the class
		meetLink: {
			type: String,
			required: true,
			trim: true,
		},
		// Class schedule
		selectedSubject: {
			type: String,
			required: true,
			enum: ['physics', 'chemistry', 'mathematics'],
		},
		startTime: {
			type: Date,
			required: true,
		},
		endTime: {
			type: Date,
			required: true,
		},
		timezone: {
			type: String,
			trim: true,
			default: "Asia/Kolkata",
		},
		is_active: {
			type: Boolean,
			default: true,
		},
		// Additional fields for better management
		description: {
			type: String,
			trim: true,
		},
		instructor: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Index on className/batch for quick lookup
pcmClassSchema.index({ className: 1, batch: 1 });
pcmClassSchema.index({ selectedSubject: 1, startTime: 1 });

// Virtual to check if class is joinable (15 minutes before start time)
pcmClassSchema.virtual('isJoinable').get(function() {
	const now = new Date();
	const fifteenMinutesBefore = new Date(this.startTime.getTime() - 15 * 60 * 1000);
	const classEndTime = new Date(this.endTime);
	
	return now >= fifteenMinutesBefore && now <= classEndTime;
});

// Virtual to get time until class starts
pcmClassSchema.virtual('timeUntilStart').get(function() {
	const now = new Date();
	const diff = this.startTime.getTime() - now.getTime();
	return Math.max(0, diff);
});

// Method to check if class can be joined
pcmClassSchema.methods.canJoin = function() {
	const now = new Date();
	const fifteenMinutesBefore = new Date(this.startTime.getTime() - 15 * 60 * 1000);
	const classEndTime = new Date(this.endTime);
	
	return now >= fifteenMinutesBefore && now <= classEndTime && this.is_active;
};

const PCMClass = model("PCM", pcmClassSchema);

export default PCMClass;

/*
Example document to create/update:

{
    "className": "PCM - Grade 12",
    "batch": "Morning-1",
    "academicYear": "2025-2026",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "selectedSubject": "physics",
    "startTime": "2025-11-10T08:00:00.000Z",
    "endTime": "2025-11-10T09:00:00.000Z",
    "timezone": "Asia/Kolkata",
    "description": "Advanced Physics - Mechanics",
    "instructor": "Dr. Smith"
}
*/
