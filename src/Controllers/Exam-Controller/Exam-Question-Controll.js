import ExamQuestion from "../../Models/Exam-Model/Exam-Question-Model.js"

// GET - Fetch exams by coursename and chapterTitle
export const getExamQuestionsByCourseAndChapter = async (req, res) => {
  try {
    const { coursename, chapterTitle } = req.query;

    if (!coursename || !chapterTitle) {
      return res.status(400).json({
        success: false,
        message: "Both 'coursename' and 'chapterTitle' are required in query.",
      });
    }

    const exams = await ExamQuestion.find({
      coursename,
      chapterTitle,
    });

    if (!exams || exams.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No exams found for the given course and chapter.",
      });
    }

    res.status(200).json({ success: true, exams });
  } catch (error) {
 
    res.status(500).json({
      success: false,
      message: "Failed to fetch exams",
      error: error.message,
    });
  }
};
