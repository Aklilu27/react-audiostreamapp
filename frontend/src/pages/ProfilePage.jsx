import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { userService } from '../services/api';
import { updateUser } from '../store/slices/authSlice';
import Button from '../components/common/Button';
import '../styles/ProfilePage.css';

const ProfilePage = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    bio: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await userService.getProfile();
      const profileData = data?.user || data?.profile || data;
      setProfile(profileData);
      setFormData({
        username: profileData?.username || '',
        email: profileData?.email || '',
        bio: profileData?.bio || '',
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setMessage({ type: 'error', text: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedResponse = await userService.updateProfile(formData);
      const updatedProfile = updatedResponse?.user || updatedResponse?.profile || updatedResponse;
      setProfile(updatedProfile);
      dispatch(updateUser(updatedProfile));
      
      setEditMode(false);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
    // Clear errors when typing
    if (passwordErrors[e.target.name]) {
      setPasswordErrors({
        ...passwordErrors,
        [e.target.name]: '',
      });
    }
  };

  const validatePasswordForm = () => {
    const errors = {};
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    return errors;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const errors = validatePasswordForm();
    
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    try {
      await userService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordErrors({});
      setMessage({ type: 'success', text: 'Password changed successfully!' });
    } catch (error) {
      console.error('Failed to change password:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Profile Settings</h1>
        <p>Manage your account information and preferences</p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button 
            className="close-alert" 
            onClick={() => setMessage({ type: '', text: '' })}
          >
            ×
          </button>
        </div>
      )}

      <div className="profile-content">
        {/* Profile Information Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Personal Information</h2>
            <Button
              variant={editMode ? 'secondary' : 'primary'}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? 'Cancel' : 'Edit Profile'}
            </Button>
          </div>

          {editMode ? (
            <form onSubmit={handleProfileSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleProfileChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleProfileChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleProfileChange}
                  rows="4"
                  placeholder="Tell us about yourself..."
                  maxLength="500"
                />
                <div className="char-count">{formData.bio.length}/500</div>
              </div>
              
              <div className="form-actions">
                <Button type="submit" variant="primary">Save Changes</Button>
              </div>
            </form>
          ) : (
            <div className="profile-info">
              <div className="avatar-section">
                <img
                  src={profile?.avatar || '/default-avatar.png'}
                  alt="Profile"
                  className="profile-avatar"
                />
                <div className="avatar-info">
                  <h3>{profile?.username}</h3>
                  <p className="email">{profile?.email}</p>
                  <p className="member-since">
                    Member since {new Date(profile?.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              {profile?.bio && (
                <div className="bio-section">
                  <h4>About Me</h4>
                  <p>{profile.bio}</p>
                </div>
              )}
              
              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-label">Rooms Joined</span>
                  <span className="stat-value">{profile?.roomsJoined || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Messages Sent</span>
                  <span className="stat-value">{profile?.messagesSent || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Active</span>
                  <span className="stat-value">
                    {profile?.lastActive ? new Date(profile.lastActive).toLocaleString() : 'Recently'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Change Password Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Change Password</h2>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="password-form">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                className={passwordErrors.currentPassword ? 'error' : ''}
                placeholder="Enter current password"
              />
              {passwordErrors.currentPassword && (
                <span className="error-message">{passwordErrors.currentPassword}</span>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                className={passwordErrors.newPassword ? 'error' : ''}
                placeholder="Enter new password (min. 6 characters)"
              />
              {passwordErrors.newPassword && (
                <span className="error-message">{passwordErrors.newPassword}</span>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                className={passwordErrors.confirmPassword ? 'error' : ''}
                placeholder="Confirm new password"
              />
              {passwordErrors.confirmPassword && (
                <span className="error-message">{passwordErrors.confirmPassword}</span>
              )}
            </div>
            
            <div className="form-actions">
              <Button type="submit" variant="primary">Change Password</Button>
            </div>
          </form>
        </div>

        {/* Account Actions Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Account Actions</h2>
          </div>
          
          <div className="account-actions">
            <div className="action-item">
              <h4>Export Data</h4>
              <p>Download a copy of your chat history and account data</p>
              <Button variant="secondary" size="small">Export Data</Button>
            </div>
            
            <div className="action-item">
              <h4>Delete Account</h4>
              <p>Permanently delete your account and all associated data</p>
              <Button variant="danger" size="small">Delete Account</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;