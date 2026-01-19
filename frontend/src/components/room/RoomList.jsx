import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import './RoomList.css';

const RoomList = () => {
  const rooms = useSelector((state) => state.room.rooms);

  return (
    <div className="room-list">
      <h3>Available Rooms</h3>
      {rooms.length === 0 ? (
        <p>No rooms available</p>
      ) : (
        <ul>
          {rooms.map((room) => (
            <li key={room.id}>
              <Link to={`/room/${room.id}`}>
                <div className="room-item">
                  <h4>
                    {room.name}
                    {room.isPrivate && <span className="room-item__lock">🔒</span>}
                  </h4>
                  <p>{room.description}</p>
                  <span>Participants: {room.participantCount}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RoomList;