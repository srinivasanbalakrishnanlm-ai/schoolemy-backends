import Event from "../../Models/Event-Model/event-model.js";

// ------------------------
// Create Event
// ------------------------
export const createEvent = async (req, res) => {
  try {
    const body = req.body;

    // Convert uploaded images to buffer objects
    const coverImages = (req.files || []).map(file => ({
      data: file.buffer,
      contentType: file.mimetype,
    }));

    const newEvent = await Event.create({
      ...body,
      coverImages,
    });

    return res.status(201).json({
      status: true,
      message: "Event created successfully",
      data: newEvent,
    });
  } catch (error) {
    console.log("Create Event Error:", error);
    return res.status(500).json({ status: false, error: error.message });
  }
};

// ------------------------
// Get All Events with pagination & filters
// ------------------------
export const getAllEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, status, search } = req.query;

    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    if (search) query.eventName = { $regex: search, $options: "i" };

    const events = await Event.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Event.countDocuments(query);

    // Convert coverImages to base64 for each event
    const eventsData = events.map(event => {
      const eventObj = event.toObject();
      eventObj.coverImages = event.coverImages.map(img => ({
        ...img,
        data: img.data.toString('base64')
      }));
      return eventObj;
    });

    return res.status(200).json({
      status: true,
      data: eventsData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get Events Error:", error);
    return res.status(500).json({ status: false, error: error.message });
  }
};

// ------------------------
// Get Single Event by ID
// ------------------------
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });

    // Convert coverImages to base64 for frontend display
    const eventData = event.toObject();
    eventData.coverImages = event.coverImages.map(img => ({
      ...img,
      data: img.data.toString('base64')
    }));

    return res.status(200).json({ status: true, data: eventData });
  } catch (error) {
    console.log("Get Event Error:", error);
    return res.status(500).json({ status: false, error: error.message });
  }
};

// ------------------------
// Update Event
// ------------------------
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const coverImages = (req.files || []).map(file => ({
      data: file.buffer,
      contentType: file.mimetype,
    }));

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { ...req.body, ...(coverImages.length > 0 && { coverImages }) },
      { new: true }
    );

    if (!updatedEvent)
      return res.status(404).json({ status: false, message: "Event not found" });

    return res.status(200).json({
      status: true,
      message: "Event updated successfully",
      data: updatedEvent,
    });
  } catch (error) {
    console.log("Update Event Error:", error);
    return res.status(500).json({ status: false, error: error.message });
  }
};

// ------------------------
// Delete Event
// ------------------------
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedEvent = await Event.findByIdAndDelete(id);
    if (!deletedEvent)
      return res.status(404).json({ status: false, message: "Event not found" });

    return res.status(200).json({
      status: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.log("Delete Event Error:", error);
    return res.status(500).json({ status: false, error: error.message });
  }
};
