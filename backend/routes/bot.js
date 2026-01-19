const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const streamService = require('../services/streamService');

// Chatbot endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, roomId } = req.body;
    const userId = req.user._id;
    
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        response: {
          text: "Please send a message to chat with me!",
          type: 'error'
        }
      });
    }
    
    // Process message
    const response = await processChatMessage(message.trim(), userId, roomId);
    
    // Send bot message via Stream.io
    if (roomId && response.sendToChat) {
      try {
        await streamService.sendUserMessage(
          roomId,
          'clubhouse-bot',
          response.text,
          'Clubhouse Assistant 🤖'
        );
      } catch (streamError) {
        console.error('Stream.io bot message error:', streamError);
      }
    }
    
    res.json({
      success: true,
      response: {
        text: response.text,
        type: response.type
      }
    });
    
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      response: {
        text: "Sorry, I'm having trouble responding. Please try again in a moment.",
        type: 'error'
      }
    });
  }
});

// Process chat message
async function processChatMessage(message, userId, roomId) {
  const lowerMessage = message.toLowerCase();
  
  // Greetings
  if (/(hello|hi|hey|greetings)/i.test(lowerMessage)) {
    return {
      text: `👋 Hello! I'm your Clubhouse Assistant. How can I help you today?\n\nTry asking me:\n• "help" for commands\n• "rooms" for active rooms\n• "how to speak" to become a speaker`,
      type: 'greeting',
      sendToChat: true
    };
  }
  
  // Help
  if (lowerMessage.includes('help')) {
    return {
      text: `🤖 **Available Commands:**\n\n**Room Related:**\n• "rooms" - List active rooms\n• "room info" - Current room info\n• "raise hand" - Request to speak\n• "leave room" - Leave current room\n\n**User Help:**\n• "my profile" - Your profile info\n• "followers" - Your followers\n• "following" - Who you follow\n\n**Features:**\n• "become speaker" - How to speak\n• "mute/unmute" - Audio controls\n• "report" - Report issues\n\n**General:**\n• "about" - About Clubhouse\n• "support" - Get help\n• "feedback" - Submit feedback`,
      type: 'help',
      sendToChat: true
    };
  }
  
  // Rooms
  if (/(rooms|active rooms|available rooms)/i.test(lowerMessage)) {
    const rooms = await Room.find({ isActive: true })
      .sort({ 'listeners': -1 })
      .limit(5);
    
    if (rooms.length === 0) {
      return {
        text: "🏠 There are no active rooms right now. Why not create one?",
        type: 'rooms',
        sendToChat: true
      };
    }
    
    const roomsList = rooms.map(room => 
      `• **${room.title}** - ${room.listeners.length} listeners - Host: ${room.hostUsername}`
    ).join('\n');
    
    return {
      text: `🎧 **Active Rooms:**\n\n${roomsList}\n\nJoin a room from the home page to start chatting!`,
      type: 'rooms',
      sendToChat: true
    };
  }
  
  // Room info
  if (/(room info|this room|current room)/i.test(lowerMessage)) {
    if (!roomId) {
      return {
        text: "I need to know which room you're in to provide information.",
        type: 'room_info',
        sendToChat: false
      };
    }
    
    const room = await Room.findById(roomId);
    
    if (!room) {
      return {
        text: "Sorry, I couldn't find information about this room.",
        type: 'room_info',
        sendToChat: true
      };
    }
    
    return {
      text: `📊 **Room Information:**\n\n**Title:** ${room.title}\n**Host:** ${room.hostUsername}\n**Speakers:** ${room.speakers.length}\n**Listeners:** ${room.listeners.length}\n**Category:** ${room.category}\n**Status:** ${room.isActive ? '🟢 Active' : '🔴 Ended'}`,
      type: 'room_info',
      sendToChat: true
    };
  }
  
  // How to become speaker
  if (/(become speaker|how to speak|raise hand|request speak)/i.test(lowerMessage)) {
    return {
      text: `🎤 **How to Become a Speaker:**\n\n1. **Raise Your Hand** ✋\n   Click the "Raise Hand" button\n\n2. **Wait for Approval** ⏳\n   The host will see your request\n\n3. **Start Speaking** 🔊\n   Once approved, unmute and speak\n\n4. **Mute When Done** 🔇\n   Click mute when finished speaking\n\n**Note:** Only hosts can approve speaker requests.`,
      type: 'speaker_guide',
      sendToChat: true
    };
  }
  
  // Support
  if (/(support|help|problem|issue)/i.test(lowerMessage)) {
    return {
      text: `🛠️ **Support & Help:**\n\n• **Audio Issues:** Check microphone permissions\n• **Connection Issues:** Refresh the page\n• **Report Bugs:** contact@clubhouse.com\n• **Emergency:** Report to room host\n\nFor immediate assistance, contact the room host or moderator.`,
      type: 'support',
      sendToChat: true
    };
  }
  
  // About
  if (/(about|what is clubhouse|platform)/i.test(lowerMessage)) {
    return {
      text: `🏠 **About Clubhouse Clone:**\n\n• **Real-time audio rooms** for conversations\n• **Raise hand** feature to request speaking\n• **Live chat** alongside audio\n• **User profiles** and following system\n• **Room categories** and discovery\n\nBuilt with ❤️ using Node.js, React, MongoDB, and Stream.io`,
      type: 'about',
      sendToChat: true
    };
  }
  
  // Default response
  return {
    text: "I'm not sure I understand. Try asking:\n• 'help' for commands\n• 'rooms' for active rooms\n• 'how to become a speaker'\n• Or ask about room information",
    type: 'default',
    sendToChat: false
  };
}

module.exports = router;