//Controlllers/Course-Controlller/Course-Controller.js
import Course from "../../Models/Course-Model/Course-model.js";
import Payment from "../../Models/Payment-Model/Payment-Model.js";
import ExamQuestion from "../../Models/Exam-Model/Exam-Question-Model.js";
import User from "../../Models/User-Model/User-Model.js";

// Enhanced helper function to check comprehensive payment/EMI status
const checkCourseAccess = async (userId, courseId) => {
  // Check for full payment
  const fullPayment = await Payment.findOne({
    userId,
    courseId,
    paymentStatus: "completed",
    paymentType: { $ne: "emi" },
  });

  if (fullPayment) {
    return { hasAccess: true, reason: "full_payment", accessType: "full" };
  }

  // Check for EMI access
  const user = await User.findOne(
    {
      _id: userId,
      "enrolledCourses.course": courseId,
    },
    { "enrolledCourses.$": 1 }
  ).populate("enrolledCourses.emiPlan");

  if (user && user.enrolledCourses[0]?.emiPlan?.status === "active") {
    const emiPlan = user.enrolledCourses[0].emiPlan;

    // Check if any EMI is past its grace period
    const today = new Date();
    const overdueEmis = emiPlan.emis.filter(
      (emi) => emi.status === "pending" && emi.gracePeriodEnd < today
    );

    if (overdueEmis.length > 0) {
      return {
        hasAccess: false,
        reason: "emi_overdue",
        accessType: "limited",
        overdueCount: overdueEmis.length,
      };
    }

    return { hasAccess: true, reason: "emi_active", accessType: "full" };
  }

  // No payment or EMI found
  return {
    hasAccess: false,
    reason: "payment_required",
    accessType: "limited",
  };
};

// Legacy helper function for backward compatibility
const checkPaymentStatus = async (userId, courseId) => {
  const payment = await Payment.findOne({
    userId,
    courseId,
    paymentStatus: "completed",
  });
  return !!payment;
};

// Helper function to safely format EMI data
const formatEmiData = (course) => {
  if (!course.emi || !course.emi.isAvailable) {
    return {
      isAvailable: false,
      emiDurationMonths: null,
      monthlyAmount: null,
      totalAmount: null,
      notes: null,
    };
  }
  return {
    isAvailable: course.emi.isAvailable,
    emiDurationMonths: course.emi.emiDurationMonths || null,
    monthlyAmount: course.emi.monthlyAmount || null,
    totalAmount: course.emi.totalAmount || null,
    notes: course.emi.notes || null,
  };
};

