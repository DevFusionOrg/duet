import React from "react";

function ChatsView({ chats, loading, onStartChat }) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading chats...</p>
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">💬</div>
        <h3>No Active Chats</h3>
        <p>Start a conversation with one of your friends!</p>
      </div>
    );
  }

  return (
    <div className="chats-list">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className="chat-item"
          onClick={() => onStartChat(chat.otherParticipant)}
        >
          <div className="chat-avatar-section">
            <img
              src={chat.otherParticipant.photoURL}
              alt={chat.otherParticipant.displayName}
              className="chat-avatar"
            />
            <div className="online-indicator"></div>
          </div>

          <div className="chat-info">
            <div className="chat-header">
              <h4 className="chat-name">{chat.otherParticipant.displayName}</h4>
              <span className="chat-time">
                {chat.lastMessageAt?.toDate?.()?.toLocaleDateString() || "New"}
              </span>
            </div>
            <p className="last-message">{chat.lastMessage || "Start a conversation..."}</p>
          </div>

          {chat.unreadCount > 0 && <div className="unread-badge">{chat.unreadCount}</div>}
        </div>
      ))}
    </div>
  );
}

export default ChatsView;
