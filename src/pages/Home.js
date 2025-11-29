import React, { useState, useEffect } from "react";
import { getUserFriends, listenToUserChats } from "../firebase/firestore";
import Chat from "./Chat";
import '../styles/Home.css'; // We'll create this CSS file

function Home({ user }) {
  const [friends, setFriends] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeView, setActiveView] = useState('friends');
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    const loadFriends = async () => {
      if (user) {
        try {
          const friendsList = await getUserFriends(user.uid);
          setFriends(friendsList);
        } catch (error) {
          console.error("Error loading friends:", error);
        }
        setLoading(false);
      }
    };

    loadFriends();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserChats(user.uid, (userChats) => {
      setChats(userChats);
    });

    return unsubscribe;
  }, [user]);

  const handleStartChat = (friend) => {
    setSelectedFriend(friend);
  };

  const handleBackToFriends = () => {
    setSelectedFriend(null);
  };

  const handleFriendCardClick = (friend, e) => {
    // Only open profile if chat button wasn't clicked
    if (!e.target.closest('.chat-button')) {
      setSelectedProfile(friend);
      setShowProfilePopup(true);
    }
  };

  const handleCloseProfilePopup = () => {
    setShowProfilePopup(false);
    setSelectedProfile(null);
  };

  // If chat is open, show chat interface
  if (selectedFriend) {
    return (
      <Chat 
        user={user} 
        friend={selectedFriend} 
        onBack={handleBackToFriends}
      />
    );
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <div className="welcome-section">
          <h1 className="welcome-title">Welcome to Duet, {user?.displayName}! 🎵</h1>
          <p className="welcome-subtitle">Chat with friends and listen to music together in real-time.</p>
        </div>
        
        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${activeView === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveView('friends')}
          >
            <span className="toggle-icon">👥</span>
            Friends ({friends.length})
          </button>
          <button
            className={`toggle-btn ${activeView === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveView('chats')}
          >
            <span className="toggle-icon">💬</span>
            Chats ({chats.length})
          </button>
        </div>
      </div>

      <div className="home-content">
        {activeView === 'friends' ? (
          <FriendsView 
            friends={friends} 
            loading={loading} 
            onStartChat={handleStartChat}
            onFriendCardClick={handleFriendCardClick}
          />
        ) : (
          <ChatsView 
            chats={chats} 
            loading={loading} 
            onStartChat={handleStartChat}
          />
        )}
      </div>

      {/* Profile Popup */}
      {showProfilePopup && selectedProfile && (
        <ProfilePopup 
          friend={selectedProfile}
          onClose={handleCloseProfilePopup}
        />
      )}
    </div>
  );
}

// Friends View Component
function FriendsView({ friends, loading, onStartChat, onFriendCardClick }) {
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
            <div className="online-indicator"></div>
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
            <span className="chat-icon">💬</span>
            Chat
          </button>
        </div>
      ))}
    </div>
  );
}

// Chats View Component
function ChatsView({ chats, loading, onStartChat }) {
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
      {chats.map(chat => (
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
                {chat.lastMessageAt?.toDate?.()?.toLocaleDateString() || 'New'}
              </span>
            </div>
            <p className="last-message">
              {chat.lastMessage || 'Start a conversation...'}
            </p>
          </div>
          
          {chat.unreadCount > 0 && (
            <div className="unread-badge">
              {chat.unreadCount}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Profile Popup Component
function ProfilePopup({ friend, onClose }) {
  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Profile</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="popup-content">
          <div className="profile-picture-section">
            <img 
              src={friend.photoURL} 
              alt={friend.displayName}
              className="profile-picture-large"
            />
          </div>

          <div className="profile-info">
            <div className="info-field">
              <label>Name:</label>
              <span>{friend.displayName}</span>
            </div>
            
            <div className="info-field">
              <label>Username:</label>
              <span>@{friend.username}</span>
            </div>
            
            {friend.email && (
              <div className="info-field">
                <label>Email:</label>
                <span>{friend.email}</span>
              </div>
            )}
            
            {friend.bio && (
              <div className="info-field">
                <label>Bio:</label>
                <span className="bio-text">{friend.bio}</span>
              </div>
            )}
            
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">{friend.friends ? friend.friends.length : 0}</span>
                <span className="stat-label">Friends</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;