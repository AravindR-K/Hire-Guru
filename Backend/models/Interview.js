const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  evaluatorRole: { type: String, enum: ['admin', 'hr', 'pm', 'interviewer'], required: true },
  comments: { type: String, default: '' },
  recommendation: {
    type: String,
    enum: ['offer', 'on_hold', 'rejected', '2nd_round'],
    required: true
  },
  date: { type: Date, default: Date.now }
}, { _id: true });

const interviewSchema = new mongoose.Schema({
  // Candidate info
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // legacy
  assignedInterviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  assignedHRs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  assignedPMs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Interview metadata
  position: { type: String, required: true, trim: true },
  techStack: { type: String, default: '', trim: true },
  source: { type: String, default: '', trim: true },
  dateOfInterview: { type: Date, default: Date.now },
  
  // Quiz assignments (aptitude + technical)
  quizzes: [{
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    title: { type: String },
    score: { type: Number, default: null },
    totalMarks: { type: Number, default: null },
    percentage: { type: Number, default: null },
    completed: { type: Boolean, default: false },
    violation: { type: Boolean, default: false }
  }],
  
  // Coding round
  codingRound: {
    zipFile: { type: String, default: '' },
    submittedAt: { type: Date },
    validated: { type: Boolean, default: false },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Evaluations from PM, Interviewer, HR, Admin
  evaluations: [evaluationSchema],
  
  // Final decision
  finalDecision: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'on_hold', '2nd_round'],
    default: 'pending'
  },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: { type: Date },
  
  // Interview status/phase
  status: {
    type: String,
    enum: ['pending', 'quiz_phase', 'coding_phase', 'evaluation', 'completed'],
    default: 'pending'
  },
  
  // Type
  type: {
    type: String,
    enum: ['individual', 'group'],
    default: 'individual'
  },
  
  // For group interviews
  groupId: { type: String, default: '' },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Interview', interviewSchema);
