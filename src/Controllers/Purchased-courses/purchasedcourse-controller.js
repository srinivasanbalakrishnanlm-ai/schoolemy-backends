import Payment from "../../Models/Payment-Model/Payment-Model.js";

export const getPurchasedCoursesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const payments = await Payment.find({
      userId,
      paymentStatus: "completed",
    }).populate(
      "courseId",
      " CourseMotherId coursename thumbnail previewvedio price level instructor courseduration contentduration"
    );

    const purchasedCourses = payments
      .map((payment) => {
        const course = payment.courseId;
        if (course) {
          return {
            courseId: course._id,
            CourseMotherId: course.CourseMotherId,
            coursename: course.coursename,
            thumbnail: course.thumbnail,
            previewvedio: course.previewvedio,
            price: course.price,
            level: course.level,
            instructor: course.instructor,
            courseduration: course.courseduration,
            contentduration: {
              hours: course.contentduration?.hours || 0,
              minutes: course.contentduration?.minutes || 0,
            },
            formattedDuration: `${course.contentduration?.hours || 0}h ${course.contentduration?.minutes || 0}min`,
          };
        }
        return null;
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      count: purchasedCourses.length,
      data: purchasedCourses,
    });
  } catch (err) {
    console.error("Error fetching purchased courses:", err);
    res.status(500).json({ error: "Server error" });
  }
};