//course grid view for users
export const getCoursesForUserView = async (req, res) => {
  try {
    // Only select fields needed for card/grid display
    const courses = await Course.find(
      {},
      {
        CourseMotherId: 1,
        coursename: 1,
        category: 1,
        courseduration: 1,
        thumbnail: 1,
        "price.amount": 1,
        "price.finalPrice": 1,
        emi: 1,
        rating: 1,
        level: 1,
        language: 1,
        studentEnrollmentCount: 1,
        instructor: 1,
        _id: 1, // for detail route
        createdAt: 1,
      }
    ).sort({ createdAt: -1 }); // latest first if needed

    return res.status(200).json({
      success: true,
      message: "Courses fetched successfully for user view",
      data: courses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//GET API to fetch a single course by ID with payment check
// Always returns course details but with different access levels
export const getCourseDetailWithPaymentCheck = async (req, res) => {
  try {
    const userId = req.userId;
    const courseId = req.params.id;

    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check comprehensive course access
    const accessInfo = await checkCourseAccess(userId, courseId);

    // Always return course details, but vary the access level
    if (accessInfo.hasAccess && accessInfo.accessType === "full") {
      // Full access - return complete course details with GST breakdown
      const courseData = {
        ...course.toObject(),
        emi: formatEmiData(course),
        // Ensure price breakdown is included
        price: {
          amount: course.price.amount,
          currency: course.price.currency,
          discount: course.price.discount,
          finalPrice: course.price.finalPrice,
          breakdown: {
            courseValue: course.price.breakdown?.courseValue || 0,
            gst: {
              cgst: course.price.breakdown?.gst?.cgst || 0,
              sgst: course.price.breakdown?.gst?.sgst || 0,
              total: course.price.breakdown?.gst?.total || 0,
            },
            transactionFee: course.price.breakdown?.transactionFee || 0,
          },
        },
      };

      return res.status(200).json({
        success: true,
        data: courseData,
        access: "full",
        accessReason: accessInfo.reason,
      });
    } else {
      // Limited access - return basic details with GST breakdown for transparency
      const basicDetails = {
        _id: course._id,
        CourseMotherId: course.CourseMotherId,
        coursename: course.coursename,
        category: course.category,
        courseduration: course.courseduration,
        thumbnail: course.thumbnail,
        previewvedio: course.previewvedio, // Allow preview video for course details page
        price: {
          amount: course.price.amount,
          currency: course.price.currency,
          discount: course.price.discount,
          finalPrice: course.price.finalPrice,
          breakdown: {
            courseValue: course.price.breakdown?.courseValue || 0,
            gst: {
              cgst: course.price.breakdown?.gst?.cgst || 0,
              sgst: course.price.breakdown?.gst?.sgst || 0,
              total: course.price.breakdown?.gst?.total || 0,
            },
            transactionFee: course.price.breakdown?.transactionFee || 0,
          },
        },
        emi: formatEmiData(course),
        rating: course.rating,
        level: course.level,
        language: course.language,
        certificates: course.certificates,
        studentEnrollmentCount: course.studentEnrollmentCount,
        instructor: course.instructor,
        description: course.description,
        whatYoullLearn: course.whatYoullLearn,
        review: course.review,
      };

      const responseData = {
        success: true,
        data: basicDetails,
        access: "limited",
        accessReason: accessInfo.reason,
      };

      // Add additional info for specific cases
      if (
        accessInfo.reason === "emi_overdue" ||
        accessInfo.reason === "emi_locked"
      ) {
        responseData.emiInfo = {
          overdueCount: accessInfo.overdueCount || 0,
          totalOverdue: accessInfo.totalOverdue || 0,
          nextDueAmount: accessInfo.nextDueAmount || 0,
          nextDueDate: accessInfo.nextDueDate,
          message:
            accessInfo.reason === "emi_overdue"
              ? "Course access is limited due to overdue EMI payments"
              : "Course access is locked. Please contact support or make payments.",
          paymentRequired: true,
          canMakePayment: true,
        };
      } else if (accessInfo.reason === "payment_required") {
        responseData.paymentInfo = {
          message: "Payment required for full course access",
          canPurchase: true,
        };
      }

      return res.status(200).json(responseData);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//GET API to fetch course content (chapters + exams) if user has paid
export const getCourseContent = async (req, res) => {
  try {
    const userId = req.userId;
    const courseId = req.params.id;

    // Check comprehensive course access (from middleware or direct check)
    let accessInfo = req.courseAccess;
    if (!accessInfo) {
      accessInfo = await checkCourseAccess(userId, courseId);
    }

    // Always allow some level of content access for course browsing
    const allowLimitedAccess =
      accessInfo.reason === "payment_required" ||
      accessInfo.reason === "emi_overdue";

    // Get course content, name, and price details with GST breakdown
    const course = await Course.findById(courseId, {
      chapters: 1,
      coursename: 1,
      CourseMotherId: 1,
      price: 1, // Include price for GST and transaction fee details
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const chapterTitles = course.chapters.map((ch) => ch.title);
    const exams = await ExamQuestion.find({
      coursename: course.coursename,
      chapterTitle: { $in: chapterTitles },
    });

    // Map exams by chapterTitle with full question details
    const examMap = {};
    exams.forEach((exam) => {
      examMap[exam.chapterTitle] = {
        examId: exam._id,
        examinationName: exam.examinationName,
        subject: exam.subject,
        totalMarks: exam.totalMarks,
        examQuestions: exam.examQuestions.map((q) => ({
          question: q.question,
          options: q.options,
          marks: q.marks,
          // Note: Correct answer might be sensitive - consider if you want to expose this
          //correctAnswer: q.correctAnswer,
        })),
      };
    });

    // Add exam data and count stats
    let chaptersWithExamsCount = 0;
    const chaptersWithExams = course.chapters.map((chapter) => {
      const hasExam = !!examMap[chapter.title];
      if (hasExam) chaptersWithExamsCount++;

      return {
        ...chapter.toObject(),
        exam: hasExam ? examMap[chapter.title] : null,
      };
    });

    // Create metadata
    const meta = {
      totalChapters: course.chapters.length,
      chaptersWithExams: chaptersWithExamsCount,
      chaptersWithoutExams: course.chapters.length - chaptersWithExamsCount,
    };

    // Prepare price breakdown for response
    const priceDetails = {
      amount: course.price.amount,
      currency: course.price.currency,
      discount: course.price.discount,
      finalPrice: course.price.finalPrice,
      breakdown: {
        courseValue: course.price.breakdown?.courseValue || 0,
        gst: {
          cgst: course.price.breakdown?.gst?.cgst || 0,
          sgst: course.price.breakdown?.gst?.sgst || 0,
          total: course.price.breakdown?.gst?.total || 0,
        },
        transactionFee: course.price.breakdown?.transactionFee || 0,
      },
    };

    // Handle different access levels
    if (accessInfo.hasAccess && accessInfo.accessType === "full") {
      // Full access - return complete content with price breakdown
      return res.status(200).json({
        success: true,
        message: "Course content fetched successfully",
        data: chaptersWithExams,
        CourseMotherId: course.CourseMotherId,
        coursename: course.coursename,
        price: priceDetails,
        meta,
        access: "full",
        accessReason: accessInfo.reason,
      });
    } else if (allowLimitedAccess) {
      // Limited access - show structure but limit actual content
      const limitedChapters = course.chapters.map((chapter, index) => {
        const hasExam = !!examMap[chapter.title];

        // Allow first chapter or first few content items for preview
        const allowPreview = index === 0;

        return {
          _id: chapter._id,
          title: chapter.title,
          description: chapter.description,
          duration: chapter.duration,
          // Limit content based on access
          content:
            allowPreview && chapter.content ? chapter.content.slice(0, 1) : [], // Only first content item for preview, with safety check
          exam: hasExam
            ? {
                examId: examMap[chapter.title].examId,
                examinationName: examMap[chapter.title].examinationName,
                subject: examMap[chapter.title].subject,
                totalMarks: examMap[chapter.title].totalMarks,
                // Don't include actual questions for limited access
                questionsCount: examMap[chapter.title].examQuestions.length,
              }
            : null,
          isPreview: allowPreview,
          isLocked: !allowPreview,
        };
      });

      const responseData = {
        success: true,
        message: "Limited course content (payment required for full access)",
        data: limitedChapters,
        CourseMotherId: course.CourseMotherId,
        coursename: course.coursename,
        price: priceDetails,
        meta,
        access: "limited",
        accessReason: accessInfo.reason,
      };

      // Add specific info based on reason
      if (
        accessInfo.reason === "emi_overdue" ||
        accessInfo.reason === "emi_locked"
      ) {
        responseData.emiInfo = {
          overdueCount: accessInfo.overdueCount || 0,
          totalOverdue: accessInfo.totalOverdue || 0,
          nextDueAmount: accessInfo.nextDueAmount || 0,
          nextDueDate: accessInfo.nextDueDate,
          message:
            accessInfo.reason === "emi_overdue"
              ? "Course access is limited due to overdue EMI payments"
              : "Course access is locked. Please make payments to restore access.",
          paymentRequired: true,
          canMakePayment: true,
        };
      } else if (accessInfo.reason === "payment_required") {
        responseData.paymentInfo = {
          message: "Payment required for full course access",
          canPurchase: true,
        };
      }

      return res.status(200).json(responseData);
    } else {
      // No access at all - this shouldn't happen with current logic, but handle gracefully
      return res.status(403).json({
        success: false,
        message: "Access denied to course content",
        code: "ACCESS_DENIED",
        accessReason: accessInfo.reason,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get courses by category
export const getCoursesByCategory = async (req, res) => {
  try {
    // URL-லிருந்து category பெயரைப் பெறுகிறோம் (e.g., "Yoga", "Siddha Medicine")
    const { categoryName } = req.params;

    if (!categoryName) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // category ஃபீல்டை வைத்து டேட்டாபேஸில் தேடுகிறோம்
    const courses = await Course.find({ category: categoryName });

    if (!courses || courses.length === 0) {
      return res
        .status(404)
        .json({ message: `No courses found for category: ${categoryName}` });
    }

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
