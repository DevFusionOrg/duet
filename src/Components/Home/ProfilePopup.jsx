import React, { useEffect, useState } from "react";
import { deleteFriend, getUserProfile } from "../../firebase/firestore";

function ProfilePopup({
  friend,
  currentUserId,
  isOwnProfile,
  onClose,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔹 LOAD FULL PROFILE WHEN POPUP OPENS
  useEffect(() => {
    if (!friend?.uid) return;

    let active = true;

    getUserProfile(friend.uid).then((data) => {
      if (active) setProfile(data);
    });

    return () => {
      active = false;
    };
  }, [friend]);

  const handleRemoveFriend = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${profile?.displayName || "this user"} from your friends?`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      await deleteFriend(currentUserId, friend.uid);
      onClose();
    } catch (error) {
      alert(error.message || "Failed to remove friend");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

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
              src={profile.photoURL || "/default-avatar.png"}
              alt={profile.displayName}
              className="profile-picture-large"
            />
          </div>

          <div className="profile-info">
            <div className="info-field">
              <label>Name:</label>
              <span>{profile.displayName}</span>
            </div>

            <div className="info-field">
              <label>Username:</label>
              <span>@{profile.username}</span>
            </div>

            {profile.bio && (
              <div className="info-field">
                <label>Bio:</label>
                <span className="bio-text">{profile.bio}</span>
              </div>
            )}

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">
                  {profile.friends?.length || 0}
                </span>
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
