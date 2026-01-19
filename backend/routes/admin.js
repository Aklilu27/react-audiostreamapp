const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const streamService = require('../services/streamService');

// Admin middleware
const adminMiddleware = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Apply admin middleware to all routes
router.use(adminMiddleware);

// Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Get counts
    const totalUsers = await User.countDocuments();
    const totalRooms = await Room.countDocuments();
    const activeRooms = await Room.countDocuments({ isActive: true });
    const totalMessages = await Message.countDocuments();
    
    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('username email role createdAt isOnline');
    
    // Get recent rooms
    const recentRooms = await Room.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title hostUsername category isActive speakers listeners createdAt');
    
    // Get platform stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: today }
    });
    
    const newRoomsToday = await Room.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Get user growth (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalRooms,
        activeRooms,
        totalMessages,
        newUsersToday,
        newRoomsToday
      },
      recentUsers,
      recentRooms,
      userGrowth
    });
    
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all users with pagination and filters
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      sort = '-createdAt'
    } = req.query;
    
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Role filter
    if (role && role !== 'all') {
      query.role = role;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password')
      .lean();
    
    const total = await User.countDocuments(query);
    
    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const roomsCreated = await Room.countDocuments({ host: user._id });
        const roomsJoined = user.stats?.roomsJoined || 0;
        
        return {
          ...user,
          roomsCreated,
          roomsJoined
        };
      })
    );
    
    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user's rooms
    const roomsCreated = await Room.find({ host: user._id })
      .select('title category isActive speakers listeners createdAt')
      .lean();
    
    // Get rooms user has joined
    const roomsJoined = await Room.find({
      $or: [
        { 'speakers.user': user._id },
        { 'listeners.user': user._id }
      ],
      host: { $ne: user._id }
    })
      .select('title hostUsername category createdAt')
      .limit(10)
      .lean();
    
    // Get user's recent messages
    const recentMessages = await Message.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('room', 'title')
      .lean();
    
    res.json({
      success: true,
      user: {
        ...user,
        roomsCreated,
        roomsJoined,
        recentMessages
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user role
router.put('/users/:id/role', [
  check('role').isIn(['user', 'moderator', 'admin']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { role } = req.body;
    const userId = req.params.id;
    
    // Cannot change own role
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update role
    user.role = role;
    await user.save();
    
    // Update Stream.io user
    try {
      await streamService.upsertUser(user);
    } catch (streamError) {
      console.error('Stream.io update error:', streamError);
    }
    
    // Create notification
    const notification = new Notification({
      user: userId,
      type: 'system',
      title: 'Role Updated',
      message: `Your role has been changed to ${role} by admin`,
      data: {
        oldRole: user.role,
        newRole: role,
        updatedBy: req.user.username
      }
    });
    
    await notification.save();
    
    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: user.getPublicProfile()
    });
    
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Ban/Unban user
router.post('/users/:id/ban', [
  check('reason').optional().isString(),
  check('duration').optional().isInt({ min: 1, max: 365 }) // days
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { reason = 'Violation of terms', duration = 7 } = req.body;
    const userId = req.params.id;
    
    // Cannot ban self
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot ban yourself'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if already banned
    const isBanned = user.settings?.isBanned || false;
    
    // Toggle ban status
    user.settings = {
      ...user.settings,
      isBanned: !isBanned,
      banReason: !isBanned ? reason : null,
      banExpiresAt: !isBanned ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null,
      bannedBy: !isBanned ? req.user._id : null,
      bannedAt: !isBanned ? new Date() : null
    };
    
    await user.save();
    
    // Ban from Stream.io
    try {
      if (!isBanned) {
        await streamService.banUser(userId, reason);
      } else {
        // Unban from Stream.io
        // Note: Stream.io doesn't have unban in SDK, you'd need to use their API
      }
    } catch (streamError) {
      console.error('Stream.io ban error:', streamError);
    }
    
    // Create notification
    const notification = new Notification({
      user: userId,
      type: 'system',
      title: !isBanned ? 'Account Banned' : 'Account Unbanned',
      message: !isBanned 
        ? `Your account has been banned for ${duration} days. Reason: ${reason}`
        : 'Your account has been unbanned',
      data: {
        action: !isBanned ? 'banned' : 'unbanned',
        reason: !isBanned ? reason : null,
        duration: !isBanned ? duration : null,
        bannedBy: !isBanned ? req.user.username : null
      }
    });
    
    await notification.save();
    
    res.json({
      success: true,
      message: !isBanned ? `User banned for ${duration} days` : 'User unbanned',
      user: {
        id: user._id,
        username: user.username,
        isBanned: !isBanned,
        banReason: !isBanned ? reason : null,
        banExpiresAt: !isBanned ? user.settings.banExpiresAt : null
      }
    });
    
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete user account
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Cannot delete self
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user's rooms to delete
    const userRooms = await Room.find({ host: userId });
    
    // Delete user's rooms and their Stream.io channels
    for (const room of userRooms) {
      try {
        await streamService.deleteChannel(room._id);
      } catch (streamError) {
        console.error('Stream.io delete channel error:', streamError);
      }
      await room.deleteOne();
    }
    
    // Remove user from other rooms
    await Room.updateMany(
      {
        $or: [
          { 'speakers.user': userId },
          { 'listeners.user': userId }
        ]
      },
      {
        $pull: {
          speakers: { user: userId },
          listeners: { user: userId },
          raisedHands: { user: userId }
        }
      }
    );
    
    // Delete user's messages
    await Message.deleteMany({ user: userId });
    
    // Delete user's notifications
    await Notification.deleteMany({ user: userId });
    
    // Remove user from followers/following lists
    await User.updateMany(
      { $or: [{ followers: userId }, { following: userId }] },
      {
        $pull: {
          followers: userId,
          following: userId
        }
      }
    );
    
    // Delete user account
    await user.deleteOne();
    
    res.json({
      success: true,
      message: 'User account deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all rooms with filters
router.get('/rooms', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      status = 'all',
      sort = '-createdAt'
    } = req.query;
    
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { hostUsername: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'ended') {
      query.isActive = false;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const rooms = await Room.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('host', 'username avatar')
      .lean();
    
    const total = await Room.countDocuments(query);
    
    res.json({
      success: true,
      rooms,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get room details
router.get('/rooms/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('host', 'username email avatar role')
      .populate('speakers.user', 'username avatar role')
      .populate('listeners.user', 'username avatar role')
      .populate('raisedHands.user', 'username avatar')
      .lean();
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Get room messages
    const messages = await Message.find({ room: room._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('user', 'username avatar')
      .lean();
    
    res.json({
      success: true,
      room: {
        ...room,
        messages: messages.reverse()
      }
    });
    
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete room
router.delete('/rooms/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Delete Stream.io channel
    try {
      await streamService.deleteChannel(room._id);
    } catch (streamError) {
      console.error('Stream.io delete channel error:', streamError);
    }
    
    // Delete room messages
    await Message.deleteMany({ room: room._id });
    
    // Delete room
    await room.deleteOne();
    
    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Ban user from specific room
router.post('/rooms/:roomId/ban/:userId', [
  check('reason').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { roomId, userId } = req.params;
    const { reason = 'Violation of room rules' } = req.body;
    
    const room = await Room.findById(roomId);
    const user = await User.findById(userId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add to banned users list in room
    if (!room.bannedUsers) {
      room.bannedUsers = [];
    }
    
    const isAlreadyBanned = room.bannedUsers.some(banned => banned.user.toString() === userId);
    
    if (!isAlreadyBanned) {
      room.bannedUsers.push({
        user: userId,
        username: user.username,
        bannedAt: new Date(),
        reason,
        bannedBy: req.user._id
      });
      
      // Remove from speakers and listeners
      room.speakers = room.speakers.filter(s => s.user.toString() !== userId);
      room.listeners = room.listeners.filter(l => l.user.toString() !== userId);
      room.raisedHands = room.raisedHands.filter(h => h.user.toString() !== userId);
      
      await room.save();
      
      // Ban from Stream.io channel
      try {
        await streamService.banUser(roomId, userId, reason);
      } catch (streamError) {
        console.error('Stream.io ban error:', streamError);
      }
      
      // Create notification for user
      const notification = new Notification({
        user: userId,
        type: 'system',
        title: 'Banned from Room',
        message: `You have been banned from room "${room.title}". Reason: ${reason}`,
        data: {
          roomId: room._id,
          roomTitle: room.title,
          reason,
          bannedBy: req.user.username
        }
      });
      
      await notification.save();
    }
    
    res.json({
      success: true,
      message: `User banned from room "${room.title}"`,
      room: {
        id: room._id,
        title: room.title,
        bannedUsers: room.bannedUsers
      }
    });
    
  } catch (error) {
    console.error('Ban from room error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get system logs/activity
router.get('/activity', async (req, res) => {
  try {
    const { 
      type = 'all',
      page = 1,
      limit = 50,
      startDate,
      endDate 
    } = req.query;
    
    const query = {};
    
    // Type filter
    if (type && type !== 'all') {
      query.type = type;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get notifications (as activity logs)
    const activities = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username avatar')
      .lean();
    
    const total = await Notification.countDocuments(query);
    
    // Get user registrations
    const userRegistrations = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      },
      {
        $limit: 30
      }
    ]);
    
    // Get room creations
    const roomCreations = await Room.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      },
      {
        $limit: 30
      }
    ]);
    
    res.json({
      success: true,
      activities,
      stats: {
        userRegistrations,
        roomCreations
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    // Get system statistics
    const totalUsers = await User.countDocuments();
    const totalRooms = await Room.countDocuments();
    const activeRooms = await Room.countDocuments({ isActive: true });
    const totalMessages = await Message.countDocuments();
    
    // Get online users
    const onlineUsers = await User.countDocuments({ isOnline: true });
    
    // Get Stream.io status
    const streamStatus = streamService.isInitialized() ? 'connected' : 'disconnected';
    
    // Get database status
    const dbStatus = 'connected'; // You can check MongoDB connection status
    
    res.json({
      success: true,
      settings: {
        system: {
          totalUsers,
          totalRooms,
          activeRooms,
          totalMessages,
          onlineUsers,
          streamStatus,
          dbStatus,
          environment: process.env.NODE_ENV,
          uptime: process.uptime()
        },
        limits: {
          maxSpeakers: process.env.MAX_SPEAKERS || 20,
          maxListeners: process.env.MAX_LISTENERS || 100,
          maxFileSize: process.env.MAX_FILE_SIZE || 5242880
        }
      }
    });
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update system settings
router.put('/settings', [
  check('maxSpeakers').optional().isInt({ min: 1, max: 100 }),
  check('maxListeners').optional().isInt({ min: 1, max: 1000 }),
  check('requireEmailVerification').optional().isBoolean(),
  check('allowUserRegistration').optional().isBoolean(),
  check('maintenanceMode').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      maxSpeakers,
      maxListeners,
      requireEmailVerification,
      allowUserRegistration,
      maintenanceMode
    } = req.body;
    
    // In a real application, you would save these to a database
    // For now, we'll just return them
    
    const updatedSettings = {
      maxSpeakers: maxSpeakers || process.env.MAX_SPEAKERS || 20,
      maxListeners: maxListeners || process.env.MAX_LISTENERS || 100,
      requireEmailVerification: requireEmailVerification || false,
      allowUserRegistration: allowUserRegistration !== false,
      maintenanceMode: maintenanceMode || false,
      updatedAt: new Date(),
      updatedBy: req.user._id
    };
    
    // Save to database (you would need a Settings model)
    // const settings = await Settings.findOneAndUpdate(
    //   {},
    //   updatedSettings,
    //   { upsert: true, new: true }
    // );
    
    // Create system notification for admins
    const admins = await User.find({ role: 'admin' });
    
    for (const admin of admins) {
      if (admin._id.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: admin._id,
          type: 'system',
          title: 'System Settings Updated',
          message: `${req.user.username} updated system settings`,
          data: {
            updatedSettings,
            updatedBy: req.user.username
          }
        });
        
        await notification.save();
      }
    }
    
    res.json({
      success: true,
      message: 'System settings updated',
      settings: updatedSettings
    });
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Send system announcement
router.post('/announcement', [
  check('title').notEmpty().withMessage('Title is required'),
  check('message').notEmpty().withMessage('Message is required'),
  check('type').isIn(['info', 'warning', 'important']).withMessage('Invalid type'),
  check('target').isIn(['all', 'online', 'specific']).withMessage('Invalid target')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { title, message, type = 'info', target = 'all', specificUsers = [] } = req.body;
    
    let usersToNotify = [];
    
    if (target === 'all') {
      usersToNotify = await User.find().select('_id');
    } else if (target === 'online') {
      usersToNotify = await User.find({ isOnline: true }).select('_id');
    } else if (target === 'specific' && specificUsers.length > 0) {
      usersToNotify = await User.find({ _id: { $in: specificUsers } }).select('_id');
    }
    
    // Create notifications for all target users
    const notifications = usersToNotify.map(user => ({
      user: user._id,
      type: 'system',
      title,
      message,
      data: {
        announcementType: type,
        sentBy: req.user.username,
        sentAt: new Date()
      }
    }));
    
    // Batch insert notifications
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
    
    // Also send to active rooms via Stream.io
    const activeRooms = await Room.find({ isActive: true });
    
    for (const room of activeRooms) {
      try {
        await streamService.sendSystemMessage(
          room._id,
          `📢 **${title}**: ${message}`
        );
      } catch (streamError) {
        console.error('Stream.io announcement error:', streamError);
      }
    }
    
    res.json({
      success: true,
      message: `Announcement sent to ${usersToNotify.length} users`,
      stats: {
        totalUsers: usersToNotify.length,
        activeRooms: activeRooms.length
      }
    });
    
  } catch (error) {
    console.error('Send announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;