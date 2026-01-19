const { body, param, query } = require('express-validator');

// User validation
exports.validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

exports.validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Room validation
exports.validateCreateRoom = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('category')
    .optional()
    .isIn(['Technology', 'Business', 'Entertainment', 'Sports', 'Education', 'Health', 'Science', 'Arts', 'Politics', 'Other'])
    .withMessage('Invalid category'),
  
  body('maxSpeakers')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Max speakers must be between 1 and 50'),
  
  body('maxListeners')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max listeners must be between 1 and 1000'),
  
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  
  body('password')
    .optional()
    .trim()
    .isLength({ min: 4 })
    .withMessage('Password must be at least 4 characters')
];

// Message validation
exports.validateMessage = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Message text is required')
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters')
];

// ID validation
exports.validateId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

// Pagination validation
exports.validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'listeners', '-listeners', 'title', '-title'])
    .withMessage('Invalid sort parameter')
];