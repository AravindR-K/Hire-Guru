  const express = require('express');
  const xlsx = require('xlsx');
  const fs = require('fs');
  const User = require('../models/User');
  const Group = require('../models/Group');
  const Quiz = require('../models/Quiz');
  const Question = require('../models/Question');
  const Submission = require('../models/Submission');
  const { protect, authorize } = require('../middleware/auth');
  const upload = require('../middleware/upload');
  const router = express.Router();

  // All admin routes require authentication + admin role
  router.use(protect, authorize('admin'));

  // ============ USER MANAGEMENT ============

  // @route   GET /api/admin/users
  // @desc    Get all candidates and HR users
  // @access  Admin
  router.get('/users', async (req, res) => {
    try {
      const { role } = req.query;
      const filter = role ? { role } : { role: { $in: ['candidate', 'hr', 'pm', 'interviewer'] } };
      const users = await User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 });

      res.json({ users });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/users/logged-in
  // @desc    Get all currently logged-in users
  // @access  Admin
  router.get('/users/logged-in', async (req, res) => {
    try {
      const users = await User.find({ role: { $in: ['candidate', 'hr'] }, isLoggedIn: true })
        .select('-password')
        .sort({ createdAt: -1 });

      res.json({ users });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   POST /api/admin/users/create-staff
  // @desc    Create a staff user (HR, PM, Interviewer)
  // @access  Admin
  router.post('/users/create-staff', async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Please provide name, email, password, and role' });
      }

      const validRoles = ['hr', 'pm', 'interviewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const user = await User.create({ name, email, password, role });

      res.status(201).json({
        message: 'Staff user created successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   DELETE /api/admin/users/:userId
  // @desc    Delete a user
  // @access  Admin
  router.delete('/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin users' });

      await Submission.deleteMany({ studentId: userId });
      await User.findByIdAndDelete(userId);

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   PUT /api/admin/users/:userId/level
  // @desc    Update a candidate's level (beginner/intermediate/advanced/expert)
  // @access  Admin, HR
  router.put('/users/:userId/level', async (req, res) => {
    try {
      const { userId } = req.params;
      const { level } = req.body;

      const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
      if (!level || !validLevels.includes(level)) {
        return res.status(400).json({ message: 'Invalid level. Must be one of: beginner, intermediate, advanced, expert' });
      }

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (user.role !== 'candidate') return res.status(400).json({ message: 'Level can only be set for candidates' });

      const previousLevel = user.level || 'beginner';
      user.level = level;
      await user.save();

      res.json({
        message: `Level changed from ${previousLevel} to ${level}`,
        user: { _id: user._id, name: user.name, level: user.level },
        previousLevel,
        newLevel: level
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  // @route   PUT /api/admin/users/:userId
  // @desc    Edit a user (specifically for HR users to edit email/password)
  // @access  Admin
  router.put('/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { email, password, name, group } = req.body;

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Ensure we don't accidentally edit an admin user here for safety
      if (user.role === 'admin') {
        return res.status(403).json({ message: 'Cannot edit admin users through this endpoint' });
      }

      if (email) user.email = email;
      if (password) user.password = password; // Will be hashed by pre-save hook
      if (name) user.name = name;
      if (group !== undefined) user.group = group;

      await user.save();

      res.json({ message: 'User updated successfully', user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   PUT /api/admin/users/:userId/group
  // @desc    Assign user to a group explicitly
  // @access  Admin
  router.put('/users/:userId/group', async (req, res) => {
    try {
      const { userId } = req.params;
      const { group } = req.body;

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      
      user.group = group || 'General';
      await user.save();

      res.json({ message: 'User assigned to group successfully', user });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/users/:userId/history
  // @desc    Get a user's test history
  // @access  Admin
  router.get('/users/:userId/history', async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const submissions = await Submission.find({ studentId: userId })
        .populate('quizId', 'title timer totalQuestions category')
        .sort({ submittedAt: -1 });

      res.json({ user, submissions });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/users/:userId/interviews
  // @desc    Get all interviews assigned to a specific user
  // @access  Admin
  router.get('/users/:userId/interviews', async (req, res) => {
    try {
      const { userId } = req.params;
      const Interview = require('../models/Interview');

      const user = await User.findById(userId).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });

      const interviews = await Interview.find({ candidateId: userId })
        .populate('interviewerId', 'name email role')
        .populate('createdBy', 'name')
        .populate('decidedBy', 'name')
        .populate('quizzes.quizId', 'title category difficulty timer totalQuestions')
        .sort({ createdAt: -1 });

      res.json({ user, interviews });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/submissions/:submissionId
  // @desc    Get detailed submission - answers, correct answers, scores
  // @access  Admin
  router.get('/submissions/:submissionId', async (req, res) => {
    try {
      const { submissionId } = req.params;

      const submission = await Submission.findById(submissionId)
        .populate('studentId', 'name email')
        .populate('quizId', 'title timer totalQuestions');

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      // Get all questions for this quiz
      const questions = await Question.find({ quizId: submission.quizId._id });

      // Build detailed result with question, student answer, correct answer
      const detailedAnswers = questions.map(q => {
        const studentAnswer = submission.answers.find(
          a => a.questionId.toString() === q._id.toString()
        );

        return {
          questionId: q._id,
          question: q.question,
          options: q.options,
          type: q.type,
          correctAnswers: q.correctAnswers,
          studentAnswers: studentAnswer ? studentAnswer.selectedAnswers : [],
          isCorrect: (studentAnswer && studentAnswer.selectedAnswers)
            ? checkAnswersMatch(studentAnswer.selectedAnswers, q.correctAnswers)
            : false
        };
      });

      res.json({
        submission: {
          id: submission._id,
          student: submission.studentId,
          quiz: submission.quizId,
          score: submission.score,
          totalMarks: submission.totalMarks,
          percentage: submission.percentage,
          timeTaken: submission.timeTaken,
          submittedAt: submission.submittedAt
        },
        detailedAnswers
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // ============ QUIZ MANAGEMENT ============

  // @route   POST /api/admin/quiz/create
  // @desc    Create quiz with Excel upload
  // @access  Admin
  router.post('/quiz/create', upload.single('questionsFile'), async (req, res) => {
    try {
      const { title, timer, category, difficulty, topic, assignToAll, assignees, assignedGroups } = req.body;

      if (!title || !timer) {
        return res.status(400).json({ message: 'Please provide quiz title and timer' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Please upload an Excel file with questions' });
      }

      // Parse Excel file
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      if (data.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Excel file is empty' });
      }

      // Parse assignees
      let parsedAssignees = [];
      if (assignees) {
        try { parsedAssignees = JSON.parse(assignees); } catch (e) { parsedAssignees = []; }
      }

      let parsedGroups = [];
      if (assignedGroups) {
        try { parsedGroups = JSON.parse(assignedGroups); } catch (e) { parsedGroups = []; }
      }

      // Create quiz
      const quiz = await Quiz.create({
        title,
        timer: parseInt(timer),
        totalQuestions: data.length,
        createdBy: req.user._id,
        category: category || 'General',
        difficulty: difficulty || 'Intermediate',
        topic: topic || '',
        assignToAll: assignToAll === 'true' || assignToAll === true,
        assignees: parsedAssignees,
        assignedGroups: parsedGroups
      });

      // Parse and create questions
      const questions = parseExcelQuestions(data, quiz._id);
      console.log("PARSED QUESTIONS:", questions);
      await Question.insertMany(questions);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.status(201).json({
        message: 'Quiz created successfully',
        quiz: {
          id: quiz._id,
          title: quiz.title,
          timer: quiz.timer,
          totalQuestions: quiz.totalQuestions,
          category: quiz.category
        }
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   POST /api/admin/quiz/generate-ai
  // @desc    Generate quiz using local Ollama LLM — AI determines title, timer, and questions from prompt
  // @access  Admin
  router.post('/quiz/generate-ai', async (req, res) => {
    try {
      const { prompt, difficulty, assignToAll, assignees, assignedGroups } = req.body;

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ message: 'Please provide a prompt describing the quiz you want.' });
      }

      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';
      const diffLevel = difficulty || 'medium';

      const aiPrompt = `Based on this request: "${prompt}"

Generate a quiz at ${diffLevel} difficulty level. You must determine:
1. A short quiz title (max 5 words)
2. A short topic label (max 3 words, e.g. "Computer Networks", "Data Structures")
3. A reasonable time limit in minutes
4. The appropriate number of questions

CRITICAL RULES:
- Each question must have exactly 4 options.
- The "correct" field MUST contain the EXACT FULL TEXT of the correct option. DO NOT write "option1" or "option2" — write the actual answer text.
- For multiple correct answers, comma-separate the full text of each correct option.
- Return ONLY a valid JSON object, no markdown fences, no explanation.

EXAMPLE (notice "correct" contains the actual answer text, NOT "option1"):
{
  "title": "JavaScript Basics",
  "topic": "JavaScript",
  "timer": 10,
  "questions": [
    {
      "question": "What does DOM stand for?",
      "option1": "Document Object Model",
      "option2": "Data Object Manager",
      "option3": "Digital Output Mode",
      "option4": "Document Oriented Markup",
      "correct": "Document Object Model"
    }
  ]
}

IMPORTANT: The "correct" value must be the EXACT TEXT of the option, not the option key. Output ONLY the JSON.`;

      console.log(`Calling Ollama at ${ollamaUrl}/api/chat with model ${ollamaModel}...`);

      const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: 'system', content: 'You are a quiz generator. Output ONLY valid JSON. The "correct" field must always contain the EXACT TEXT of the correct answer option, never "option1" or "option2".' },
            { role: 'user', content: aiPrompt }
          ],
          stream: false,
          options: { temperature: 0.7 }
        })
      });

      if (!ollamaResponse.ok) {
        const errText = await ollamaResponse.text();
        console.error('Ollama error:', errText);
        return res.status(500).json({ message: `Ollama error (${ollamaResponse.status}): Make sure Ollama is running with "${ollamaModel}" model pulled.` });
      }

      const ollamaData = await ollamaResponse.json();
      let responseText = (ollamaData.message?.content || '').trim();

      console.log('Ollama raw response length:', responseText.length);

      // Strip markdown code fences if present
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }

      // Try to extract JSON object from response
      const jsonObjMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonObjMatch) {
        responseText = jsonObjMatch[0];
      }

      let aiResult;
      try {
        aiResult = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('AI response parse error:', parseErr);
        console.error('Raw response:', responseText.substring(0, 500));
        return res.status(500).json({ message: 'Failed to parse AI response. The LLM did not return valid JSON. Please try again.' });
      }

      // Extract metadata from AI response
      const quizTitle = aiResult.title || 'AI Generated Quiz';
      const quizTopic = aiResult.topic || quizTitle;
      const quizTimer = parseInt(aiResult.timer) || 15;
      const aiQuestions = aiResult.questions;

      if (!Array.isArray(aiQuestions) || aiQuestions.length === 0) {
        return res.status(500).json({ message: 'AI returned empty or invalid questions. Please try again.' });
      }

      // Parse AI output into our question format
      const parsedQuestions = aiQuestions.map((q) => {
        const options = [
          (q.option1 || '').toString().trim(),
          (q.option2 || '').toString().trim(),
          (q.option3 || '').toString().trim(),
          (q.option4 || '').toString().trim()
        ].filter(o => o.length > 0);

        // Build a map for "option1" -> actual text fallback
        const optionKeyMap = {
          'option1': options[0] || '',
          'option2': options[1] || '',
          'option3': options[2] || '',
          'option4': options[3] || ''
        };

        const correctStr = (q.correct || '').toString().trim();
        const correctArr = correctStr.split(',').map(s => s.trim());

        // First: try to match correct values against actual option text
        let correctAnswers = options.filter(opt => correctArr.includes(opt));

        // Fallback: if LLM returned "option1", "option2" keys instead of text
        if (correctAnswers.length === 0) {
          correctAnswers = correctArr
            .map(c => optionKeyMap[c.toLowerCase()] || '')
            .filter(c => c.length > 0);
        }

        // Last resort: if still empty, try case-insensitive match
        if (correctAnswers.length === 0) {
          correctAnswers = options.filter(opt =>
            correctArr.some(c => c.toLowerCase() === opt.toLowerCase())
          );
        }

        // Absolute fallback: use first option
        if (correctAnswers.length === 0 && options.length > 0) {
          console.warn(`Warning: Could not match correct answer "${correctStr}" for question "${q.question}". Using first option as fallback.`);
          correctAnswers.push(options[0]);
        }

        return {
          question: (q.question || '').toString().trim(),
          options,
          correctAnswers,
          type: correctAnswers.length > 1 ? 'mcq' : 'single'
        };
      }).filter(q => q.question && q.options.length === 4 && q.correctAnswers.length > 0);

      if (parsedQuestions.length === 0) {
        return res.status(500).json({ message: 'Could not parse any valid questions from AI response.' });
      }

      // Log parsed questions for debugging
      console.log('Parsed questions sample:', JSON.stringify(parsedQuestions[0], null, 2));

      // Create quiz in DB
      const quiz = await Quiz.create({
        title: quizTitle,
        timer: quizTimer,
        totalQuestions: parsedQuestions.length,
        createdBy: req.user._id,
        category: quizTopic,
        difficulty: diffLevel,
        assignToAll: assignToAll === 'true' || assignToAll === true,
        assignees: assignees || [],
        assignedGroups: assignedGroups || [],
        generatedByAI: true
      });

      const questionDocs = parsedQuestions.map(q => ({
        quizId: quiz._id,
        question: q.question,
        options: q.options,
        correctAnswers: q.correctAnswers,
        type: q.type
      }));

      await Question.insertMany(questionDocs);

      res.status(201).json({
        message: 'AI Quiz generated successfully',
        quiz: {
          id: quiz._id,
          title: quiz.title,
          timer: quiz.timer,
          totalQuestions: parsedQuestions.length,
          category: quiz.category
        },
        questions: parsedQuestions
      });
    } catch (error) {
      console.error('AI generation error:', error);
      if (error.cause?.code === 'ECONNREFUSED') {
        return res.status(500).json({ message: 'Cannot connect to Ollama. Make sure Ollama is running (ollama serve).' });
      }
      res.status(500).json({ message: 'AI generation failed: ' + (error.message || 'Unknown error') });
    }
  });

  // @route   POST /api/admin/quiz/create-manual
  // @desc    Create quiz manually (for AI-generated quizzes or manual entry)
  // @access  Admin
  router.post('/quiz/create-manual', async (req, res) => {
    try {
      const { title, timer, category, difficulty, topic, assignToAll, assignees, assignedGroups, questions, generatedByAI } = req.body;

      if (!title || !timer) {
        return res.status(400).json({ message: 'Please provide quiz title and timer' });
      }

      if (!questions || questions.length === 0) {
        return res.status(400).json({ message: 'Please provide at least one question' });
      }

      // Create quiz
      const quiz = await Quiz.create({
        title,
        timer: parseInt(timer),
        totalQuestions: questions.length,
        createdBy: req.user._id,
        category: category || 'General',
        difficulty: difficulty || 'Intermediate',
        topic: topic || '',
        assignToAll: assignToAll || false,
        assignees: assignees || [],
        assignedGroups: assignedGroups || [],
        generatedByAI: generatedByAI || false
      });

      // Create questions
      const questionDocs = questions.map(q => ({
        quizId: quiz._id,
        question: q.question,
        options: q.options,
        correctAnswers: q.correctAnswers,
        type: q.correctAnswers.length > 1 ? 'mcq' : 'single'
      }));

      await Question.insertMany(questionDocs);

      res.status(201).json({
        message: 'Quiz created successfully',
        quiz: {
          id: quiz._id,
          title: quiz.title,
          timer: quiz.timer,
          totalQuestions: quiz.totalQuestions,
          category: quiz.category
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/quizzes
  // @desc    Get all quizzes with attempt count
  // @access  Admin
  router.get('/quizzes', async (req, res) => {
    try {
      const quizzes = await Quiz.find()
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      // Get attempt counts for each quiz
      const quizzesWithAttempts = await Promise.all(
        quizzes.map(async (quiz) => {
          const attemptCount = await Submission.countDocuments({ quizId: quiz._id });
          return { ...quiz.toObject(), attemptCount };
        })
      );

      res.json({ quizzes: quizzesWithAttempts });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/quiz/:quizId
  // @desc    Get quiz with its questions for editing
  // @access  Admin
  router.get('/quiz/:quizId', async (req, res) => {
    try {
      const { quizId } = req.params;
      const quiz = await Quiz.findById(quizId)
        .populate('createdBy', 'name email')
        .populate('assignees', 'name email');

      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }

      const questions = await Question.find({ quizId });
      const attemptCount = await Submission.countDocuments({ quizId });

      res.json({ quiz, questions, attemptCount });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   PUT /api/admin/quiz/:quizId
  // @desc    Edit quiz (only if no attempts have been made)
  // @access  Admin
  router.put('/quiz/:quizId', async (req, res) => {
    try {
      const { quizId } = req.params;

      // Check if any attempts exist
      const attemptCount = await Submission.countDocuments({ quizId });
      if (attemptCount > 0) {
        return res.status(403).json({
          message: 'This quiz cannot be edited because it has already been attempted by users.',
          attemptCount
        });
      }

      const { title, timer, category, difficulty, assignToAll, assignees, assignedGroups, questions } = req.body;

      // Update quiz metadata
      const updateData = {};
      if (title) updateData.title = title;
      if (timer) updateData.timer = parseInt(timer);
      if (category) updateData.category = category;
      if (difficulty) updateData.difficulty = difficulty;
      if (assignToAll !== undefined) updateData.assignToAll = assignToAll;
      if (assignees) updateData.assignees = assignees;
      if (assignedGroups) updateData.assignedGroups = assignedGroups;

      // If questions are provided, replace them
      if (questions && questions.length > 0) {
        await Question.deleteMany({ quizId });

        const questionDocs = questions.map(q => ({
          quizId,
          question: q.question,
          options: q.options,
          correctAnswers: q.correctAnswers,
          type: q.correctAnswers.length > 1 ? 'mcq' : 'single'
        }));

        await Question.insertMany(questionDocs);
        updateData.totalQuestions = questions.length;
      }

      const quiz = await Quiz.findByIdAndUpdate(quizId, updateData, { new: true });

      res.json({ message: 'Quiz updated successfully', quiz });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   PUT /api/admin/quiz/:quizId/assign
  // @desc    Assign quiz to users/groups
  // @access  Admin
  router.put('/quiz/:quizId/assign', async (req, res) => {
    try {
      const { quizId } = req.params;
      const { assignToAll, assignees, assignedGroups } = req.body;

      const quiz = await Quiz.findByIdAndUpdate(quizId, {
        assignToAll: assignToAll || false,
        assignees: assignees || [],
        assignedGroups: assignedGroups || []
      }, { new: true });

      if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

      res.json({ message: 'Quiz assignment updated', quiz });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   DELETE /api/admin/quiz/:quizId
  // @desc    Delete a quiz (only if no attempts have been made)
  // @access  Admin
  router.delete('/quiz/:quizId', async (req, res) => {
    try {
      const { quizId } = req.params;

      // Check if any attempts exist
      const attemptCount = await Submission.countDocuments({ quizId });
      if (attemptCount > 0) {
        return res.status(403).json({
          message: 'This quiz cannot be deleted because it has already been attempted by users.',
          attemptCount
        });
      }

      await Question.deleteMany({ quizId });
      await Quiz.findByIdAndDelete(quizId);

      res.json({ message: 'Quiz deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/categories
  // @desc    Get all unique quiz categories
  // @access  Admin
  router.get('/categories', async (req, res) => {
    try {
      const categories = await Quiz.distinct('category');
      res.json({ categories });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/groups
  // @desc    Get all unique user groups
  // @access  Admin
  router.get('/groups', async (req, res) => {
    try {
      const groups = await Group.find().sort({ name: 1 });
      const groupNames = groups.map(g => g.name);
      // Fetch legacy groups from users just to be safe
      const userGroups = await User.distinct('group');
      const allGroups = [...new Set([...groupNames, ...userGroups])].filter(g => g && g !== 'General');
      
      res.json({ groups: allGroups });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });



  // @route   POST /api/admin/groups
  // @desc    Create a new group
  // @access  Admin
  router.post('/groups', async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Group name is required' });
      }

      // Check if already exists
      const existing = await Group.findOne({ name: name.trim() });
      if (existing) {
        return res.status(400).json({ message: 'Group already exists' });
      }

      const group = await Group.create({ name: name.trim() });
      res.status(201).json({ message: 'Group created successfully', group: group.name });

    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   PUT /api/admin/groups/:oldName
  // @desc    Edit a group name
  // @access  Admin
  router.put('/groups/:oldName', async (req, res) => {
    try {
      const { oldName } = req.params;
      const { newName } = req.body;

      if (!newName || !newName.trim()) return res.status(400).json({ message: 'New group name is required' });

      const existing = await Group.findOne({ name: newName.trim() });
      if (existing && existing.name !== oldName) {
        return res.status(400).json({ message: 'A group with this name already exists' });
      }

      await Group.findOneAndUpdate({ name: oldName }, { name: newName.trim() });
      await User.updateMany({ group: oldName }, { group: newName.trim() });
      await Quiz.updateMany({ assignedGroups: oldName }, { $set: { "assignedGroups.$": newName.trim() } });

      res.json({ message: 'Group updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   DELETE /api/admin/groups/:name
  // @desc    Delete a group
  // @access  Admin
  router.delete('/groups/:name', async (req, res) => {
    try {
      const { name } = req.params;

      await Group.deleteOne({ name });
      await User.updateMany({ group: name }, { group: 'General' });
      await Quiz.updateMany({ assignedGroups: name }, { $pull: { assignedGroups: name } });

      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // @route   GET /api/admin/stats
  // @desc    Get dashboard statistics
  // @access  Admin
  router.get('/stats', async (req, res) => {
    try {
      const totalUsers = await User.countDocuments({ role: 'candidate' });
      const totalHR = await User.countDocuments({ role: 'hr' });
      const totalQuizzes = await Quiz.countDocuments();
      const totalSubmissions = await Submission.countDocuments();
      const onlineUsers = await User.countDocuments({ isLoggedIn: true, role: { $in: ['candidate', 'hr'] } });

      // Recent submissions
      const recentSubmissions = await Submission.find()
        .populate('studentId', 'name email')
        .populate('quizId', 'title')
        .sort({ submittedAt: -1 })
        .limit(5);

      res.json({
        stats: { totalUsers, totalHR, totalQuizzes, totalSubmissions, onlineUsers },
        recentSubmissions
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // ============ HELPER FUNCTIONS ============

  function parseExcelQuestions(data, quizId) {
    return data.map(row => {
      const question = row['Question'] || row['question'] || '';
      const option1 = row['Option1'] || row['option1'] || row['Option 1'] || '';
      const option2 = row['Option2'] || row['option2'] || row['Option 2'] || '';
      const option3 = row['Option3'] || row['option3'] || row['Option 3'] || '';
      const option4 = row['Option4'] || row['option4'] || row['Option 4'] || '';
      const correct = row['Correct'] || row['correct'] || row['Answer'] || row['answer'] || '';

      const options = [
        option1.toString().trim(),
        option2.toString().trim(),
        option3.toString().trim(),
        option4.toString().trim()
      ];

      const correctStr = correct.toString().trim();
      const correctArr = correctStr.split(',').map(s => s.trim());

      // Save exact literal text of correct answer
      const correctAnswers = options
        .filter(opt => correctArr.includes(opt));

      if (correctAnswers.length === 0) {
        throw new Error(`Correct answer "${correctStr}" not matching options`);
      }
      const type = correctAnswers.length > 1 ? 'mcq' : 'single';

      return {
        quizId,
        question: question.toString().trim(),
        options: [
          option1.toString().trim(),
          option2.toString().trim(),
          option3.toString().trim(),
          option4.toString().trim()
        ],
        correctAnswers,
        type
      };
    });
  }

  function checkAnswersMatch(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
    const a = arr1.map(x => x.toString().trim().toLowerCase()).sort().join('||');
    const b = arr2.map(x => x.toString().trim().toLowerCase()).sort().join('||');
    return a === b;
  }

// @route   GET /api/admin/quiz/:quizId/assign-candidates
// @desc    Get candidates filtered by quiz category + difficulty using per-topic comfortLevel
// @access  Admin
router.get('/quiz/:quizId/assign-candidates', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const allCandidates = await User.find({ role: 'candidate' });
    
    // Quiz parameters
    const quizDifficulty = quiz.difficulty ? quiz.difficulty.toLowerCase() : '';
    const quizCategory = quiz.category ? quiz.category.toLowerCase() : '';
    
    // Comfort level → proficiency mapping:
    // 0-25   = beginner
    // 26-50  = intermediate
    // 51-75  = advanced
    // 76-100 = expert
    function comfortToProficiency(comfort) {
      if (comfort <= 25) return 'beginner';
      if (comfort <= 50) return 'intermediate';
      if (comfort <= 75) return 'advanced';
      return 'expert';
    }
    
    // Quiz difficulty → required proficiency mapping:
    // Easy   → beginner
    // Medium → intermediate, advanced
    // Hard   → expert
    function getRequiredProficiencies(difficulty) {
      if (difficulty === 'easy') return ['beginner'];
      if (difficulty === 'medium') return ['intermediate', 'advanced'];
      if (difficulty === 'hard') return ['expert'];
      return ['beginner', 'intermediate', 'advanced', 'expert']; // no difficulty = all
    }
    
    const requiredProficiencies = getRequiredProficiencies(quizDifficulty);
    const filtered = [];
    
    for (const candidate of allCandidates) {
      // If quiz has no category, show all candidates (no topic filter)
      if (!quizCategory) {
        filtered.push({
          _id: candidate._id,
          name: candidate.name,
          email: candidate.email,
          level: candidate.level,
          topicsOfInterest: candidate.topicsOfInterest
        });
        continue;
      }
      
      // Check if candidate has a matching topic in their interests
      if (!candidate.topicsOfInterest || candidate.topicsOfInterest.length === 0) continue;
      
      const matchingTopic = candidate.topicsOfInterest.find(t => {
        const ct = t.topic.toLowerCase();
        return ct.includes(quizCategory) || quizCategory.includes(ct);
      });
      
      if (!matchingTopic) continue; // Candidate has no interest in this category
      
      // Map their comfort level for this specific topic to a proficiency
      const candidateProficiency = comfortToProficiency(matchingTopic.comfortLevel);
      
      // Check if their proficiency matches the quiz difficulty requirement
      if (!requiredProficiencies.includes(candidateProficiency)) continue;
      
      filtered.push({
        _id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        level: candidate.level,
        topicsOfInterest: candidate.topicsOfInterest,
        matchedTopic: matchingTopic.topic,
        matchedComfort: matchingTopic.comfortLevel,
        matchedProficiency: candidateProficiency
      });
    }
    
    const assignedIds = quiz.assignees ? quiz.assignees.map(id => id.toString()) : [];
    
    res.json({
      quizTitle: quiz.title,
      quizDifficulty: quiz.difficulty,
      quizCategory: quiz.category,
      assignedIds: assignedIds,
      filteredCandidates: filtered
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
module.exports = router;
