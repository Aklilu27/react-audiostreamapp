const { Readable } = require('stream');

class AudioService {
  constructor() {
    this.audioStreams = new Map(); // roomId -> Map(userId -> stream)
    this.peerConnections = new Map(); // roomId -> Map(userId -> connections)
  }

  // Add audio stream for user in room
  addStream(roomId, userId, stream) {
    if (!this.audioStreams.has(roomId)) {
      this.audioStreams.set(roomId, new Map());
    }
    
    this.audioStreams.get(roomId).set(userId, stream);
    console.log(`🎧 Audio stream added for user ${userId} in room ${roomId}`);
  }

  // Remove audio stream
  removeStream(roomId, userId) {
    if (this.audioStreams.has(roomId)) {
      this.audioStreams.get(roomId).delete(userId);
      console.log(`🎧 Audio stream removed for user ${userId} in room ${roomId}`);
    }
  }

  // Get all streams in room
  getStreams(roomId) {
    if (this.audioStreams.has(roomId)) {
      return Array.from(this.audioStreams.get(roomId).entries()).map(([userId, stream]) => ({
        userId,
        stream
      }));
    }
    return [];
  }

  // Add peer connection
  addPeerConnection(roomId, userId, peer) {
    if (!this.peerConnections.has(roomId)) {
      this.peerConnections.set(roomId, new Map());
    }
    
    this.peerConnections.get(roomId).set(userId, peer);
  }

  // Remove peer connection
  removePeerConnection(roomId, userId) {
    if (this.peerConnections.has(roomId)) {
      const peer = this.peerConnections.get(roomId).get(userId);
      if (peer) {
        peer.destroy();
      }
      this.peerConnections.get(roomId).delete(userId);
    }
  }

  // Get peer connections
  getPeerConnections(roomId) {
    if (this.peerConnections.has(roomId)) {
      return this.peerConnections.get(roomId);
    }
    return new Map();
  }

  // Clean up room
  cleanupRoom(roomId) {
    // Destroy all peer connections
    if (this.peerConnections.has(roomId)) {
      for (const peer of this.peerConnections.get(roomId).values()) {
        peer.destroy();
      }
      this.peerConnections.delete(roomId);
    }
    
    // Remove all streams
    this.audioStreams.delete(roomId);
    
    console.log(`🧹 Audio service cleaned up for room ${roomId}`);
  }

  // Mix audio streams (simplified version)
  mixAudio(roomId) {
    const streams = this.getStreams(roomId);
    
    if (streams.length === 0) {
      return null;
    }

    // Create a mixed stream (this is a simplified version)
    const mixedStream = new Readable({
      read(size) {
        // In a real implementation, you would mix audio buffers here
        this.push(Buffer.alloc(size));
      }
    });

    return mixedStream;
  }
}

module.exports = new AudioService();