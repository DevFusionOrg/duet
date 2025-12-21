import React, { useState } from 'react';
import UserBadge from '../UserBadge';
import FriendProfilePopup from '../FriendProfilePopup';
import '../../styles/Home.css';

function RecentlyActiveFriends({ friends, friendsOnlineStatus, onStartChat }) {
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedFriend, setSelectedFriend] = useState(null);

  const handleBadgeClick = (e, badgeName) => {
    e.stopPropagation();
    const badgeNames = { 
      developer: 'Developer', 
      support: 'Supporter', 
      tester: 'Tester' 
    };
    setShowBadgeTooltip(badgeNames[badgeName] || badgeName);

    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });

    setTimeout(() => setShowBadgeTooltip(null), 3000);
  };

  const sortedFriends = [...friends].sort((a, b) => {
    const aOnline = friendsOnlineStatus[a.uid] || false;
    const bOnline = friendsOnlineStatus[b.uid] || false;

    if (aOnline !== bOnline) {
      return aOnline ? -1 : 1;
    }

    const aLastSeen = a.lastSeen?.toDate?.() || a.lastSeen || new Date(0);
    const bLastSeen = b.lastSeen?.toDate?.() || b.lastSeen || new Date(0);
    
    return new Date(bLastSeen) - new Date(aLastSeen);
  });

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="recently-active-section">
      <h2 className="section-title">Recently Active</h2>
      <div className="recently-active-list">
        {sortedFriends.slice(0, 5).map(friend => {
          const isOnline = friendsOnlineStatus[friend.uid];
          
          return (
            <div 
              key={friend.uid} 
              className="active-friend-item"
              onClick={() => setSelectedFriend(friend)}
              style={{ cursor: 'pointer' }}
            >
              <div className="active-friend-avatar-wrapper">
                <img
                  src={friend.photoURL || '/default-avatar.png'}
                  alt={friend.displayName}
                  className="active-friend-avatar"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/default-avatar.png';
                  }}
                />
                {isOnline && <div className="active-online-dot"></div>}
              </div>

              <div className="active-friend-details">
                <div className="active-friend-name badge-with-name">
                  {friend.displayName}
                  {(() => {
                    const displayBadge = friend.badge || (friend.username === 'ashwinirai492' ? 'tester' : null);
                    if (!displayBadge) return null;
                    
                    const badgeNames = { 
                      developer: 'Developer', 
                      support: 'Supporter', 
                      tester: 'Tester' 
                    };
                    
                    return (
                      <span 
                        className="badge-tooltip-wrapper"
                        title={badgeNames[displayBadge] || displayBadge}
                        onClick={(e) => handleBadgeClick(e, displayBadge)}
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <UserBadge badge={displayBadge} size="small" />
                      </span>
                    );
                  })()}
                </div>
                <div className="active-friend-status">
                  {isOnline ? (
                    <span className="online-text">Online now</span>
                  ) : (
                    <span className="offline-text">Active {formatLastSeen(friend.lastSeen)}</span>
                  )}
                </div>
              </div>

              <button
                className="quick-chat-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartChat(friend);
                }}
                title="Start chat"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {showBadgeTooltip && (
        <div 
          className="badge-tooltip" 
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none'
          }}
        >
          {showBadgeTooltip}
        </div>
      )}

      {selectedFriend && (
        <FriendProfilePopup
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onStartChat={onStartChat}
        />
      )}
    </div>
  );
}

export default RecentlyActiveFriends;
