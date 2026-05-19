const express = require('express');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// All candidate routes require authentication + candidate role
router.use(protect, authorize('candidate'));

// @route   GET /api/candidate/interviews
// @desc    Get assigned interviews for the candidate
// @access  Candidate
router.get('/interviews', async (req, res) => {
  try {
    const Interview = require('../models/Interview');
    const interviews = await Interview.find({ candidateId: req.user._id })
      .populate('interviewerId', 'name email')
      .populate('createdBy', 'name')
      .populate('quizzes.quizId', 'title timer totalQuestions category difficulty')
      .sort({ createdAt: -1 });
    const now = new Date();

    // Filter out interviews scheduled in the future
    const activeInterviews = interviews.filter(inv => {
      if (!inv.dateOfInterview) return true; // If no date, show it

      const invDate = new Date(inv.dateOfInterview);

      // If time is provided, parse and set it on the date object
      if (inv.timeOfInterview) {
        const [hours, minutes] = inv.timeOfInterview.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          invDate.setHours(hours, minutes, 0, 0);
        }
      } else {
        // If no time is provided, we can assume it's available at the start of the day
        invDate.setHours(0, 0, 0, 0);
      }

      return now >= invDate;
    });

    res.json({ interviews: activeInterviews });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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

    // Check if part of interview
    const Interview = require('../models/Interview');
    const interview = await Interview.findOne({
      candidateId: req.user._id,
      'quizzes.quizId': quizId
    });

    const isAssigned = quiz.assignToAll ||
      quiz.assignees.some(a => a.toString() === req.user._id.toString()) ||
      quiz.assignedGroups.includes(user.group) ||
      !!interview;

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
    const { answers, timeTaken, violation } = req.body;

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
      timeTaken: timeTaken || 0,
      violation: !!violation
    });

    // Update Interview if applicable
    const Interview = require('../models/Interview');
    const updatedInterview = await Interview.findOneAndUpdate(
      { candidateId: req.user._id, 'quizzes.quizId': quizId },
      {
        $set: {
          'quizzes.$.score': score,
          'quizzes.$.totalMarks': totalMarks,
          'quizzes.$.percentage': percentage,
          'quizzes.$.completed': true,
          'quizzes.$.violation': !!violation
        }
      },
      { new: true }
    );

    if (updatedInterview) {
      const allCompleted = updatedInterview.quizzes.every(q => q.completed);
      if (allCompleted && (updatedInterview.status === 'quiz_phase' || updatedInterview.status === 'pending')) {
        updatedInterview.status = 'coding_phase';
        await updatedInterview.save();
      }
    }

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

// @route   POST /api/candidate/interview/:interviewId/coding
// @desc    Submit coding round zip file
// @access  Candidate
router.post('/interview/:interviewId/coding', upload.single('codingZip'), async (req, res) => {
  try {
    const Interview = require('../models/Interview');
    const { interviewId } = req.params;

    const interview = await Interview.findOne({ _id: interviewId, candidateId: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a ZIP file' });
    }

    interview.codingRound = {
      zipFile: `/uploads/${req.file.filename}`,
      submittedAt: Date.now(),
      validated: false
    };

    // Update status to coding phase evaluation
    if (interview.status === 'quiz_phase' || interview.status === 'pending') {
      interview.status = 'evaluation';
    } else {
      interview.status = 'evaluation'; // Since they submitted, it needs eval
    }

    await interview.save();

    res.json({ message: 'Coding round submitted successfully', interview });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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
// @desc    Update candidate profile (name, email, phone, resume, topics of interest)
// @access  Candidate
router.put('/profile', upload.single('resume'), async (req, res) => {
  try {
    const { name, email, phoneNumber, topicsOfInterest } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

    if (topicsOfInterest) {
      try {
        // If sent as FormData, it will be a JSON string
        const parsedTopics = typeof topicsOfInterest === 'string' ? JSON.parse(topicsOfInterest) : topicsOfInterest;
        if (Array.isArray(parsedTopics)) {
          user.topicsOfInterest = parsedTopics;
        }
      } catch (e) {
        return res.status(400).json({ message: 'Invalid format for topics of interest' });
      }
    }

    // Handle resume upload
    if (req.file) {
      // If there's an old resume, delete it from the file system
      if (user.resume) {
        const oldResumePath = path.join(__dirname, '..', 'uploads', path.basename(user.resume));
        if (fs.existsSync(oldResumePath)) {
          fs.unlinkSync(oldResumePath);
        }
      }
      user.resume = `/uploads/${req.file.filename}`;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        resume: user.resume,
        level: user.level,
        topicsOfInterest: user.topicsOfInterest
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/candidate/profile/resume
// @desc    Delete candidate resume
// @access  Candidate
router.delete('/profile/resume', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.resume) {
      const resumePath = path.join(__dirname, '..', 'uploads', path.basename(user.resume));
      if (fs.existsSync(resumePath)) {
        fs.unlinkSync(resumePath);
      }
      user.resume = '';
      await user.save();
    }

    res.json({
      message: 'Resume deleted successfully', user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        resume: user.resume,
        level: user.level,
        topicsOfInterest: user.topicsOfInterest
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
