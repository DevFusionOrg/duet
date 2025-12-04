import React from "react";

function ProfileDisplay({ 
  profile, 
  isOwnProfile, 
  user,
  blockedUsers,
  loadingBlockedUsers,
  onShowBlockedUsers,
  onTogglePasswordChange 
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

      {/* Blocked Users Section - Only show on own profile */}
      {isOwnProfile && (
        <div className="profile-blocked-section">
          <div className="profile-blocked-header">
            <h4 className="profile-blocked-title">Blocked Users</h4>
            <div className="profile-blocked-count">
              {blockedUsers.length} user{blockedUsers.length !== 1 ? 's' : ''} blocked
            </div>
          </div>
          
          <div className="profile-blocked-description">
            <p>Blocked users cannot message you, call you, or see your profile.</p>
          </div>
          
          <button
            onClick={onShowBlockedUsers}
            className="profile-manage-blocked-button"
            disabled={loadingBlockedUsers}
          >
            {loadingBlockedUsers ? "Loading..." : "Manage Blocked Users"}
          </button>
        </div>
      )}

      {isOwnProfile && !onTogglePasswordChange && (
        <button
          onClick={onTogglePasswordChange}
          className="profile-password-button"
        >
          Change Password
        </button>
      )}
    </div>
  );
}

export default ProfileDisplay;