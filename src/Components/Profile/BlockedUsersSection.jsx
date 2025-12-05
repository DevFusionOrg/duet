import React from "react";

function BlockedUsersSection({ 
  blockedUsers, 
  loadingBlockedUsers, 
  onShowBlockedUsers,
  isOwnProfile 
}) {
  if (!isOwnProfile) return null;

  return (
    <div className="profile-blocked-section">
      <div className="profile-blocked-header">
        <h4 className="profile-blocked-title">Blocklist</h4>
        <div className="profile-blocked-count">
          {blockedUsers.length} user{blockedUsers.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <button
        onClick={onShowBlockedUsers}
        className="profile-manage-blocked-button"
        disabled={loadingBlockedUsers}
      >
        {loadingBlockedUsers ? "Loading..." : "Manage"}
      </button>
    </div>
  );
}

export default BlockedUsersSection;