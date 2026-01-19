import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setRooms } from '../store/slices/roomSlice';
import RoomList from '../components/room/RoomList';
import { chatService } from '../services/api';
import '../styles/ChatPage.css';

const ChatPage = () => {
  const dispatch = useDispatch();
  const rooms = useSelector((state) => state.room.rooms);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isPrivate: false,
    password: ''
  });

  useEffect(() => {
    const loadRooms = async () => {
      try {
        setIsFetching(true);
        setError('');
        const response = await chatService.getRooms();
        dispatch(setRooms(response.rooms || []));
      } catch (err) {
        setError(err?.message || 'Failed to load rooms');
      } finally {
        setIsFetching(false);
      }
    };

    loadRooms();
  }, [dispatch]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    if (!formData.title.trim()) {
      setError('Room title is required');
      return;
    }

    if (formData.isPrivate && formData.password.trim().length < 4) {
      setError('Private rooms require a 4+ character password');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const response = await chatService.createRoom({
        title: formData.title,
        description: formData.description,
        isPrivate: formData.isPrivate,
        password: formData.isPrivate ? formData.password : undefined
      });
      dispatch(setRooms([response.room, ...rooms]));
      setFormData({ title: '', description: '', isPrivate: false, password: '' });
    } catch (err) {
      setError(err?.message || 'Failed to create room');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-page__sidebar">
        <RoomList />
      </div>
      <div className="chat-page__content">
        <h2>Video Rooms</h2>
        <p>Select a room to join live video and audio.</p>
        {isFetching && <p className="chat-page__status">Loading rooms...</p>}
        <div className="chat-page__card">
          <h3>Create a room</h3>
          {error && <div className="chat-page__error">{error}</div>}
          <form onSubmit={handleCreateRoom} className="chat-page__form">
            <div className="chat-page__form-group">
              <label htmlFor="title">Room title</label>
              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Team Standup"
              />
            </div>
            <div className="chat-page__form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleChange}
                placeholder="What is this room about?"
              />
            </div>
            <div className="chat-page__form-row">
              <label className="chat-page__checkbox">
                <input
                  type="checkbox"
                  name="isPrivate"
                  checked={formData.isPrivate}
                  onChange={handleChange}
                />
                Private room (password required)
              </label>
            </div>
            {formData.isPrivate && (
              <div className="chat-page__form-group">
                <label htmlFor="password">Room password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Set a room password"
                />
              </div>
            )}
            <button className="chat-page__button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;