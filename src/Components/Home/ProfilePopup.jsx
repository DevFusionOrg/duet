import React from 'react';

function ProfilePopup({ friend, isOwnProfile, onClose, friendsOnlineStatus }) {
  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Profile</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="popup-content">
          <div className="profile-picture-section">
            <img 
              src={friend?.photoURL} 
              alt={friend?.displayName}
              className="profile-picture-large"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.png";
              }}
            />
          </div>

          <div className="profile-info">
            <div className="info-field">
              <label>Name:</label>
              <span>{friend?.displayName}</span>
            </div>
            
            <div className="info-field">
              <label>Username:</label>
              <span>@{friend?.username}</span>
            </div>

            <div className="info-field">
              <label>Status:</label>
              <span className={`status ${friendsOnlineStatus[friend?.uid] ? 'online' : 'offline'}`}>
                {friendsOnlineStatus[friend?.uid] ? 'Online' : 'Offline'}
              </span>
            </div>            
            
            {friend?.bio && (
              <div className="info-field">
                <label>Bio:</label>
                <span className="bio-text">{friend?.bio}</span>
              </div>
            )}
            
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">{friend?.friends ? friend?.friends.length : 0}</span>
                <span className="stat-label">Friends</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePopup;