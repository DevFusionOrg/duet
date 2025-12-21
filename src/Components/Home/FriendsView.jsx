import React, { useState } from 'react';
import DevFusionModal from './DevFusionModal';
import UserBadge from '../UserBadge';
import FriendProfilePopup from '../FriendProfilePopup';
import LoadingScreen from '../LoadingScreen';
import { deleteFriend } from '../../firebase/firestore';

function FriendsView({ friends, loading, onStartChat, onFriendCardClick, friendsOnlineStatus, currentUserId, hideHeaders = false, hideHeading = false, hideGrid = false, allowRemove = false }) {
  const [showDevFusionModal, setShowDevFusionModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);

  if (loading) {
    return <LoadingScreen message="Loading friends..." size="medium" />;
  }

  return (
    <div className="friends-container">
      {!hideHeaders && (
        <>
          <div className='home-title'>
            <img className="home-img" src="./logo512.png" alt="Duet Logo" />
            <h1 className="SearchHeading appname">Duet</h1>
            <button 
              className="company-logo-btn" 
              onClick={() => setShowDevFusionModal(true)}
              title="About DevFusion"
            >
              <img className="company-logo" src="./DevFusion.png" alt="DevFusion Logo" />
            </button>
          </div>
          {!hideHeading && <h1 className="SearchHeading">Connections</h1>}
        </>
      )}

      {!hideGrid && (
      <div className="friends-grid">
        {friends.map(friend => {
          const displayBadge = friend.badge || (friend.username === 'ashwinirai492' ? 'tester' : null);
          return (
          <div 
            key={friend.uid} 
            className="friend-card"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFriend(friend);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="friend-avatar-section">
              <img 
                src={friend.photoURL || '/default-avatar.png'}
                alt={friend.displayName}
                className="friend-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.png";
                }}
              />
              {displayBadge && <UserBadge badge={displayBadge} size="small" />}
              <div className={`online-indicator ${friendsOnlineStatus[friend.uid] ? 'online' : 'offline'}`}></div>
            </div>
            
            <div className="friend-info">
              <h3 className="friend-name badge-with-name">
                {friend.displayName}
                {displayBadge && <UserBadge badge={displayBadge} size="small" />}
              </h3>
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                onStartChat(friend);
              }}
              className="chat-button"
              title="Open chat"
              aria-label="Open chat"
            >
              <svg aria-label="Messages" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Messages</title><path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"></path><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="7.488" x2="15.515" y1="12.208" y2="7.641"></line></svg>
            </button>
            {allowRemove && (
              <button
                className="remove-friend-btn"
                title="Remove friend"
                aria-label="Remove friend"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!currentUserId || !friend?.uid) return;
                  const confirmed = window.confirm(`Remove ${friend.displayName || 'this user'} from your friends?`);
                  if (!confirmed) return;
                  try {
                    await deleteFriend(currentUserId, friend.uid);
                  } catch (err) {
                    alert(err?.message || 'Failed to remove friend');
                  }
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )})}
      </div>
      )}

      {!hideHeaders && (
        <DevFusionModal 
          isOpen={showDevFusionModal}
          onClose={() => setShowDevFusionModal(false)}
          currentUserId={currentUserId}
        />
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

export default FriendsView;