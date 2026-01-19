const StreamChat = require('stream-chat').StreamChat;

class StreamService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  // Initialize Stream.io with your API keys
  async initialize() {
    try {
      if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
        throw new Error('Stream.io API key and secret are required in .env');
      }

      this.client = StreamChat.getInstance(
        process.env.STREAM_API_KEY,
        process.env.STREAM_API_SECRET
      );

      // Test connection
      await this.client.getAppSettings();
      
      this.initialized = true;
      console.log('✅ Stream.io initialized successfully');
      
    } catch (error) {
      console.error('❌ Stream.io initialization failed:', error.message);
      throw error;
    }
  }

  // Check if initialized
  isInitialized() {
    return this.initialized;
  }

  // Create or update user
  async upsertUser(userData) {
    try {
      const user = {
        id: userData._id.toString(),
        name: userData.username,
        email: userData.email,
        image: userData.avatar,
        role: userData.role || 'user',
        online: userData.isOnline || false
      };

      await this.client.upsertUser(user);
      console.log(`✅ Stream.io user upserted: ${userData.username}`);
      
    } catch (error) {
      console.error('❌ Stream.io upsert user error:', error);
      throw error;
    }
  }

  // Create user token
  createToken(userId) {
    try {
      return this.client.createToken(userId.toString());
    } catch (error) {
      console.error('❌ Stream.io create token error:', error);
      throw error;
    }
  }

  // Create audio room channel
  async createAudioChannel(roomId, hostId, roomData) {
    try {
      const channelId = `audio_room_${roomId}`;
      
      const channel = this.client.channel('livestream', channelId, {
        name: roomData.title,
        created_by_id: hostId.toString(),
        members: [hostId.toString()],
        image: roomData.thumbnail,
        roomId: roomId.toString(),
        hostId: hostId.toString(),
        hostName: roomData.hostUsername,
        category: roomData.category,
        isActive: roomData.isActive,
        customType: 'audio_room'
      });
      
      await channel.create();
      console.log(`✅ Stream.io channel created: ${channelId}`);
      
      return channel;
      
    } catch (error) {
      console.error('❌ Stream.io create channel error:', error);
      throw error;
    }
  }

  // Add user to channel
  async addUserToChannel(roomId, userId) {
    try {
      const channelId = `audio_room_${roomId}`;
      const channel = this.client.channel('livestream', channelId);
      
      await channel.addMembers([userId.toString()]);
      console.log(`✅ User ${userId} added to channel ${channelId}`);
      
    } catch (error) {
      console.error('❌ Stream.io add user error:', error);
      throw error;
    }
  }

  // Remove user from channel
  async removeUserFromChannel(roomId, userId) {
    try {
      const channelId = `audio_room_${roomId}`;
      const channel = this.client.channel('livestream', channelId);
      
      await channel.removeMembers([userId.toString()]);
      console.log(`✅ User ${userId} removed from channel ${channelId}`);
      
    } catch (error) {
      console.error('❌ Stream.io remove user error:', error);
      throw error;
    }
  }

  // Send system message
  async sendSystemMessage(roomId, message) {
    try {
      const channelId = `audio_room_${roomId}`;
      const channel = this.client.channel('livestream', channelId);
      
      await channel.sendMessage({
        text: message,
        type: 'system',
        user_id: 'system'
      });
      
    } catch (error) {
      console.error('❌ Stream.io system message error:', error);
      throw error;
    }
  }

  // Send user message
  async sendUserMessage(roomId, userId, text, username) {
    try {
      const channelId = `audio_room_${roomId}`;
      const channel = this.client.channel('livestream', channelId);
      
      await channel.sendMessage({
        text,
        user_id: userId.toString(),
        custom_fields: {
          username
        }
      });
      
    } catch (error) {
      console.error('❌ Stream.io user message error:', error);
      throw error;
    }
  }

  // Delete channel
  async deleteChannel(roomId) {
    try {
      const channelId = `audio_room_${roomId}`;
      const channel = this.client.channel('livestream', channelId);
      
      await channel.delete();
      console.log(`✅ Channel ${channelId} deleted`);
      
    } catch (error) {
      console.error('❌ Stream.io delete channel error:', error);
      throw error;
    }
  }

  // Ban user from chat
  async banUser(roomId, userId, reason = '') {
    try {
      await this.client.banUser(userId.toString(), {
        banned_by_id: 'system',
        reason,
        timeout: 3600
      });
      
      console.log(`✅ User ${userId} banned from chat`);
      
    } catch (error) {
      console.error('❌ Stream.io ban user error:', error);
      throw error;
    }
  }
}

module.exports = new StreamService();