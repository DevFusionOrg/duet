import React from "react";

function FriendsView({ friends, loading, onStartChat, onFriendCardClick }) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading friends...</p>
      </div>
    );
  }

  if (!friends || friends.length === 0) {
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
      {friends.map((friend) => (
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
            <div className="online-indicator"></div>
          </div>

          <div className="friend-info">
            <h3 className="friend-name">{friend.displayName}</h3>
            <p className="friend-username">@{friend.username}</p>
            {friend.bio && <p className="friend-bio">{friend.bio}</p>}
          </div>

          <button onClick={() => onStartChat(friend)} className="chat-button">
            <span className="chat-icon">💬</span>
            Chat
          </button>
        </div>
      ))}
    </div>
  );
}

export default FriendsView;
