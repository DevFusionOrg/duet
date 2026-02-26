import React from "react";

function ProfileDisplay({ 
  profile, 
  isOwnProfile, 
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
        <div className="profile-field-value">
          {profile.displayName}
        </div>
      </div>

      <div className="profile-field">
        <div className="profile-field-label">Username:</div>
        <div className="profile-field-value">@{profile.username}</div>
      </div>

      {profile.bio && (
        <div className="profile-field">
          <div className="profile-field-label">Bio:</div>
          <div className="profile-bio-content">{profile.bio}</div>
        </div>
      )}

      {isOwnProfile && (
        <div className="profile-actions-row">
          <button
            onClick={onToggleEdit}
            className="profile-action-button profile-edit-inline-button"
          >
            {editing ? "Cancel Edit" : "Edit Profile"}
          </button>
          {onTogglePasswordChange && (
            <button
              onClick={onTogglePasswordChange}
              className="profile-action-button profile-password-button"
            >
              Change Password
            </button>
          )}
        </div>
      )}

      {}
    </div>
  );
}

export default ProfileDisplay;
