import React from 'react';

function ChatsView({ chats, loading, onStartChat, friendsOnlineStatus }) {
  const formatChatTimestamp = (timestamp) => {
    if (!timestamp) return 'New';
    
    try {
      const messageDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
      
      if (messageDay.getTime() === today.getTime()) {
        return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (messageDay.getTime() === yesterday.getTime()) {
        return 'Yesterday';
      }
      
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (error) {
      return 'New';
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading chats...</p>
      </div>
    );
  }

  if (chats.length === 0) {
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
      {chats.map(chat => {
        const lastMessagePreview = chat.lastMessage || 'Start a conversation...';
        
        return (
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
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.png";
              }}
              />
              <div className={`online-indicator ${friendsOnlineStatus[chat.otherParticipant.uid] ? 'online' : 'offline'}`}></div>
            </div>
            
            <div className="chat-info">
              <div className="chat-header">
                <h4 className="chat-name">{chat.otherParticipant.displayName}</h4>
                <span className="chat-time">
                  {formatChatTimestamp(chat.lastMessageAt)}
                </span>
              </div>
              <p className="last-message">
                {lastMessagePreview.length > 40 
                  ? lastMessagePreview.substring(0, 40) + '...' 
                  : lastMessagePreview}
              </p>
            </div>
            
            {chat.unreadCount > 0 && (
              <div className="unread-badge">
                {chat.unreadCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ChatsView;