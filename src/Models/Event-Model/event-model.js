import mongoose from "mongoose";

// Sub-schema for images
const ImageSchema = new mongoose.Schema({
  data: Buffer,
  contentType: String
});

const EventSchema = new mongoose.Schema(
  {
    eventId: { type: String, unique: true },
    eventName: { type: String, required: true },
    status: { type: String, enum: ["Upcoming", "Ongoing", "Completed"], default: "Upcoming" },
    category: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    venue: {
      type: { type: String, enum: ["Offline", "Online"], required: true },
      location: { type: String }
    },
    description: { type: String, required: true },
    coverImages: [ImageSchema],
    goal: { type: String },
    organizer: { type: String },
    contactEmail: { type: String },
    registrationLink: { type: String },
    tags: [{ type: String }]
  },
  { timestamps: true }
);

// ✅ Auto-generate unique eventId (e.g., EVENT-20251112-0001)
EventSchema.pre("save", async function (next) {
  if (!this.eventId) {
    const today = new Date();
    const dateCode = today.toISOString().split("T")[0].replace(/-/g, ""); // e.g., 20251112

    const count = await mongoose.model("Event").countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999))
      }
    });

    // EVENT-20251112-0001
    this.eventId = `EVENT-${dateCode}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

const EventManageModel = mongoose.model("Event", EventSchema);
export default EventManageModel;
