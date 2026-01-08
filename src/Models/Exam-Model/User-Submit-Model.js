import mongoose from "mongoose";

const UserAnswerSchema = new mongoose.Schema({
  question: { type: String, required: true },
  selectedAnswer: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
  marksAwarded: { type: Number, default: 0 },
});

const ExamAttemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  studentRegisterNumber: { type: String }, 
  email: { type: String },
  username: { type: String },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  CourseMotherId: { type: String, required: true },
  chapterTitle: { type: String, required: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamQuestion", required: true },
  answers: [UserAnswerSchema],
  totalMarks: { type: Number, default: 0 },
  obtainedMarks: { type: Number, default: 0 },
  attemptedAt: { type: Date, default: Date.now }
}, { timestamps: true });

//export default mongoose.model("UserExamAttempt", ExamAttemptSchema);
const UserAttempt = mongoose.model("UserExamAnswer", ExamAttemptSchema);
export default UserAttempt;