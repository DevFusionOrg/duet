import React from 'react';

function FriendsView({ friends, loading, onStartChat, onFriendCardClick, friendsOnlineStatus }) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading friends...</p>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <h3>No Friends Yet</h3>
        <p>Go to the Search page to find and add friends!</p>
      </div>
    );
  }

  return (
    <div className="friends-grid">
      {friends.map(friend => (
        <div 
          key={friend.uid} 
          className="friend-card"
          onClick={(e) => onFriendCardClick(friend, e)}
        >
          <div className="friend-avatar-section">
            <img 
              src={friend.photoURL} 
              alt={friend.displayName}
              className="friend-avatar"
            />
            <div className={`online-indicator ${friendsOnlineStatus[friend.uid] ? 'online' : 'offline'}`}></div>
          </div>
          
          <div className="friend-info">
            <h3 className="friend-name">{friend.displayName}</h3>
            <p className="friend-username">@{friend.username}</p>
            {friend.bio && (
              <p className="friend-bio">{friend.bio}</p>
            )}
          </div>

          <button 
            onClick={() => onStartChat(friend)}
            className="chat-button"
          >
            <svg aria-label="Messages" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Messages</title><path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"></path><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="7.488" x2="15.515" y1="12.208" y2="7.641"></line></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default FriendsView;