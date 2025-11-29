import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { getUserFriends, listenToUserChats, listenToUserProfile } from "../firebase/firestore";
import Chat from "./Chat";
import '../styles/Home.css';

function Home({ user }) {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeView, setActiveView] = useState('friends');
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    if (!user) return;

    const loadFriends = async () => {
      try {
        const friendsList = await getUserFriends(user.uid);
        setFriends(friendsList);
        setLoading(false);
      } catch (error) {
        console.error("Error loading friends:", error);
        setLoading(false);
      }
    };

    loadFriends();
  }, [user]);

  // Listen to notification count from user profile
  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserProfile(user.uid, (profile) => {
      // Profile listener to keep connection alive for notifications
      if (profile && profile.friendRequests) {
        // Pending count tracked in profile for UI badge if needed
      }
    });

    return unsubscribe;
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error logging out:", error);
    }
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
      {/* Side Pane */}
      <div className="side-pane">
        <div className="pane-header">
          <div className="user-profile-section">
            <img 
              src={user?.photoURL} 
              alt={user?.displayName}
              className="user-avatar"
            />
            <div className="user-info">
              <h3 className="user-name">{user?.displayName}</h3>
              <p className="user-status">Online</p>
            </div>
          </div>
        </div>

        <nav className="pane-nav">
          <button 
            className={`nav-item ${activeView === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveView('friends')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-text">Friends</span>
            {friends.length > 0 && <span className="nav-badge">{friends.length}</span>}
          </button>
          <button 
            className={`nav-item ${activeView === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveView('chats')}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-text">Chats</span>
            {chats.length > 0 && <span className="nav-badge">{chats.length}</span>}
          </button>
          <button 
            className={`nav-item ${activeView === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveView('notifications')}
            title="View notifications"
          >
            <span className="nav-icon">🔔</span>
            <span className="nav-text">Notifications</span>
          </button>
          <button 
            className={`nav-item ${showProfilePopup && !selectedProfile ? 'active' : ''}`}
            onClick={() => setShowProfilePopup(true)}
            title="View profile"
          >
            <span className="nav-icon">👤</span>
            <span className="nav-text">Profile</span>
          </button>
        </nav>

        <div className="pane-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            <span className="nav-text">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="welcome-section">
          <h1 className="welcome-title">
            {activeView === 'friends' && `Welcome ${user?.displayName}! 🎵`}
            {activeView === 'chats' && 'Messages with Friends 💬'}
            {activeView === 'notifications' && 'Friend Requests 🔔'}
          </h1>
        </div>

        <div className="content-area">
          {activeView === 'friends' ? (
            <FriendsView 
              friends={friends} 
              loading={loading} 
              onStartChat={handleStartChat}
              onFriendCardClick={handleFriendCardClick}
            />
          ) : activeView === 'chats' ? (
            <ChatsView 
              chats={chats} 
              loading={loading} 
              onStartChat={handleStartChat}
            />
          ) : activeView === 'notifications' ? (
            <NotificationsView user={user} />
          ) : null}
        </div>
      </div>

      {/* Profile Popup */}
      {showProfilePopup && (
        <ProfilePopup 
          friend={selectedProfile || user}
          isOwnProfile={!selectedProfile}
          onClose={handleCloseProfilePopup}
        />
      )}
    </div>
  );
}

export default Home;

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
function ProfilePopup({ friend, isOwnProfile, onClose }) {
  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>{isOwnProfile ? 'My Profile' : 'Profile'}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="popup-content">
          <div className="profile-picture-section">
            <img 
              src={friend?.photoURL} 
              alt={friend?.displayName}
              className="profile-picture-large"
            />
          </div>

          <div className="profile-info">
            <div className="info-field">
              <label>Name:</label>
              <span>{friend?.displayName}</span>
            </div>
            
            <div className="info-field">
              <label>Username:</label>
              <span>@{friend?.username}</span>
            </div>
            
            {friend?.email && (
              <div className="info-field">
                <label>Email:</label>
                <span>{friend?.email}</span>
              </div>
            )}
            
            {friend?.bio && (
              <div className="info-field">
                <label>Bio:</label>
                <span className="bio-text">{friend?.bio}</span>
              </div>
            )}
            
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">{friend?.friends ? friend?.friends.length : 0}</span>
                <span className="stat-label">Friends</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Notifications View Component
function NotificationsView({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState({});
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserProfile(user.uid, (userProfile) => {
      setProfile(userProfile);
    });

    return unsubscribe;
  }, [user]);

  const handleAccept = async (requestFromId, requesterName) => {
    const requestKey = `${requestFromId}_accept`;

    if (processedRequests.has(requestKey)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { acceptFriendRequest } = await import("../firebase/firestore");
      await acceptFriendRequest(user.uid, requestFromId);

      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`✅ Accepted friend request from ${requesterName}`);

      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      setActionMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  const handleReject = async (requestFromId, requesterName) => {
    const requestKey = `${requestFromId}_reject`;

    if (processedRequests.has(requestKey)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { rejectFriendRequest } = await import("../firebase/firestore");
      await rejectFriendRequest(user.uid, requestFromId);

      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`✅ Rejected friend request from ${requesterName}`);

      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      setActionMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  if (!profile) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading notifications...</p>
      </div>
    );
  }

  const pendingRequests =
    profile.friendRequests?.filter((req) => req.status === "pending") || [];

  return (
    <div className="notifications-container">

      {actionMessage && (
        <div className="action-message">
          {actionMessage}
        </div>
      )}

      {pendingRequests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Pending Requests</h3>
          <p>You're all caught up!</p>
        </div>
      ) : (
        <div className="friend-requests-list">
          {pendingRequests.map((request) => (
            <div key={request.id} className="friend-request-item">
              <div className="request-user-info">
                <img
                  src={request.photoURL || '/default-avatar.png'}
                  alt={request.displayName}
                  className="request-avatar"
                />
                <div className="request-details">
                  <h4>{request.displayName}</h4>
                  <p className="request-username">@{request.username}</p>
                </div>
              </div>
              <div className="request-actions">
                <button
                  onClick={() =>
                    handleAccept(request.id, request.displayName)
                  }
                  disabled={loading[`${request.id}_accept`]}
                  className="accept-btn"
                >
                  {loading[`${request.id}_accept`] ? "..." : "✓ Accept"}
                </button>
                <button
                  onClick={() =>
                    handleReject(request.id, request.displayName)
                  }
                  disabled={loading[`${request.id}_reject`]}
                  className="reject-btn"
                >
                  {loading[`${request.id}_reject`] ? "..." : "✕ Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}