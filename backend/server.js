// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();
const Room = require('./models/Room');
const { hasAccess, grantAccess } = require('./utils/roomAccess');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

const getAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
  if (!raw) {
    return ['http://localhost:5173', 'http://localhost:3000'];
  }
  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
};

const allowedOrigins = getAllowedOrigins();

// WebSocket setup
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
mongoose.connect(mongoUri)
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Import Stream service
const streamService = require('./services/streamService');
streamService.initialize()
  .then(() => console.log('✅ Stream.io Initialized'))
  .catch(err => console.error('❌ Stream.io Initialization Error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const botRoutes = require('./routes/bot');

// Import auth middleware
const { authMiddleware } = require('./middleware/auth');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', authMiddleware, roomRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/bot', authMiddleware, botRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      stream: streamService.isInitialized() ? 'connected' : 'disconnected'
    }
  });
});

// In-memory tracking of rooms and users
const activeRooms = new Map(); // roomId -> Map(participantId -> userData)
const userSockets = new Map(); // participantId -> socket.id

// WebSocket event handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Join Room
  socket.on('join-room', async ({ roomId, userId, clientId, username, isHost }) => {
    try {
      const participantId = clientId || userId;
      const roomDoc = await Room.findOne({ _id: roomId, isActive: true }).lean();
      if (!roomDoc) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (roomDoc.isPrivate && !hasAccess(roomId, userId)) {
        socket.emit('error', { message: 'Room password required' });
        return;
      }

      if (roomDoc.host?.toString() === userId?.toString()) {
        grantAccess(roomId, userId);
      }

      socket.join(`room:${roomId}`);
      userSockets.set(participantId, socket.id);

      if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Map());
      const room = activeRooms.get(roomId);

      room.set(participantId, {
        socketId: socket.id,
        userId,
        username,
        isHost,
        isSpeaking: false,
        joinedAt: new Date()
      });

      // Stream.io integration
      await streamService.addUserToChannel(roomId, userId);
      await streamService.sendSystemMessage(roomId, `${username} joined the room`);

      // Broadcast to room
      socket.to(`room:${roomId}`).emit('user-joined', {
        participantId,
        userId,
        username,
        isHost,
        timestamp: new Date()
      });

      // Send current room state to user
      const users = Array.from(room.entries()).map(([pid, data]) => ({
        participantId: pid,
        ...data
      }));
      socket.emit('room-state', { users, roomId });

      console.log(`👤 User ${username} joined room ${roomId}`);
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave Room
  socket.on('leave-room', async ({ roomId, userId, clientId }) => {
    try {
      const participantId = clientId || userId;
      socket.leave(`room:${roomId}`);
      if (activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId);
        const user = room.get(participantId);
        if (user) {
          await streamService.removeUserFromChannel(roomId, userId);
          await streamService.sendSystemMessage(roomId, `${user.username} left the room`);
          room.delete(participantId);

          io.to(`room:${roomId}`).emit('user-left', {
            participantId,
            userId,
            username: user.username,
            timestamp: new Date()
          });

          if (room.size === 0) activeRooms.delete(roomId);
          userSockets.delete(participantId);

          console.log(`👤 User ${user.username} left room ${roomId}`);
        }
      }
    } catch (error) {
      console.error('Leave room error:', error);
    }
  });

  // Audio Stream
  socket.on('audio-stream', ({ roomId, userId, audioData }) => {
    socket.to(`room:${roomId}`).emit('audio-stream', { userId, audioData, timestamp: Date.now() });
  });

  // Chat Message
  socket.on('chat-message', async ({ roomId, userId, text, username }) => {
    try {
      await streamService.sendUserMessage(roomId, userId, text, username);
      io.to(`room:${roomId}`).emit('new-message', { userId, username, text, timestamp: new Date() });
    } catch (error) {
      console.error('Chat message error:', error);
    }
  });

  // WebRTC signaling (audio/video)
  socket.on('webrtc-signal', ({ roomId, userId, targetUserId, signal }) => {
    try {
      const targetSocketId = userSockets.get(targetUserId);
      const room = activeRooms.get(roomId);
      const sender = room?.get(userId);

      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc-signal', {
          userId,
          username: sender?.username,
          signal
        });
      }
    } catch (error) {
      console.error('WebRTC signal error:', error);
    }
  });

  // Raise Hand
  socket.on('raise-hand', async ({ roomId, userId, username }) => {
    if (!activeRooms.has(roomId)) return;
    const room = activeRooms.get(roomId);
    for (const [uid, user] of room.entries()) {
      if (user.isHost) {
        io.to(user.socketId).emit('hand-raised', { userId, username, timestamp: new Date() });
        break;
      }
    }
    await streamService.sendSystemMessage(roomId, `${username} raised their hand`);
    console.log(`✋ User ${username} raised hand in room ${roomId}`);
  });

  // Mute User
  socket.on('mute-user', ({ roomId, targetUserId, mutedBy }) => {
    if (!activeRooms.has(roomId)) return;
    const room = activeRooms.get(roomId);
    const user = room.get(targetUserId);
    if (user) {
      io.to(user.socketId).emit('user-muted', { mutedBy, timestamp: new Date() });
      io.to(`room:${roomId}`).emit('user-was-muted', { targetUserId, username: user.username, mutedBy, timestamp: new Date() });
      console.log(`🔇 User ${user.username} muted by ${mutedBy}`);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    for (const [roomId, room] of activeRooms.entries()) {
      for (const [participantId, user] of room.entries()) {
        if (user.socketId === socket.id) {
          room.delete(participantId);
          io.to(`room:${roomId}`).emit('user-disconnected', {
            participantId,
            userId: user.userId,
            username: user.username,
            timestamp: new Date()
          });
          if (room.size === 0) activeRooms.delete(roomId);
          userSockets.delete(participantId);
          console.log(`👤 User ${user.username} disconnected from room ${roomId}`);
          break;
        }
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL(s): ${allowedOrigins.join(', ')}`);
});
