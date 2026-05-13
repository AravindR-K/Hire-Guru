const express = require('express');
const Interview = require('../models/Interview');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// All interview routes require authentication
router.use(protect);

// ============================================================
// @route   POST /api/interview
// @desc    Create a new individual interview
// @access  Admin, HR, PM
// ============================================================
router.post('/', authorize('admin', 'hr', 'pm'), async (req, res) => {
  try {
    const { candidateId, interviewerId, assignedInterviewers, assignedHRs, assignedPMs, position, techStack, source, dateOfInterview, quizIds } = req.body;

    // Use interviewerId as fallback, or assignedInterviewers[0] as interviewerId for backward compatibility
    const mainInterviewerId = interviewerId || (assignedInterviewers && assignedInterviewers.length > 0 ? assignedInterviewers[0] : null);

    if (!candidateId || !position) {
      return res.status(400).json({ message: 'Candidate and position are required' });
    }

    // Validate candidate exists
    const candidate = await User.findById(candidateId);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    // Build quiz array if quiz IDs provided
    let quizzes = [];
    if (quizIds && quizIds.length > 0) {
      const quizDocs = await Quiz.find({ _id: { $in: quizIds } }).select('title totalQuestions');
      quizzes = quizDocs.map(q => ({
        quizId: q._id,
        title: q.title,
        score: null,
        totalMarks: q.totalQuestions,
        percentage: null,
        completed: false
      }));
    }

    const interview = await Interview.create({
      candidateId,
      interviewerId: mainInterviewerId,
      assignedInterviewers: assignedInterviewers || [],
      assignedHRs: assignedHRs || [],
      assignedPMs: assignedPMs || [],
      position,
      techStack: techStack || '',
      source: source || '',
      dateOfInterview: dateOfInterview || new Date(),
      quizzes,
      status: quizzes.length > 0 ? 'quiz_phase' : 'pending',
      type: 'individual',
      createdBy: req.user._id
    });

    const populated = await Interview.findById(interview._id)
      .populate('candidateId', 'name email phoneNumber')
      .populate('interviewerId', 'name email')
      .populate('assignedInterviewers', 'name email')
      .populate('assignedHRs', 'name email')
      .populate('assignedPMs', 'name email')
      .populate('evaluations.evaluatorId', 'name email signature')
      .populate('codingRound.validatedBy', 'name');

    res.status(201).json({ message: 'Interview created successfully', interview: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   GET /api/interview
// @desc    Get all interviews (filtered by role)
// @access  Admin, HR, PM, Interviewer
// ============================================================
router.get('/', authorize('admin', 'hr', 'pm', 'interviewer'), async (req, res) => {
  try {
    const { status, type } = req.query;
    let filter = {};

    // Evaluators only see their assigned interviews or created by them (unless Admin/HR)
    if (!['admin', 'hr'].includes(req.user.role)) {
      filter.$or = [
        { interviewerId: req.user._id },
        { assignedInterviewers: req.user._id },
        { assignedHRs: req.user._id },
        { assignedPMs: req.user._id },
        { createdBy: req.user._id }
      ];
    }

    if (status) filter.status = status;
    if (type) filter.type = type;

    const interviews = await Interview.find(filter)
      .populate('candidateId', 'name email phoneNumber resume')
      .populate('interviewerId', 'name email')
      .populate('assignedInterviewers', 'name email')
      .populate('assignedHRs', 'name email')
      .populate('assignedPMs', 'name email')
      .populate('evaluations.evaluatorId', 'name email signature')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ interviews });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   GET /api/interview/stats
// @desc    Get interview statistics
// @access  Admin, HR, PM, Interviewer
// ============================================================
router.get('/stats', authorize('admin', 'hr', 'pm', 'interviewer'), async (req, res) => {
  try {
    let filter = {};
    if (!['admin', 'hr'].includes(req.user.role)) {
      filter.$or = [
        { interviewerId: req.user._id },
        { assignedInterviewers: req.user._id },
        { assignedHRs: req.user._id },
        { assignedPMs: req.user._id },
        { createdBy: req.user._id }
      ];
    }

    const total = await Interview.countDocuments(filter);
    const pending = await Interview.countDocuments({ ...filter, status: { $ne: 'completed' } });
    const completed = await Interview.countDocuments({ ...filter, status: 'completed' });
    const accepted = await Interview.countDocuments({ ...filter, finalDecision: 'accepted' });
    const rejected = await Interview.countDocuments({ ...filter, finalDecision: 'rejected' });

    res.json({ total, pending, completed, accepted, rejected });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   GET /api/interview/interviewers
// @desc    Get list of users who can be interviewers (pm, interviewer, hr, admin)
// @access  Admin, HR, PM
// ============================================================
router.get('/interviewers', authorize('admin', 'hr', 'pm'), async (req, res) => {
  try {
    const interviewers = await User.find({
      role: { $in: ['interviewer', 'pm', 'hr', 'admin'] }
    }).select('name email role');
    res.json({ interviewers });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   GET /api/interview/candidates
// @desc    Get list of candidates for interview assignment
// @access  Admin, HR, PM
// ============================================================
router.get('/candidates', authorize('admin', 'hr', 'pm'), async (req, res) => {
  try {
    const candidates = await User.find({ role: 'candidate' })
      .select('name email phoneNumber group')
      .sort({ name: 1 });
    res.json({ candidates });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   GET /api/interview/group-members
// @desc    Get candidates belonging to a specific group
// @access  Admin, HR, PM
// ============================================================
router.get('/group-members', authorize('admin', 'hr', 'pm'), async (req, res) => {
  try {
    const { group } = req.query;
    if (!group) return res.status(400).json({ message: 'Group name is required' });
    const candidates = await User.find({ role: 'candidate', group })
      .select('name email phoneNumber group')
      .sort({ name: 1 });
    res.json({ candidates });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   POST /api/interview/group
// @desc    Create group interviews for all candidates in a group
//          quizSets: [{ quizEntries: [{ quizId }], mode: 'random'|'direct',
//                       directAssignments: { candidateId: quizId } }]
// @access  Admin, HR, PM
// ============================================================
router.post('/group', authorize('admin', 'hr', 'pm'), async (req, res) => {
  try {
    const {
      groupName, assignedInterviewers, assignedHRs, assignedPMs,
      position, techStack, source, dateOfInterview, quizSets
    } = req.body;

    if (!groupName || !position) {
      return res.status(400).json({ message: 'Group and position are required' });
    }

    const candidates = await User.find({ role: 'candidate', group: groupName }).sort({ name: 1 });
    if (candidates.length === 0) {
      return res.status(400).json({ message: 'No candidates found in this group' });
    }

    const mainInterviewerId =
      assignedInterviewers && assignedInterviewers.length > 0 ? assignedInterviewers[0] : null;

    const createdInterviews = [];

    for (const candidate of candidates) {
      let quizzes = [];

      if (quizSets && quizSets.length > 0) {
        for (const set of quizSets) {
          const validEntries = (set.quizEntries || []).filter(e => e.quizId);
          if (validEntries.length === 0) continue;

          let assignedQuizId = null;

          if (validEntries.length === 1) {
            // Only one quiz in this set — assign to everyone
            assignedQuizId = validEntries[0].quizId;
          } else if (set.mode === 'direct' && set.directAssignments) {
            assignedQuizId = set.directAssignments[candidate._id.toString()] || null;
          } else {
            // Random: pick a random quiz from the set
            const pick = validEntries[Math.floor(Math.random() * validEntries.length)];
            assignedQuizId = pick.quizId;
          }

          if (assignedQuizId) {
            const quizDoc = await Quiz.findById(assignedQuizId).select('title totalQuestions');
            if (quizDoc) {
              quizzes.push({
                quizId: quizDoc._id,
                title: quizDoc.title,
                score: null,
                totalMarks: quizDoc.totalQuestions,
                percentage: null,
                completed: false
              });
            }
          }
        }
      }

      const interview = await Interview.create({
        candidateId: candidate._id,
        interviewerId: mainInterviewerId,
        assignedInterviewers: assignedInterviewers || [],
        assignedHRs: assignedHRs || [],
        assignedPMs: assignedPMs || [],
        position,
        techStack: techStack || '',
        source: source || '',
        dateOfInterview: dateOfInterview || new Date(),
        quizzes,
        status: quizzes.length > 0 ? 'quiz_phase' : 'pending',
        type: 'group',
        groupId: groupName,
        createdBy: req.user._id
      });

      createdInterviews.push(interview._id);
    }

    res.status(201).json({
      message: `Group interview created for ${candidates.length} candidate(s)`,
      count: candidates.length,
      interviewIds: createdInterviews
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   GET /api/interview/:id
// @desc    Get interview detail
// @access  Admin, HR, PM, Interviewer
// ============================================================
router.get('/:id', authorize('admin', 'hr', 'pm', 'interviewer'), async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('candidateId', 'name email phoneNumber resume group')
      .populate('interviewerId', 'name email role')
      .populate('assignedInterviewers', 'name email')
      .populate('assignedHRs', 'name email')
      .populate('assignedPMs', 'name email')
      .populate('createdBy', 'name')
      .populate('evaluations.evaluatorId', 'name email role signature')
      .populate('codingRound.validatedBy', 'name')
      .populate('decidedBy', 'name');

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Check authorization to view
    // Note: after populate(), assigned arrays contain objects — extract ._id for comparison
    if (!['admin', 'hr'].includes(req.user.role)) {
      const userId = req.user._id.toString();
      const getId = (u) => (u && typeof u === 'object' ? (u._id || u).toString() : u.toString());

      const isAuthorized =
        (interview.interviewerId && getId(interview.interviewerId) === userId) ||
        interview.assignedInterviewers?.some(u => getId(u) === userId) ||
        interview.assignedHRs?.some(u => getId(u) === userId) ||
        interview.assignedPMs?.some(u => getId(u) === userId) ||
        (interview.createdBy && getId(interview.createdBy) === userId);

      if (!isAuthorized) {
        return res.status(403).json({ message: 'Not authorized to view this interview' });
      }
    }

    res.json({ interview });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   PUT /api/interview/:id
// @desc    Update interview details (metadata, status, quiz scores)
// @access  Admin, HR, PM
// ============================================================
router.put('/:id', authorize('admin', 'hr', 'pm'), async (req, res) => {
  try {
    const { position, techStack, source, dateOfInterview, status, quizzes, assignedInterviewers, assignedHRs, assignedPMs } = req.body;
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    if (position) interview.position = position;
    if (techStack !== undefined) interview.techStack = techStack;
    if (source !== undefined) interview.source = source;
    if (dateOfInterview) interview.dateOfInterview = dateOfInterview;
    if (status) interview.status = status;
    if (quizzes) interview.quizzes = quizzes;
    if (assignedInterviewers) interview.assignedInterviewers = assignedInterviewers;
    if (assignedHRs) interview.assignedHRs = assignedHRs;
    if (assignedPMs) interview.assignedPMs = assignedPMs;

    await interview.save();

    const populated = await Interview.findById(interview._id)
      .populate('candidateId', 'name email phoneNumber')
      .populate('interviewerId', 'name email')
      .populate('assignedInterviewers', 'name email')
      .populate('assignedHRs', 'name email')
      .populate('assignedPMs', 'name email');

    res.json({ message: 'Interview updated', interview: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   PUT /api/interview/:id/evaluate
// @desc    Add an evaluation (comments + recommendation)
// @access  Admin, HR, PM, Interviewer
// ============================================================
router.put('/:id/evaluate', authorize('admin', 'hr', 'pm', 'interviewer'), async (req, res) => {
  try {
    const { comments, recommendation } = req.body;
    if (!recommendation) {
      return res.status(400).json({ message: 'Recommendation is required' });
    }

    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    // Check if this user already evaluated — update instead of duplicate
    const existingIdx = interview.evaluations.findIndex(
      e => e.evaluatorId.toString() === req.user._id.toString()
    );

    const evaluation = {
      evaluatorId: req.user._id,
      evaluatorRole: req.user.role,
      comments: comments || '',
      recommendation,
      date: new Date()
    };

    if (existingIdx >= 0) {
      interview.evaluations[existingIdx] = { ...interview.evaluations[existingIdx].toObject(), ...evaluation };
    } else {
      interview.evaluations.push(evaluation);
    }

    // Auto-advance to evaluation phase if not already
    if (interview.status === 'coding_phase' || interview.status === 'quiz_phase') {
      interview.status = 'evaluation';
    }

    await interview.save();

    const populated = await Interview.findById(interview._id)
      .populate('candidateId', 'name email')
      .populate('interviewerId', 'name email')
      .populate('assignedInterviewers', 'name email')
      .populate('assignedHRs', 'name email')
      .populate('assignedPMs', 'name email')
      .populate('evaluations.evaluatorId', 'name email signature')
      .populate('codingRound.validatedBy', 'name');

    res.json({ message: 'Evaluation submitted', interview: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   PUT /api/interview/:id/decision
// @desc    Set final decision (accepted/rejected/on_hold/2nd_round)
// @access  Admin, HR
// ============================================================
router.put('/:id/decision', authorize('admin', 'hr'), async (req, res) => {
  try {
    const { decision } = req.body;
    if (!decision) return res.status(400).json({ message: 'Decision is required' });

    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    interview.finalDecision = decision;
    interview.decidedBy = req.user._id;
    interview.decidedAt = new Date();
    interview.status = 'completed';

    await interview.save();

    const populated = await Interview.findById(interview._id)
      .populate('candidateId', 'name email')
      .populate('decidedBy', 'name');

    res.json({ message: 'Decision recorded', interview: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   POST /api/interview/:id/coding-submission
// @desc    Upload coding round zip file
// @access  Admin, HR, PM, Interviewer
// ============================================================
router.post('/:id/coding-submission', authorize('admin', 'hr', 'pm', 'interviewer'), upload.single('codingZip'), async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Delete old file if exists
    if (interview.codingRound.zipFile) {
      const oldPath = path.join(__dirname, '..', 'uploads', path.basename(interview.codingRound.zipFile));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    interview.codingRound.zipFile = `/uploads/${req.file.filename}`;
    interview.codingRound.submittedAt = new Date();
    interview.codingRound.validated = false;

    if (interview.status === 'quiz_phase' || interview.status === 'pending') {
      interview.status = 'coding_phase';
    }

    await interview.save();
    res.json({ message: 'Coding submission uploaded', interview });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   PUT /api/interview/:id/validate-coding
// @desc    Mark coding round as validated
// @access  Admin, HR, PM, Interviewer
// ============================================================
router.put('/:id/validate-coding', authorize('admin', 'hr', 'pm', 'interviewer'), async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    interview.codingRound.validated = true;
    interview.codingRound.validatedBy = req.user._id;

    if (interview.status === 'coding_phase') {
      interview.status = 'evaluation';
    }

    await interview.save();
    res.json({ message: 'Coding round validated', interview });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================================
// @route   DELETE /api/interview/:id
// @desc    Delete an interview
// @access  Admin, HR
// ============================================================
router.delete('/:id', authorize('admin', 'hr'), async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    // Clean up coding zip if exists
    if (interview.codingRound.zipFile) {
      const filePath = path.join(__dirname, '..', 'uploads', path.basename(interview.codingRound.zipFile));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await Interview.findByIdAndDelete(req.params.id);
    res.json({ message: 'Interview deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
