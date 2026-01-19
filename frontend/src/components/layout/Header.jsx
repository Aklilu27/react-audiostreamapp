import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../../store/slices/authSlice';
import './Header.css';

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="header">
      <div className="logo">
        <Link to="/home">ChatApp</Link>
      </div>
      <div className="user-section">
        {isAuthenticated ? (
          <button className="logout-button" onClick={handleLogout}>
            <span className="logout-button__icon" aria-hidden="true">⎋</span>
            Logout
          </button>
        ) : (
          <span className="header-placeholder" />
        )}
      </div>
    </header>
  );
};

export default Header;