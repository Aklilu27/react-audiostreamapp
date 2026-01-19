const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Room title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    default: '',
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hostUsername: {
    type: String,
    required: true
  },
  speakers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isSpeaking: {
      type: Boolean,
      default: false
    },
    isMuted: {
      type: Boolean,
      default: false
    }
  }],
  listeners: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  raisedHands: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    raisedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  category: {
    type: String,
    enum: ['Technology', 'Business', 'Entertainment', 'Sports', 'Education', 'Health', 'Science', 'Arts', 'Politics', 'Other'],
    default: 'Other'
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    select: false
  },
  maxSpeakers: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  },
  maxListeners: {
    type: Number,
    default: 100,
    min: 1,
    max: 1000
  },
  thumbnail: {
    type: String,
    default: 'https://api.dicebear.com/7.x/shapes/svg?seed=room'
  },
  settings: {
    allowRaiseHand: {
      type: Boolean,
      default: true
    },
    allowChat: {
      type: Boolean,
      default: true
    },
    recordingEnabled: {
      type: Boolean,
      default: false
    },
    autoApproveSpeakers: {
      type: Boolean,
      default: false
    }
  },
  stats: {
    totalMessages: {
      type: Number,
      default: 0
    },
    peakListeners: {
      type: Number,
      default: 0
    },
    totalTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Add listener to room
RoomSchema.methods.addListener = async function(userId, username) {
  const isAlreadyListener = this.listeners.some(l => l.user.toString() === userId.toString());
  const isSpeaker = this.speakers.some(s => s.user.toString() === userId.toString());
  
  if (!isAlreadyListener && !isSpeaker && this.listeners.length < this.maxListeners) {
    this.listeners.push({
      user: userId,
      username,
      joinedAt: new Date()
    });
    
    // Update peak listeners
    if (this.listeners.length > this.stats.peakListeners) {
      this.stats.peakListeners = this.listeners.length;
    }
    
    return this.save();
  }
  return this;
};

// Remove listener
RoomSchema.methods.removeRoomListener = async function(userId) {
  this.listeners = this.listeners.filter(l => l.user.toString() !== userId.toString());
  return this.save();
};

// Raise hand
RoomSchema.methods.raiseHand = async function(userId, username) {
  const isAlreadyRaised = this.raisedHands.some(h => 
    h.user.toString() === userId.toString() && h.status === 'pending'
  );
  
  if (!isAlreadyRaised) {
    this.raisedHands.push({
      user: userId,
      username,
      raisedAt: new Date(),
      status: 'pending'
    });
    return this.save();
  }
  return this;
};

// Approve hand
RoomSchema.methods.approveHand = async function(userId) {
  const handIndex = this.raisedHands.findIndex(h => 
    h.user.toString() === userId.toString() && h.status === 'pending'
  );
  
  if (handIndex !== -1) {
    this.raisedHands[handIndex].status = 'approved';
    
    // Add as speaker
    const username = this.raisedHands[handIndex].username;
    await this.addSpeaker(userId, username);
    
    return this.save();
  }
  return this;
};

// Add speaker
RoomSchema.methods.addSpeaker = async function(userId, username) {
  const isAlreadySpeaker = this.speakers.some(s => s.user.toString() === userId.toString());
  
  if (!isAlreadySpeaker && this.speakers.length < this.maxSpeakers) {
    this.speakers.push({
      user: userId,
      username,
      joinedAt: new Date(),
      isSpeaking: false,
      isMuted: false
    });
    
    // Remove from raised hands
    this.raisedHands = this.raisedHands.filter(h => h.user.toString() !== userId.toString());
    
    return this.save();
  }
  return this;
};

// Mute speaker
RoomSchema.methods.muteSpeaker = async function(userId) {
  const speakerIndex = this.speakers.findIndex(s => s.user.toString() === userId.toString());
  
  if (speakerIndex !== -1) {
    this.speakers[speakerIndex].isMuted = true;
    this.speakers[speakerIndex].isSpeaking = false;
    return this.save();
  }
  return this;
};

module.exports = mongoose.model('Room', RoomSchema);