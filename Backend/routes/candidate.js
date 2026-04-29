const express = require('express');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// All candidate routes require authentication + candidate role
router.use(protect, authorize('candidate'));

// @route   GET /api/candidate/quizzes
// @desc    Get assigned and available quizzes for the candidate
// @access  Candidate
router.get('/quizzes', async (req, res) => {
  try {
    // Find quizzes assigned to this user (by direct assignment, group, or public)
    const user = await User.findById(req.user._id);

    const quizzes = await Quiz.find({
      isActive: true,
      $or: [
        { assignToAll: true },
        { assignees: req.user._id },
        { assignedGroups: user.group }
      ]
    })
      .select('title timer totalQuestions createdAt category difficulty')
      .sort({ createdAt: -1 });

    // Check which quizzes the candidate has already taken
    const submissions = await Submission.find({ studentId: req.user._id })
      .select('quizId score totalMarks percentage');

    const submissionMap = {};
    submissions.forEach(sub => {
      submissionMap[sub.quizId.toString()] = {
        taken: true,
        score: sub.score,
        totalMarks: sub.totalMarks,
        percentage: sub.percentage
      };
    });

    const quizzesWithStatus = quizzes.map(quiz => ({
      id: quiz._id,
      title: quiz.title,
      timer: quiz.timer,
      totalQuestions: quiz.totalQuestions,
      createdAt: quiz.createdAt,
      category: quiz.category,
      difficulty: quiz.difficulty,
      ...(submissionMap[quiz._id.toString()] || { taken: false })
    }));

    res.json({ quizzes: quizzesWithStatus });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/candidate/quiz/:quizId
// @desc    Get quiz questions for taking the quiz
// @access  Candidate
router.get('/quiz/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    // Check if candidate already took this quiz
    const existingSubmission = await Submission.findOne({
      studentId: req.user._id,
      quizId
    });

    if (existingSubmission) {
      return res.status(400).json({ message: 'You have already taken this quiz' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isActive) {
      return res.status(404).json({ message: 'Quiz not found or not available' });
    }

    // Check assignment - is this candidate allowed to take this quiz?
    const user = await User.findById(req.user._id);
    const isAssigned = quiz.assignToAll ||
      quiz.assignees.some(a => a.toString() === req.user._id.toString()) ||
      quiz.assignedGroups.includes(user.group);

    if (!isAssigned) {
      return res.status(403).json({ message: 'You are not assigned to this quiz' });
    }

    // Get questions without correct answers
    const questions = await Question.find({ quizId })
      .select('question options type');

    res.json({
      quiz: {
        id: quiz._id,
        title: quiz.title,
        timer: quiz.timer,
        totalQuestions: quiz.totalQuestions
      },
      questions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/candidate/quiz/:quizId/submit
// @desc    Submit quiz answers and auto-evaluate
// @access  Candidate
router.post('/quiz/:quizId/submit', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers, timeTaken } = req.body;

    // Check if candidate already submitted
    const existingSubmission = await Submission.findOne({
      studentId: req.user._id,
      quizId
    });

    if (existingSubmission) {
      return res.status(400).json({ message: 'You have already submitted this quiz' });
    }

    // Get correct answers for evaluation
    const questions = await Question.find({ quizId });
    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Auto-evaluate
    let score = 0;
    const totalMarks = questions.length;

    questions.forEach(q => {
      const studentAnswer = answers.find(
        a => a.questionId === q._id.toString()
      );

      if (studentAnswer && studentAnswer.selectedAnswers) {
        const isMatch = checkAnswersMatch(q.correctAnswers, studentAnswer.selectedAnswers);
        if (isMatch) {
          score++;
        }
      }
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

    // Create submission
    const submission = await Submission.create({
      studentId: req.user._id,
      quizId,
      answers,
      score,
      totalMarks,
      percentage,
      timeTaken: timeTaken || 0
    });

    res.status(201).json({
      message: 'Quiz submitted successfully',
      result: {
        score,
        totalMarks,
        percentage,
        timeTaken: submission.timeTaken
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/candidate/profile
// @desc    Get candidate profile with test results
// @access  Candidate
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    const submissions = await Submission.find({ studentId: req.user._id })
      .populate('quizId', 'title timer totalQuestions category')
      .sort({ submittedAt: -1 });

    res.json({ user, submissions });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/candidate/results/:submissionId
// @desc    Get detailed results for a specific quiz submission
// @access  Candidate
router.get('/results/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findOne({
      _id: submissionId,
      studentId: req.user._id
    }).populate('quizId', 'title timer totalQuestions');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Get questions with correct answers
    const questions = await Question.find({ quizId: submission.quizId._id });

    const detailedResults = questions.map(q => {
      const studentAnswer = submission.answers.find(
        a => a.questionId.toString() === q._id.toString()
      );

      return {
        question: q.question,
        options: q.options,
        type: q.type,
        correctAnswers: q.correctAnswers,
        studentAnswers: studentAnswer ? studentAnswer.selectedAnswers : [],
        isCorrect: (studentAnswer && studentAnswer.selectedAnswers)
          ? checkAnswersMatch(q.correctAnswers, studentAnswer.selectedAnswers)
          : false
      };
    });

    res.json({
      quiz: submission.quizId,
      score: submission.score,
      totalMarks: submission.totalMarks,
      percentage: submission.percentage,
      timeTaken: submission.timeTaken,
      submittedAt: submission.submittedAt,
      detailedResults
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function
function checkAnswersMatch(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
  const a = arr1.map(x => x.toString().trim().toLowerCase()).sort().join('||');
  const b = arr2.map(x => x.toString().trim().toLowerCase()).sort().join('||');
  return a === b;
}

// @route   GET /api/candidate/profile
// @desc    Get candidate profile including topics of interest
// @access  Candidate
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/candidate/profile
// @desc    Update candidate profile (topics of interest)
// @access  Candidate
router.put('/profile', async (req, res) => {
  try {
    const { topicsOfInterest } = req.body;
    
    if (topicsOfInterest && !Array.isArray(topicsOfInterest)) {
      return res.status(400).json({ message: 'Topics of interest must be an array' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (topicsOfInterest) {
      user.topicsOfInterest = topicsOfInterest;
    }
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        level: user.level,
        topicsOfInterest: user.topicsOfInterest
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
