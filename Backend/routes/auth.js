const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Group = require('../models/Group');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new candidate
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, group } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create user (role defaults to 'candidate')
    const userDbData = { name, email, password, role: 'candidate' };
    if (group) userDbData.group = group;
    
    const user = await User.create(userDbData);

    res.status(201).json({
      message: 'Registration successful',
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

// @route   POST /api/auth/login
// @desc    Login user (admin, hr, or candidate)
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Update login status using updateOne to bypass the pre('save') password hash hook
    await User.updateOne({ _id: user._id }, { isLoggedIn: true });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        group: user.group
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { isLoggedIn: false });
    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/signature
// @desc    Upload digital signature image
// @access  Private
router.post('/signature', protect, upload.single('signature'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    if (user.signature) {
      const oldPath = path.join(__dirname, '..', 'uploads', path.basename(user.signature));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.signature = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({ message: 'Signature uploaded successfully', signature: user.signature });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/auth/groups
// @desc    Get all groups for registration
// @access  Public
router.get('/groups', async (req, res) => {
  try {
    const groups = await Group.find().sort({ name: 1 });
    const groupNames = groups.map(g => g.name);
    // Backward compatibility: fetch from User model too
    const userGroups = await User.distinct('group');
    const allGroups = [...new Set([...groupNames, ...userGroups])].filter(g => g && g !== 'General');
    res.json({ groups: allGroups });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', protect, upload.none(), async (req, res) => {
  try {
    const { name, email, phoneNumber } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

    await user.save();

    res.json({ message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
