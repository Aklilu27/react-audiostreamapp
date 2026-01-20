import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import '../../styles/VideoRoom.css';

const getSocketBaseUrl = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  return apiBase.replace(/\/api\/?$/, '');
};

const VideoRoom = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useSelector((state) => state.auth);
  const userId = user?._id || user?.id ? String(user?._id || user?.id) : null;
  const clientIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Math.random().toString(36).slice(2)}`
  );
  const clientId = clientIdRef.current;

  const socketRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);

  const [roomUsers, setRoomUsers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const normalizeUsers = (users = []) =>
    users
      .map((roomUser) => ({
        ...roomUser,
        participantId: roomUser?.participantId ? String(roomUser.participantId) : undefined,
        userId: roomUser?.userId ? String(roomUser.userId) : undefined
      }))
      .map((roomUser) => ({
        ...roomUser,
        userId: roomUser.participantId || roomUser.userId
      }))
      .filter((roomUser) => roomUser.userId);

  const participants = clientId
    ? [
        { userId: clientId, username: user?.username || 'You' },
        ...roomUsers.filter((roomUser) => roomUser.userId !== clientId)
      ]
    : roomUsers;

  const streamByUserId = remoteStreams.reduce((acc, item) => {
    acc[item.userId] = item.stream;
    return acc;
  }, {});

  const getInitials = (name = '') =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const MicOnIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z" />
    </svg>
  );

  const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 11a7 7 0 0 1-1.23 3.98l-1.52-1.52A5 5 0 0 0 17 11h2ZM5 11h2a5 5 0 0 0 7.68 4.17l1.47 1.47A7 7 0 0 1 5 11Zm7 4a3 3 0 0 1-3-3V8.21l6 6A2.99 2.99 0 0 1 12 15Zm0-12a3 3 0 0 1 3 3v5.17l-6-6V6a3 3 0 0 1 3-3Zm8.19 18.19L3.81 4.81 5.22 3.4l16.38 16.38-1.41 1.41Z" />
    </svg>
  );

  const CamOffIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 6.5 16 10V7a2 2 0 0 0-2-2H9.41l8.29 8.29L21 11.5v-5ZM3.27 2 2 3.27 4.73 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 1.41-.59l3.32 3.32L20 19.73 3.27 2ZM14 16H4V8h2.73l7.27 7.27V16Z" />
    </svg>
  );

  const CamOnIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5l5 3v-9l-5 3V9a2 2 0 0 0-2-2Z" />
    </svg>
  );

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const requestMedia = async () => {
    try {
      setMediaError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        const videoEl = localVideoRef.current;
        videoEl.onloadedmetadata = () => {
          videoEl.play().catch(() => undefined);
        };
      }
      setIsMediaReady(true);
    } catch (error) {
      console.error('Media error:', error);
      setMediaError('Camera/microphone access is blocked. Allow permissions and try again.');
    }
  };

  useEffect(() => {
    if (!localVideoRef.current || !localStreamRef.current) return;
    localVideoRef.current.srcObject = localStreamRef.current;
  }, [isMediaReady]);

  useEffect(() => {
    if (!userId || !roomId) return;

    const socket = io(getSocketBaseUrl(), {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.emit('join-room', {
      roomId,
      userId,
      clientId,
      username: user.username,
      isHost: false
    });

    socket.on('room-state', ({ users }) => {
      setRoomUsers(normalizeUsers(users || []));
    });

    socket.on('user-joined', (data) => {
      const normalized = normalizeUsers([data])[0];
      if (!normalized) return;
      setRoomUsers((prev) => {
        if (prev.some((u) => u.userId === normalized.userId)) return prev;
        return [...prev, normalized];
      });
    });

    socket.on('user-left', (data) => {
      const normalized = normalizeUsers([data])[0];
      if (!normalized) return;
      cleanupPeer(normalized.userId);
      setRoomUsers((prev) => prev.filter((u) => u.userId !== normalized.userId));
    });

    socket.on('user-disconnected', (data) => {
      const normalized = normalizeUsers([data])[0];
      if (!normalized) return;
      cleanupPeer(normalized.userId);
      setRoomUsers((prev) => prev.filter((u) => u.userId !== normalized.userId));
    });

    socket.on('webrtc-signal', ({ userId: fromUserId, signal, username }) => {
      const normalized = normalizeUsers([{ userId: fromUserId, username }])[0];
      if (!normalized) return;
      handleIncomingSignal(normalized.userId, signal, normalized.username);
    });

    return () => {
      socket.disconnect();
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};
    };
  }, [roomId, userId, user?.username, token, clientId]);

  useEffect(() => {
    if (!clientId || !isMediaReady || !roomUsers.length || !socketRef.current) return;

    roomUsers.forEach((roomUser) => {
      if (roomUser.userId === clientId) return;
      const shouldInitiate = clientId.localeCompare(roomUser.userId) < 0;
      if (shouldInitiate) {
        createPeer(roomUser.userId);
      }
    });
  }, [isMediaReady, roomUsers, clientId]);

  const createPeer = (targetUserId) => {
    if (peersRef.current[targetUserId] || !localStreamRef.current) return;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: localStreamRef.current,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      socketRef.current.emit('webrtc-signal', {
        roomId,
        userId: clientId,
        targetUserId,
        signal
      });
    });

    peer.on('stream', (stream) => {
      upsertRemoteStream(targetUserId, stream);
    });

    peer.on('close', () => cleanupPeer(targetUserId));
    peer.on('error', () => cleanupPeer(targetUserId));

    peersRef.current[targetUserId] = peer;
  };

  const handleIncomingSignal = (fromUserId, signal) => {
    if (!localStreamRef.current) return;

    let peer = peersRef.current[fromUserId];

    if (!peer) {
      peer = new Peer({
        initiator: false,
        trickle: false,
        stream: localStreamRef.current,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('signal', (returnSignal) => {
        socketRef.current.emit('webrtc-signal', {
          roomId,
          userId: clientId,
          targetUserId: fromUserId,
          signal: returnSignal
        });
      });

      peer.on('stream', (stream) => {
        upsertRemoteStream(fromUserId, stream);
      });

      peer.on('close', () => cleanupPeer(fromUserId));
      peer.on('error', () => cleanupPeer(fromUserId));

      peersRef.current[fromUserId] = peer;
    }

    peer.signal(signal);
  };

  const upsertRemoteStream = (userId, stream) => {
    setRemoteStreams((prev) => {
      const existing = prev.find((item) => item.userId === userId);
      if (existing) {
        return prev.map((item) => (item.userId === userId ? { ...item, stream } : item));
      }
      return [...prev, { userId, stream }];
    });
  };

  const cleanupPeer = (userId) => {
    if (peersRef.current[userId]) {
      peersRef.current[userId].destroy();
      delete peersRef.current[userId];
    }

    setRemoteStreams((prev) => prev.filter((item) => item.userId !== userId));
  };

  const toggleAudio = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsAudioMuted(!track.enabled);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoOff(!track.enabled);
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId, userId, clientId });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    peersRef.current = {};

    navigate('/chat');
  };

  if (!userId) {
    return (
      <div className="video-room">
        <div className="video-room__error">Loading user session...</div>
      </div>
    );
  }

  return (
    <div className="video-room">
      <header className="video-room__header">
        <div className="video-room__title">
          <h2>Video Room</h2>
          <p>{participants.length} participants</p>
        </div>
        <button className="video-room__leave" onClick={leaveRoom}>
          Leave
        </button>
      </header>

      <div className="video-room__grid">
        {participants.map((participant) => {
          const isLocal = participant.userId === clientId;
          const stream = isLocal ? localStreamRef.current : streamByUserId[participant.userId];
          const showVideo = Boolean(stream) && (!isLocal || !isVideoOff);
          return (
            <div
              key={participant.userId}
              className={`video-tile${isLocal ? ' video-tile--local' : ''}`}
            >
              {showVideo ? (
                isLocal ? (
                  <div className="video-tile__media">
                    <video ref={localVideoRef} autoPlay muted playsInline />
                  </div>
                ) : (
                  <div className="video-tile__media">
                    <VideoPlayer stream={stream} />
                  </div>
                )
              ) : (
                <div className="video-tile__placeholder">
                  <div className="video-tile__avatar">{getInitials(participant.username)}</div>
                  <div className="video-tile__status">
                    {isLocal && !isMediaReady ? 'Camera off' : 'No video'}
                  </div>
                </div>
              )}
              <span className="video-tile__label">
                {isLocal ? 'You' : participant.username}
              </span>
              {isLocal && (
                <div className="video-tile__status-icons">
                  <span
                    className={`status-icon ${isAudioMuted ? 'status-icon--off' : ''}`}
                    title={isAudioMuted ? 'Muted' : 'Mic on'}
                  >
                    {isAudioMuted ? <MicOffIcon /> : <MicOnIcon />}
                  </span>
                  <span
                    className={`status-icon ${isVideoOff ? 'status-icon--off' : ''}`}
                    title={isVideoOff ? 'Camera off' : 'Camera on'}
                  >
                    {isVideoOff ? <CamOffIcon /> : <CamOnIcon />}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="video-room__controls">
        {!isMediaReady && (
          <button onClick={requestMedia} className="primary">
            Enable Camera & Mic
          </button>
        )}
        <button onClick={toggleAudio} className={isAudioMuted ? 'danger' : ''}>
          {isAudioMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={toggleVideo} className={isVideoOff ? 'danger' : ''}>
          {isVideoOff ? 'Start Video' : 'Stop Video'}
        </button>
        <button onClick={leaveRoom} className="secondary">
          Leave Room
        </button>
      </div>

      {mediaError && <div className="video-room__error">{mediaError}</div>}
    </div>
  );
};

const VideoPlayer = ({ stream }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      const videoEl = ref.current;
      videoEl.onloadedmetadata = () => {
        videoEl.play().catch(() => undefined);
      };
    }
  }, [stream]);

  return <video ref={ref} autoPlay playsInline />;
};

export default VideoRoom;
