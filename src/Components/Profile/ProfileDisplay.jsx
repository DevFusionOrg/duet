import React from "react";

function ProfileDisplay({ 
  profile, 
  isOwnProfile, 
  user,
  blockedUsers,
  loadingBlockedUsers,
  onShowBlockedUsers,
  onTogglePasswordChange,
  editing,
  onToggleEdit
}) {
  return (
    <div className="profile-display">
      <div className="profile-field">
        <div className="profile-field-label">Name:</div>
        <div className="profile-field-value">{profile.displayName}</div>
      </div>

      <div className="profile-field">
        <div className="profile-field-label">Username:</div>
        <div className="profile-field-value">@{profile.username}</div>
      </div>

      {isOwnProfile && (
        <div className="profile-field">
          <div className="profile-field-label">Email:</div>
          <div className="profile-field-value">{user.email}</div>
        </div>
      )}

      {profile.bio && (
        <div className="profile-field">
          <div className="profile-field-label">Bio:</div>
          <div className="profile-bio-content">{profile.bio}</div>
        </div>
      )}

      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat-number">
            {profile.friends ? profile.friends.length : 0}
          </div>
          <div className="profile-stat-label">Friends</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-number">
            {profile.friendRequests ? profile.friendRequests.length : 0}
          </div>
          <div className="profile-stat-label">Requests</div>
        </div>
      </div>

      {isOwnProfile && (
        <div className="profile-actions-row">
          <button
            onClick={onToggleEdit}
            className="profile-action-button profile-edit-inline-button"
          >
            {editing ? "Cancel Edit" : "Edit Profile"}
          </button>

          <button
            onClick={onTogglePasswordChange}
            className="profile-action-button profile-password-button"
          >
            Change Password
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileDisplay;
