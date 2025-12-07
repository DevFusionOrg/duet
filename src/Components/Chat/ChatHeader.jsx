import React from "react";

function ChatHeader({ 
  user, 
  friend, 
  onBack, 
  isBlocked, 
  isFriendOnline, 
  lastSeen,
  onToggleUserMenu,
  showUserMenu,
  onBlockUser,
  onDeleteChat,
  onToggleMusicPlayer,
  onInitiateAudioCall,
  loading,
  isInCall,
  callState
}) {

  const getLastSeenText = () => {
    if (isFriendOnline) return "Online";

    if (lastSeen) {
      const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return lastSeenDate.toLocaleDateString();
    }

    return "Offline";
  };

  return (
    <div className="chat-header">
      <button onClick={onBack} className="chat-back-button">
        <svg aria-label="Close" className="x1lliihq x1n2onr6 x9bdzbf" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18">
          <title>Close</title>
          <polyline fill="none" points="20.643 3.357 12 12 3.353 20.647" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></polyline>
          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="20.649" x2="3.354" y1="20.649" y2="3.354"></line>
        </svg>
      </button>
      
      <div className="chat-user-info">
        <div className="chat-avatar-with-status">
          <img
            src={friend.photoURL}
            alt={friend.displayName}
            className={`chat-user-avatar ${isBlocked ? 'blocked-user' : ''}`}
          />
          <div className={`chat-online-indicator ${isFriendOnline ? 'online' : 'offline'} ${isBlocked ? 'blocked' : ''}`}></div>
        </div>
        <div>
          <h3 className="chat-user-name">
            {friend.displayName}
            {isBlocked && <span className="blocked-badge"> (Blocked)</span>}
          </h3>
          <p className={`user-status ${isFriendOnline ? 'online' : 'offline'} ${isBlocked ? 'blocked' : ''}`}>
            {isBlocked ? 'Blocked' : (isFriendOnline ? 'Online' : getLastSeenText())}
          </p>
        </div>
      </div>
      
      <div className="chat-header-actions">
        <button
          onClick={onToggleUserMenu}
          className="chat-user-menu-button"
          title="More options"
        >
          <svg aria-label="More options" className="x1lliihq x1n2onr6 x9bdzbf" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>More options</title>
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="6" cy="12" r="1.5"></circle>
            <circle cx="18" cy="12" r="1.5"></circle>
          </svg>
        </button>
        
        {showUserMenu && (
          <div className="chat-user-dropdown-menu">
            <button
              onClick={onBlockUser}
              className="chat-menu-item block-button"
            >
              {isBlocked ? "Unblock User" : "Block User"}
            </button>
            <button
              onClick={onDeleteChat}
              className="chat-menu-item delete-button"
            >
              Delete Chat
            </button>
          </div>
        )}
      </div>
      
      <button
        onClick={onToggleMusicPlayer}
        className="chat-music-button"
        disabled={loading}
      >
        <svg aria-label="Reels" className="x1lliihq x1n2onr6 x5n08af" height="24" viewBox="0 0 24 24" width="24">
          <title>Music</title>
          <path d="M22.935 7.468c-.063-1.36-.307-2.142-.512-2.67a5.341 5.341 0 0 0-1.27-1.95 5.345 5.345 0 0 0-1.95-1.27c-.53-.206-1.311-.45-2.672-.513C15.333 1.012 14.976 1 12 1s-3.333.012-4.532.065c-1.36.063-2.142.307-2.67.512-.77.298-1.371.69-1.95 1.27a5.36 5.36 0 0 0-1.27 1.95c-.206.53-.45 1.311-.513 2.672C1.012 8.667 1 9.024 1 12s.012 3.333.065 4.532c.063 1.36.307 2.142.512 2.67.297.77.69 1.372 1.27 1.95.58.581 1.181.974 1.95 1.27.53.206 1.311.45 2.672.513C8.667 22.988 9.024 23 12 23s3.333-.012 4.532-.065c1.36-.063 2.142-.307 2.67-.512a5.33 5.33 0 0 0 1.95-1.27a5.356 5.356 0 0 0 1.27-1.95c.206-.53.45-1.311.513-2.672.053-1.198.065-1.555.065-4.531s-.012-3.333-.065-4.532Zm-1.998 8.972c-.05 1.07-.228 1.652-.38 2.04-.197.51-.434.874-.82 1.258a3.362 3.362 0 0 1-1.258.82c-.387.151-.97.33-2.038.379-1.162.052-1.51.063-4.441.063s-3.28-.01-4.44-.063c-1.07-.05-1.652-.228-2.04-.38a3.354 3.354 0 0 1-1.258-.82 3.362 3.362 0 0 1-.82-1.258c-.151-.387-.33-.97-.379-2.038C3.011 15.28 3 14.931 3 12s.01-3.28.063-4.44c.05-1.07.228-1.652.38-2.04.197-.51.434-.875.82-1.26a3.372 3.372 0 0 1 1.258-.819c.387-.15.97-.329 2.038-.378C8.72 3.011 9.069 3 12 3s3.28.01 4.44.063c1.07.05 1.652.228 2.04.38.51.197.874.433 1.258.82.385.382.622.747.82 1.258.151.387.33.97.379 2.038C20.989 8.72 21 9.069 21 12s-.01 3.28-.063 4.44Zm-4.584-6.828-5.25-3a2.725 2.725 0 0 0-2.745.01A2.722 2.722 0 0 0 6.988 9v6c0 .992.512 1.88 1.37 2.379.432.25.906.376 1.38.376.468 0 .937-.123 1.365-.367l5.25-3c.868-.496 1.385-1.389 1.385-2.388s-.517-1.892-1.385-2.388Zm-.993 3.04-5.25 3a.74.74 0 0 1-.748-.003.74.74 0 0 1-.374-.649V9a.74.74 0 0 1 .374-.65.737.737 0 0 1 .748-.002l5.25 3c.341.196.378.521.378.652s-.037.456-.378.651Z"></path>
        </svg>
      </button>
      
      <button
        onClick={onInitiateAudioCall}
        className="chat-call-button"
        title="Audio call"
        disabled={isBlocked || loading || isInCall || callState !== 'idle'}
      >
        <svg aria-label="Audio call" fill="currentColor" height="24" width="24" viewBox="0 0 24 24">
          <path d="M18.227 22.912c-4.913 0-9.286-3.627-11.486-5.828C4.486 14.83.731 10.291.921 5.231a3.289 3.289 0 0 1 .908-2.138 17.116 17.116 0 0 1 1.865-1.71a2.307 2.307 0 0 1 3.004.174 13.283 13.283 0 0 1 3.658 5.325 2.551 2.551 0 0 1-.19 1.941l-.455.853a.463.463 0 0 0-.024.387 7.57 7.57 0 0 0 4.077 4.075.455.455 0 0 0 .386-.024l.853-.455a2.548 2.548 0 0 1 1.94-.19 13.278 13.278 0 0 1 5.326 3.658 2.309 2.309 0 0 1 .174 3.003 17.319 17.319 0 0 1-1.71 1.866 3.29 3.29 0 0 1-2.138.91 10.27 10.27 0 0 1-.368.006Zm-13.144-20a.27.27 0 0 0-.167.054A15.121 15.121 0 0 0 3.28 4.47a1.289 1.289 0 0 0-.36.836c-.161 4.301 3.21 8.34 5.235 10.364s6.06 5.403 10.366 5.236a1.284 1.284 0 0 0 .835-.36 15.217 15.217 0 0 0 1.504-1.637.324.324 0 0 0-.047-.41 11.62 11.62 0 0 0-4.457-3.119.545.545 0 0 0-.411.044l-.854.455a2.452 2.452 0 0 1-2.071.116 9.571 9.571 0 0 1-5.189-5.188 2.457 2.457 0 0 1 .115-2.071l.456-.855a.544.544 0 0 0 .043-.41 11.629 11.629 0 0 0-3.118-4.458.36.36 0 0 0-.244-.1Z"></path>
        </svg>
      </button>
    </div>
  );
}

export default ChatHeader;