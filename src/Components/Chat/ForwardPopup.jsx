import React, { useState } from "react";

function ForwardPopup({
  friends,
  selectedFriends,
  onFriendSelection,
  onForwardMessages,
  onClose,
  forwarding
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFriends = friends.filter(friend =>
    friend.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="forward-popup-overlay">
      <div className="forward-popup">
        <div className="forward-header">
          <h3>Forward to...</h3>
          <button
            className="forward-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div className="forward-search">
          <input
            type="text"
            placeholder="Search friends..."
            className="forward-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="forward-friends-list">
          {filteredFriends.map((friend) => (
            <div key={friend.uid} className="forward-friend-item">
              <label className="forward-friend-label">
                <input
                  type="checkbox"
                  checked={selectedFriends.includes(friend.uid)}
                  onChange={() => onFriendSelection(friend.uid)}
                  className="forward-checkbox"
                />
                <img
                  src={friend.photoURL}
                  alt={friend.displayName}
                  className="forward-friend-avatar"
                />
                <div className="forward-friend-info">
                  <span className="forward-friend-name">
                    {friend.displayName}
                  </span>
                </div>
              </label>
            </div>
          ))}
        </div>
        
        <div className="forward-actions">
          <button
            onClick={onForwardMessages}
            disabled={selectedFriends.length === 0 || forwarding}
            className="forward-button"
          >
            {forwarding
              ? "Forwarding..."
              : `Forward ${selectedFriends.length > 0 ? `(${selectedFriends.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForwardPopup;