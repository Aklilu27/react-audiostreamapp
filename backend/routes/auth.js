const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const streamService = require('../services/streamService');

// Validation rules
const registerValidation = [
  check('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  check('email')
    .isEmail()
    .withMessage('Please enter a valid email'),
  check('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

const loginValidation = [
  check('email')
    .isEmail()
    .withMessage('Please enter a valid email'),
  check('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

    // Create user
    user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Create Stream.io user
    try {
      await streamService.upsertUser(user);
    } catch (streamError) {
      console.error('Stream.io user creation failed:', streamError);
      // Continue even if Stream.io fails
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    // Generate Stream.io token (optional if Stream is unavailable)
    let streamToken = null;
    try {
      if (streamService.isInitialized()) {
        streamToken = streamService.createToken(user._id);
      }
    } catch (streamError) {
      console.error('Stream.io token creation failed:', streamError);
    }

    // Update user status
    user.isOnline = true;
    await user.save();

    res.status(201).json({
      success: true,
      token,
      streamToken,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    let streamToken = null;
    try {
      if (streamService.isInitialized()) {
        streamToken = streamService.createToken(user._id);
      }
    } catch (streamError) {
      console.error('Stream.io token creation failed:', streamError);
    }

    // Update user status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Update Stream.io user status
    try {
      await streamService.upsertUser(user);
    } catch (streamError) {
      console.error('Stream.io update failed:', streamError);
    }

    res.json({
      success: true,
      token,
      streamToken,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get Stream.io token
router.get('/stream-token', async (req, res) => {
  try {
    if (!streamService.isInitialized()) {
      return res.status(503).json({
        success: false,
        message: 'Stream service is unavailable'
      });
    }

    const streamToken = streamService.createToken(req.user._id);
    
    res.json({
      success: true,
      streamToken
    });
  } catch (error) {
    console.error('Stream token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Stream token'
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    // Update user status
    if (req.user) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      await req.user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;