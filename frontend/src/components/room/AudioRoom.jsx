import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import toast from 'react-hot-toast';
import {
  Mic,
  MicOff,
  Hand,
  Volume2,
  VolumeX,
  Users,
  MessageSquare,
  Settings,
  Crown,
  Shield,
  X,
  UserPlus,
  UserMinus,
  Ban
} from 'react-icons/lucide';

import AudioControls from './AudioControls';
import SpeakersPanel from './SpeakersPanel';
import ListenersPanel from './ListenersPanel';
import HandRaisePanel from './HandRaisePanel';
import ChatPanel from '../chat/ChatPanel';
import AdminControls from './AdminControls';
import ChatBot from '../common/ChatBot';
import { API_BASE_URL, STREAM_API_KEY } from '../../utils/constants';
import streamClient from '../../services/streamClient';

const AudioRoom = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { user, token } = useSelector((state) => state.auth);
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const audioRef = useRef(null);
  const localStreamRef = useRef(null);
  
  const [room, setRoom] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [listeners, setListeners] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [streamChannel, setStreamChannel] = useState(null);

  // Initialize socket
  useEffect(() => {
    socketRef.current = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    // Join room
    socketRef.current.emit('join-room', {
      roomId,
      userId: user._id,
      username: user.username,
      isHost: false
    });

    // Socket events
    socketRef.current.on('room-state', (state) => {
      setSpeakers(state.speakers || []);
      setListeners(state.listeners || []);
    });

    socketRef.current.on('user-joined', (data) => {
      toast.success(`${data.username} joined`);
    });

    socketRef.current.on('user-left', (data) => {
      toast.info(`${data.username} left`);
    });

    socketRef.current.on('hand-raised', (data) => {
      toast(`${data.username} raised hand ✋`, { icon: '✋' });
      setRaisedHands(prev => [...prev, data]);
    });

    socketRef.current.on('hand-approved', (data) => {
      if (data.targetUserId === user._id) {
        setIsHandRaised(false);
        toast.success('You can now speak!');
        startAudioStreaming();
      }
    });

    socketRef.current.on('user-muted', (data) => {
      if (data.targetUserId === user._id) {
        setIsMuted(true);
        stopAudioStreaming();
        toast.error('You were muted');
      }
    });

    // WebRTC signals
    socketRef.current.on('webrtc-signal', handleSignal);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      stopAudioStreaming();
      streamClient.disconnect();
    };
  }, [roomId, user, token]);

  // Fetch room data
  useEffect(() => {
    fetchRoomData();
  }, [roomId]);

  // Initialize Stream Chat
  useEffect(() => {
    if (room && user) {
      initializeStreamChat();
    }
  }, [room, user]);

  const fetchRoomData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setRoom(data.room);
        setIsHost(data.room.isHost);
        setIsModerator(data.room.isHost || data.room.isModerator);
        setSpeakers(data.room.speakers || []);
        setListeners(data.room.listeners || []);
      }
    } catch (error) {
      console.error('Fetch room error:', error);
      toast.error('Failed to load room');
    }
  };

  const initializeStreamChat = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/stream-token`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        // Initialize with YOUR Stream API key
        streamClient.initialize(STREAM_API_KEY);
        
        await streamClient.connectUser(
          user._id,
          data.streamToken,
          {
            username: user.username,
            avatar: user.avatar,
            role: user.role
          }
        );
        
        const channel = await streamClient.getAudioRoomChannel(roomId);
        setStreamChannel(channel);
      }
    } catch (error) {
      console.error('Stream chat error:', error);
      toast.error('Chat features unavailable');
    }
  };

  const startAudioStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }
      
      // Start peer connections
      initiatePeerConnections();
      
      setIsSpeaking(true);
      socketRef.current.emit('speaking-status', {
        roomId,
        userId: user._id,
        isSpeaking: true
      });
      
      toast.success('You are now speaking!');
    } catch (error) {
      console.error('Audio error:', error);
      toast.error('Microphone access required');
    }
  };

  const stopAudioStreaming = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    peersRef.current = {};
    
    setIsSpeaking(false);
    socketRef.current.emit('speaking-status', {
      roomId,
      userId: user._id,
      isSpeaking: false
    });
  };

  const initiatePeerConnections = () => {
    speakers.forEach(speaker => {
      if (speaker.user._id !== user._id && !peersRef.current[speaker.user._id]) {
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: localStreamRef.current
        });
        
        peer.on('signal', signal => {
          socketRef.current.emit('webrtc-signal', {
            roomId,
            userId: user._id,
            targetUserId: speaker.user._id,
            signal
          });
        });
        
        peersRef.current[speaker.user._id] = peer;
      }
    });
  };

  const handleSignal = ({ userId, signal }) => {
    const peer = peersRef.current[userId];
    
    if (peer) {
      peer.signal(signal);
    } else {
      const newPeer = new Peer({
        initiator: false,
        trickle: false,
        stream: localStreamRef.current
      });
      
      newPeer.on('signal', returnSignal => {
        socketRef.current.emit('webrtc-signal', {
          roomId,
          userId: user._id,
          targetUserId: userId,
          signal: returnSignal
        });
      });
      
      newPeer.signal(signal);
      peersRef.current[userId] = newPeer;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      socketRef.current.emit('request-unmute', { roomId, userId: user._id });
    } else {
      setIsMuted(true);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks()[0].enabled = false;
      }
      toast.info('You muted yourself');
    }
  };

  const toggleHandRaise = async () => {
    if (isHandRaised) {
      socketRef.current.emit('cancel-hand', { roomId, userId: user._id });
      setIsHandRaised(false);
      toast.info('Hand lowered');
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/raise-hand`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          setIsHandRaised(true);
          toast.success('Hand raised! Waiting for approval...');
        }
      } catch (error) {
        console.error('Raise hand error:', error);
        toast.error('Failed to raise hand');
      }
    }
  };

  const approveHand = async (targetUserId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${roomId}/approve-hand/${targetUserId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Hand approved');
      }
    } catch (error) {
      console.error('Approve hand error:', error);
      toast.error('Failed to approve');
    }
  };

  const leaveRoom = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      socketRef.current.emit('leave-room', { roomId, userId: user._id });
      stopAudioStreaming();
      streamClient.disconnect();
      
      toast.success('Left room');
      navigate('/');
    } catch (error) {
      console.error('Leave error:', error);
      toast.error('Failed to leave');
    }
  };

  if (!room) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header */}
      <header className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
          
          <div>
            <h1 className="text-xl font-bold">{room.title}</h1>
            <p className="text-gray-400 text-sm">
              Hosted by {room.host.username} • {speakers.length} speakers • {listeners.length} listeners
            </p>
          </div>
          
          {isHost && (
            <span className="flex items-center px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm">
              <Crown size={14} className="mr-1" /> Host
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <MessageSquare size={20} />
          </button>
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={leaveRoom}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
          >
            Leave
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left - Audio Room */}
        <div className="flex-1 flex flex-col p-6">
          {/* Room Info */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{room.title}</h2>
            <p className="text-gray-400">{room.description}</p>
          </div>
          
          {/* Speakers */}
          <SpeakersPanel
            speakers={speakers}
            isHost={isHost}
            isModerator={isModerator}
          />
          
          {/* Audio Controls */}
          <div className="mt-auto pt-6 border-t border-gray-800">
            <AudioControls
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              isHandRaised={isHandRaised}
              onToggleMute={toggleMute}
              onToggleHandRaise={toggleHandRaise}
              onStartSpeaking={startAudioStreaming}
              onStopSpeaking={stopAudioStreaming}
              isHost={isHost}
            />
          </div>
        </div>
        
        {/* Right - Chat & Controls */}
        <div className="w-96 flex flex-col border-l border-gray-800">
          {/* Chat */}
          {showChat && streamChannel && (
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                channel={streamChannel}
                user={user}
                isModerator={isModerator}
              />
            </div>
          )}
          
          {/* Controls */}
          {showControls && (
            <div className="border-t border-gray-800">
              {/* Admin Controls */}
              {(isHost || isModerator) && (
                <AdminControls
                  room={room}
                  raisedHands={raisedHands}
                  onApproveHand={approveHand}
                  isHost={isHost}
                />
              )}
              
              {/* Hand Raise Panel */}
              <HandRaisePanel
                raisedHands={raisedHands.filter(h => h.status === 'pending')}
                onApprove={approveHand}
                isHost={isHost}
                isModerator={isModerator}
              />
              
              {/* Listeners */}
              <ListenersPanel
                listeners={listeners}
                isHost={isHost}
                isModerator={isModerator}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden Audio */}
      <audio ref={audioRef} autoPlay />
      
      {/* ChatBot */}
      <ChatBot roomId={roomId} />
    </div>
  );
};

export default AudioRoom;