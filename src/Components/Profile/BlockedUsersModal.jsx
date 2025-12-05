import React from "react";

function BlockedUsersModal({ 
  showBlockedUsers, 
  blockedUsers, 
  loadingBlockedUsers, 
  loading,
  onClose,
  onUnblockUser 
}) {
  if (!showBlockedUsers) return null;

  return (
    <div className="blocked-users-modal-overlay">
      <div className="blocked-users-modal">
        <div className="blocked-users-modal-header">
          <h3>Blocklist ({blockedUsers.length})</h3>
          <button 
            onClick={onClose}
            className="blocked-users-close-button"
          >
            ×
          </button>
        </div>
        
        <div className="blocked-users-modal-content">
          {loadingBlockedUsers ? (
            <div className="blocked-users-loading">
              <p>Loading blocked users...</p>
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="no-blocked-users">
              <p>No user blocked</p>
            </div>
          ) : (
            <div className="blocked-users-list">
              {blockedUsers.map((blockedUser) => (
                <div key={blockedUser.uid} className="blocked-user-item">
                  <img 
                    src={blockedUser.photoURL || "/default-avatar.png"} 
                    alt={blockedUser.displayName}
                    className="blocked-user-avatar"
                  />
                  <div className="blocked-user-info">
                    <div className="blocked-user-name">{blockedUser.displayName}</div>
                    <div className="blocked-user-username">@{blockedUser.username}</div>
                  </div>
                  <button
                    onClick={() => onUnblockUser(blockedUser.uid)}
                    disabled={loading}
                    className="unblock-user-button"
                  >
                    {loading ? "Processing..." : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="blocked-users-modal-footer">
          <button
            onClick={onClose}
            className="blocked-users-close-footer-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BlockedUsersModal;