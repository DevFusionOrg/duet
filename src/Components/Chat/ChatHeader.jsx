import React from "react";
import VideoCallButton from '../Call/VideoCallButton'; 

function ChatHeader({ 
  user, 
  friend, 
  onBack, 
  showBackButton = true,
  showCloseButton = false,
  onCloseChat,
  isBlocked, 
  isFriendOnline,
  isFriendTyping, 
  lastSeen,
  onOpenProfile,
  onToggleUserMenu,
  showUserMenu,
  onBlockUser,
  onDeleteChat,
  onToggleMusicPlayer,
  onInitiateAudioCall,
  onInitiateVideoCall, 
  loading,
  isInCall,
  callState,
  isVideoCallActive 
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

  const getStatusText = () => {
    if (isBlocked) return 'Blocked';
    if (isFriendTyping) return 'typing...';
    if (isFriendOnline) return 'Online';
    return getLastSeenText();
  };

  return (
    <div className="chat-header">
      {showBackButton && (
        <button onClick={onBack} className="chat-back-button">
          <svg aria-label="Back" fill="none" height="24" role="img" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
            <title>Back</title>
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {showCloseButton && (
        <button
          onClick={onCloseChat}
          className="chat-close-button"
          title="Close chat"
        >
          <svg aria-label="Back" fill="none" height="24" role="img" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
          <title>Back</title>
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
      )}
      
      <button
        type="button"
        className={`chat-user-info ${onOpenProfile ? 'clickable' : ''}`}
        onClick={onOpenProfile}
      >
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
          <p className={`user-status ${isFriendTyping ? 'typing' : (isFriendOnline ? 'online' : 'offline')} ${isBlocked ? 'blocked' : ''}`}>
            {getStatusText()}
          </p>
        </div>
      </button>
      
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
        <svg aria-label="Music" fill="currentColor" height="24" width="24" viewBox="0 0 24 24">
          <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z"/>
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