const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  resume: {
    type: String,
    default: ''
  },
  signature: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'hr', 'candidate', 'pm', 'interviewer'],
    default: 'candidate'
  },
  group: {
    type: String,
    default: 'General',
    trim: true
  },
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  level: {
    type: String,
    enum: ['Fresher', 'Intern', 'Pre final year', 'Final year', 'beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  topicsOfInterest: [{
    topic: { type: String, required: true },
    comfortLevel: { type: Number, min: 0, max: 100, required: true }
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
