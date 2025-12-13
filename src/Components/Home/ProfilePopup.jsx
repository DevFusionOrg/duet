import React, { useState } from 'react';
import { deleteFriend } from '../../firebase/firestore';

function ProfilePopup({
  friend,
  currentUserId,
  isOwnProfile,
  onClose,
  friendsOnlineStatus,
}) {
  const [loading, setLoading] = useState(false);

  const handleRemoveFriend = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${friend.displayName} from your friends?`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      await deleteFriend(currentUserId, friend.uid);
      onClose(); // close popup after success
    } catch (error) {
      alert(error.message || "Failed to remove friend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Profile</h2>
          <button className="close-button" onClick={onClose}>×</button>
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

            {friend?.bio && (
              <div className="info-field">
                <label>Bio:</label>
                <span className="bio-text">{friend?.bio}</span>
              </div>
            )}

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">{friend?.friends?.length || 0}</span>
                <span className="stat-label">Friends</span>
              </div>
            </div>

            {!isOwnProfile && (
              <button
                className="remove-friend-button"
                onClick={handleRemoveFriend}
                disabled={loading}
              >
                {loading ? "Removing..." : "REMOVE"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePopup;
