import React from "react";
import UserBadge from "../UserBadge";

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
        <div className="profile-field-value badge-with-name">
          {profile.displayName}
          {isOwnProfile && (() => {
            const role = (profile.badge || (profile.username === 'ashwinirai492' ? 'tester' : null));
            if (!role) return null;
            const titleMap = { developer: 'Developer', support: 'Support', tester: 'Tester' };
            return (
              <span className={`role-chip role-chip-${role}`} style={{ marginLeft: 8 }}>
                <span className="role-chip-text">{titleMap[role]}</span>
                <UserBadge badge={role} size="small" />
              </span>
            );
          })()}
        </div>
      </div>

      <div className="profile-field">
        <div className="profile-field-label">Username:</div>
        <div className="profile-field-value">
          @{profile.username}
          {profile.username === 'ashwinirai492' && (
            <span style={{ marginLeft: 6 }}>
              <UserBadge badge="tester" size="small" />
            </span>
          )}
        </div>
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
