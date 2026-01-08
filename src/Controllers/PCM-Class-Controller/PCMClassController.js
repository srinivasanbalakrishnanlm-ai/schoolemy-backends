// import PCMClass from "../../Models/PCM-Class-Model/PCMClass.js";

// // Get PCM classes by subject (only active classes)
// export const getClassesBySubject = async (req, res) => {
// 	try {
// 		const { subject } = req.query;

// 		// Validate subject
// 		const validSubjects = ['physics', 'chemistry', 'mathematics'];
// 		if (!subject || !validSubjects.includes(subject.toLowerCase())) {
// 			return res.status(400).json({
// 				success: false,
// 				message: `Invalid subject. Must be one of: ${validSubjects.join(', ')}`
// 			});
// 		}

// 		// Find active classes for the specified subject
// 		const classes = await PCMClass.find({
// 			selectedSubject: subject.toLowerCase(),
// 			is_active: true
// 		})
// 		.sort({ startTime: 1 }) // Sort by start time (earliest first)
// 		.lean();

// 		// Add computed fields
// 		const now = new Date();
// 		const classesWithStatus = classes.map(cls => {
// 			const fifteenMinutesBefore = new Date(cls.startTime.getTime() - 15 * 60 * 1000);
// 			const classEndTime = new Date(cls.endTime);
// 			const isJoinable = now >= fifteenMinutesBefore && now <= classEndTime;
// 			const timeUntilStart = Math.max(0, cls.startTime.getTime() - now.getTime());

// 			return {
// 				...cls,
// 				isJoinable,
// 				timeUntilStart,
// 				status: now > classEndTime ? 'completed' : isJoinable ? 'live' : 'upcoming'
// 			};
// 		});

// 		return res.status(200).json({
// 			success: true,
// 			count: classesWithStatus.length,
// 			subject: subject.toLowerCase(),
// 			data: classesWithStatus
// 		});

// 	} catch (error) {
// 		console.error('Error fetching classes by subject:', error);
// 		return res.status(500).json({
// 			success: false,
// 			message: 'Failed to fetch classes',
// 			error: error.message
// 		});
// 	}
// };




// Controllers/PCM-Class-Controller/PCMClassController.js

import PCMClass from "../../Models/PCM-Class-Model/PCMClass.js";

// ✅ Get PCM classes by subject with timing-based status and join conditions
export const getClassesBySubject = async (req, res) => {
  try {
    // Accept subject from either query params or request body
    const { subject } = req.body || req.query;

    // Validate subject
    const validSubjects = ["physics", "chemistry", "mathematics"];
    if (!subject || !validSubjects.includes(subject.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid subject. Must be one of: ${validSubjects.join(", ")}`,
      });
    }

    // Fetch all active classes of this subject
    const classes = await PCMClass.find({
      selectedSubject: subject.toLowerCase(),
      is_active: true,
    })
      .sort({ startTime: 1 })
      .lean();

    const now = new Date();

    // Add computed live status and joinable flag (15 minutes before start time)
    const updatedClasses = classes.map((cls) => {
      const startTime = new Date(cls.startTime);
      const endTime = new Date(cls.endTime);
      const fifteenMinutesBefore = new Date(startTime.getTime() - 15 * 60 * 1000);

      let status = "upcoming";
      let isJoinable = false;

      // Class is joinable from 15 minutes before start until end time
      if (now >= fifteenMinutesBefore && now <= endTime) {
        status = "live";
        isJoinable = true;
      } else if (now > endTime) {
        status = "completed";
      }

      const timeUntilStart = Math.max(0, startTime - now);

      return {
        ...cls,
        status,
        isJoinable,
        timeUntilStart,
      };
    });

    return res.status(200).json({
      success: true,
      subject: subject.toLowerCase(),
      count: updatedClasses.length,
      data: updatedClasses,
    });
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch classes",
      error: error.message,
    });
  }
};
