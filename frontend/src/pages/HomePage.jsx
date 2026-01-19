import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import '../styles/HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Welcome to Video Rooms</h1>
        <p>Connect with people in real-time video and audio rooms</p>
        <div className="cta-buttons">
          <Link to="/chat">
            <Button variant="primary">Join a Video Room</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;