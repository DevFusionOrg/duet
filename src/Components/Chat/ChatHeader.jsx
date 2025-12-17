import React from "react";
import VideoCallButton from '../Call/VideoCallButton'; // ADD THIS

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
  onInitiateVideoCall, // NEW: Add this prop
  loading,
  isInCall,
  callState,
  isVideoCallActive // NEW: Add this prop
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
            src={friend.photoURL || '/default-avatar.png'}
            alt={friend.displayName}
            className={`chat-user-avatar ${isBlocked ? 'blocked-user' : ''}`}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/default-avatar.png';
            }}
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
        title="Music"
        disabled={loading}
      >
        <svg aria-label="Music" fill="currentColor" height="22" width="22" viewBox="0 0 24 24">
          <path d="M9 18.5a2.5 2.5 0 1 1-1-2v-8.4l8-2.1v5.1a2.5 2.5 0 1 1-1 2v-5.2l-6 1.6v6.1a2.5 2.5 0 0 1-2 2.4Z"/>
        </svg>
      </button>
      
      <button
        onClick={onInitiateAudioCall}
        className="chat-call-button"
        title="Audio call"
        disabled={isBlocked || loading || isInCall || callState !== 'idle' || isVideoCallActive}
      >
        <svg aria-label="Audio call" fill="currentColor" height="24" width="24" viewBox="0 0 24 24">
          <path d="M18.227 22.912c-4.913 0-9.286-3.627-11.486-5.828C4.486 14.83.731 10.291.921 5.231a3.289 3.289 0 0 1 .908-2.138 17.116 17.116 0 0 1 1.865-1.71a2.307 2.307 0 0 1 3.004.174 13.283 13.283 0 0 1 3.658 5.325 2.551 2.551 0 0 1-.19 1.941l-.455.853a.463.463 0 0 0-.024.387 7.57 7.57 0 0 0 4.077 4.075.455.455 0 0 0 .386-.024l.853-.455a2.548 2.548 0 0 1 1.94-.19 13.278 13.278 0 0 1 5.326 3.658 2.309 2.309 0 0 1 .174 3.003 17.319 17.319 0 0 1-1.71 1.866 3.29 3.29 0 0 1-2.138.91 10.27 10.27 0 0 1-.368.006Zm-13.144-20a.27.27 0 0 0-.167.054A15.121 15.121 0 0 0 3.28 4.47a1.289 1.289 0 0 0-.36.836c-.161 4.301 3.21 8.34 5.235 10.364s6.06 5.403 10.366 5.236a1.284 1.284 0 0 0 .835-.36 15.217 15.217 0 0 0 1.504-1.637.324.324 0 0 0-.047-.41 11.62 11.62 0 0 0-4.457-3.119.545.545 0 0 0-.411.044l-.854.455a2.452 2.452 0 0 1-2.071.116 9.571 9.571 0 0 1-5.189-5.188 2.457 2.457 0 0 1 .115-2.071l.456-.855a.544.544 0 0 0 .043-.41 11.629 11.629 0 0 0-3.118-4.458.36.36 0 0 0-.244-.1Z"></path>
        </svg>
      </button>
      
      <VideoCallButton
        onClick={onInitiateVideoCall}
        disabled={isBlocked || loading || isInCall || callState !== 'idle' || isVideoCallActive}
        title="Video call"
      />
    </div>
  );
}

export default ChatHeader;