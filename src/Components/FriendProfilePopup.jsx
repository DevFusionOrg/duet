import React from 'react';
import UserBadge from './UserBadge';
import '../styles/FriendProfilePopup.css';

function FriendProfilePopup({ friend, onClose, onStartChat }) {
  if (!friend) return null;

  const displayBadge = friend.badge || (friend.username === 'ashwinirai492' ? 'tester' : null);

  const handleStartChat = () => {
    if (onStartChat) {
      onStartChat(friend);
    }
    onClose();
  };

  return (
    <div className="friend-popup-overlay" onClick={onClose}>
      <div className="friend-popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="friend-popup-close" onClick={onClose}>×</button>
        
        <div className="friend-popup-header">
          <div className="friend-popup-avatar-wrapper">
            <img 
              src={friend.photoURL || '/default-avatar.png'} 
              alt={friend.displayName}
              className="friend-popup-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.png";
              }}
            />
          </div>
        </div>

        <div className="friend-popup-info">
          <h2 className="friend-popup-name">
            {friend.displayName}
            {displayBadge && <UserBadge badge={displayBadge} size="small" />}
          </h2>
          <p className="friend-popup-username">@{friend.username || 'user'}</p>
          
          {friend.bio && (
            <div className="friend-popup-bio">
              <p>{friend.bio}</p>
            </div>
          )}

          <button className="friend-popup-chat-btn" onClick={handleStartChat}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default FriendProfilePopup;
