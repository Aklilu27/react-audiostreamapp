import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import VideoRoom from '../components/room/VideoRoom';
import { chatService } from '../services/api';
import '../styles/RoomPage.css';

class VideoRoomErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error) {
    console.error('VideoRoom error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#b91c1c' }}>
          Video room crashed: {this.state.message}
        </div>
      );
    }

    return this.props.children;
  }
}

const RoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const userId = user?._id || user?.id;
  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadRoom = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await chatService.getRoom(id);
        setRoom(response.room);
        setIsAuthorized(!response.room?.isPrivate);
      } catch (err) {
        setError(err?.message || 'Unable to load room');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadRoom();
    }
  }, [id]);

  const handleJoinPrivate = async (event) => {
    event.preventDefault();
    if (!password) {
      setError('Password is required for this room');
      return;
    }

    try {
      setError('');
      await chatService.joinRoom(id, { password });
      setIsAuthorized(true);
    } catch (err) {
      setError(err?.message || 'Unable to join room');
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError('');
      await chatService.deleteRoom(id);
      navigate('/chat');
    } catch (err) {
      setError(err?.message || 'Unable to delete room');
    } finally {
      setIsDeleting(false);
    }
  };

  const isOwner = room?.hostId && userId && room.hostId === userId;
  const canDelete = isOwner || user?.role === 'admin';

  if (isLoading) {
    return <div className="room-page__status">Loading room...</div>;
  }

  if (error && !room) {
    return <div className="room-page__error">{error}</div>;
  }

  return (
    <div className="room-page">
      <div className="room-page__header">
        <div>
          <h2>{room?.name || 'Room'}</h2>
          <p>{room?.description || 'No description provided.'}</p>
        </div>
        <div className="room-page__meta">
          {room?.isPrivate && <span className="room-page__badge">Private</span>}
          <span className="room-page__host">Host: {room?.hostUsername}</span>
          <span className="room-page__count">Participants: {room?.participantCount}</span>
        </div>
        {canDelete && (
          <button className="room-page__delete" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Room'}
          </button>
        )}
      </div>

      {error && <div className="room-page__error">{error}</div>}

      {!isAuthorized && room?.isPrivate ? (
        <form className="room-page__form" onSubmit={handleJoinPrivate}>
          <label htmlFor="room-password">Enter room password</label>
          <input
            id="room-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Room password"
          />
          <button type="submit" className="room-page__button">Join Room</button>
        </form>
      ) : (
        <VideoRoomErrorBoundary>
          <VideoRoom />
        </VideoRoomErrorBoundary>
      )}
    </div>
  );
};

export default RoomPage;