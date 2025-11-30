import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { getUserFriends, listenToUserChats, listenToUserProfile } from "../firebase/firestore";
import { openUploadWidget } from "../services/cloudinary";
import { updateProfile } from "firebase/auth";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase";
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
  const [userProfile, setUserProfile] = useState(null);

  // Add profile editing state
  const [editingProfile, setEditingProfile] = useState(false);

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

  // Listen to user profile for real-time updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserProfile(user.uid, (profile) => {
      setUserProfile(profile);
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

  // Get display name (prioritize profile data, then auth data)
  const getDisplayName = () => {
    return userProfile?.displayName || user?.displayName || "User";
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
              alt={getDisplayName()}
              className="user-avatar"
            />
            <div className="user-info">
              <h3 className="user-name">{getDisplayName()}</h3>
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
            className={`nav-item ${activeView === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('profile');
              setEditingProfile(false); // Reset to view mode when switching to profile tab
            }}
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
            {activeView === 'friends' && `Welcome ${getDisplayName()}! 🎵`}
            {activeView === 'chats' && 'Messages with Friends 💬'}
            {activeView === 'notifications' && 'Friend Requests 🔔'}
            {activeView === 'profile' && (editingProfile ? 'Edit Profile ✏️' : 'My Profile 👤')}
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
          ) : activeView === 'profile' ? (
            <ProfileView 
              user={user} 
              userProfile={userProfile} 
              editing={editingProfile}
              onEditToggle={() => setEditingProfile(!editingProfile)}
              onBack={() => setEditingProfile(false)}
            />
          ) : null}
        </div>
      </div>

      {/* Profile Popup for Friends */}
      {showProfilePopup && (
        <ProfilePopup 
          friend={selectedProfile}
          isOwnProfile={false}
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

// Profile View Component (Updated with Edit Mode)
function ProfileView({ user, userProfile, editing, onEditToggle, onBack }) {
  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    bio: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false); // Add this

  // Initialize form data when profile loads or when entering edit mode
  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || "",
        username: userProfile.username || "",
        bio: userProfile.bio || "",
      });
    }
  }, [userProfile, editing]);

  // Upload profile picture using Cloudinary
  const handleProfilePictureUpload = async () => {
    if (!user) return;

    setUploadingImage(true);
    setMessage("");

    try {
      const result = await openUploadWidget();
      
      if (result) {
        // Update Firebase Auth profile
        await updateProfile(user, {
          photoURL: result.secure_url
        });

        // Update Firestore user document
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          photoURL: result.secure_url,
          cloudinaryPublicId: result.public_id
        });

        setMessage("Profile picture updated successfully!");
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      if (error.message === "Upload cancelled") {
        setMessage("Profile picture upload cancelled");
      } else {
        setMessage("Error uploading profile picture: " + error.message);
      }
    }
    
    setUploadingImage(false);
  };

  // Remove profile picture (revert to Google or default)
  const handleRemoveProfilePicture = async () => {
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      // Revert to Google photo URL or null
      const originalPhotoURL = user.providerData?.[0]?.photoURL || null;

      // Update Firebase Auth
      await updateProfile(user, {
        photoURL: originalPhotoURL
      });

      // Update Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        photoURL: originalPhotoURL,
        cloudinaryPublicId: null
      });

      setMessage("Profile picture removed successfully!");
    } catch (error) {
      console.error("Error removing profile picture:", error);
      setMessage("Error removing profile picture: " + error.message);
    }
    
    setLoading(false);
  };

  // Check if current picture is from Cloudinary
  const isCloudinaryPicture = () => {
    return userProfile?.cloudinaryPublicId || 
           (userProfile?.photoURL && userProfile.photoURL.includes('cloudinary') && 
            !userProfile.photoURL.includes('googleusercontent'));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      // Update Firebase Auth display name
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }

      // Update Firestore user document
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: formData.displayName,
        username: formData.username,
        bio: formData.bio,
      });

      setMessage("Profile updated successfully!");
      setTimeout(() => {
        onEditToggle(); // Switch back to view mode
        setMessage("");
      }, 2000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Error updating profile: " + error.message);
    }
    setLoading(false);
  };

  if (!userProfile) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="profile-tab-container">
        <div className="profile-edit-header">
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
          <h2>Edit Profile</h2>
        </div>

        <div className="profile-tab-content">
          {message && (
            <div className={`profile-message ${message.includes("Error") ? "profile-message-error" : "profile-message-success"}`}>
              {message}
            </div>
          )}

          {/* Profile Picture Section in Edit Mode */}
          <div className="profile-picture-edit-section">
            <div className="profile-picture-preview">
              <img
                src={userProfile.photoURL || user?.photoURL || "/default-avatar.png"}
                alt="Profile"
                className="profile-picture-edit"
              />
            </div>
            <p className="profile-picture-note">
              {isCloudinaryPicture() 
                ? "Custom profile picture" 
                : user?.photoURL 
                  ? "Profile picture from Google" 
                  : "Default profile picture"
              }
            </p>
            
            <div className="profile-picture-actions">
              <button
                onClick={handleProfilePictureUpload}
                disabled={uploadingImage}
                className="profile-picture-upload-button"
              >
                {uploadingImage ? "Uploading..." : "Change Picture"}
              </button>
              
              {(isCloudinaryPicture() || user?.photoURL) && (
                <button
                  onClick={handleRemoveProfilePicture}
                  disabled={loading}
                  className="profile-picture-remove-button"
                >
                  Remove Picture
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleUpdate} className="profile-edit-form">
            <div className="profile-form-group">
              <label className="profile-label">Display Name:</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
                className="profile-input"
              />
            </div>

            <div className="profile-form-group">
              <label className="profile-label">Username:</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                className="profile-input"
              />
            </div>

            <div className="profile-form-group">
              <label className="profile-label">Bio:</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows="4"
                className="profile-input profile-textarea"
                placeholder="Tell others about yourself..."
              />
            </div>

            <div className="profile-edit-actions">
              <button
                type="submit"
                disabled={loading}
                className="save-profile-button"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="cancel-profile-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-tab-container">
      <div className="profile-tab-content">
        <div className="profile-header-section">
          <div className="profile-picture-large-container">
            <img 
              src={userProfile.photoURL || user?.photoURL} 
              alt={userProfile.displayName}
              className="profile-picture-large"
            />
          </div>
          
          <div className="profile-basic-info">
            <h2 className="profile-display-name">{userProfile.displayName}</h2>
            <p className="profile-username">@{userProfile.username}</p>
            <p className="profile-email">{user?.email}</p>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-section">
            <h3 className="profile-section-title">About</h3>
            <div className="profile-bio">
              {userProfile.bio ? (
                <p>{userProfile.bio}</p>
              ) : (
                <p className="no-bio">No bio yet. Tell others about yourself!</p>
              )}
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section-title">Stats</h3>
            <div className="profile-stats-grid">
              <div className="profile-stat-item">
                <span className="stat-number">{userProfile.friends ? userProfile.friends.length : 0}</span>
                <span className="stat-label">Friends</span>
              </div>
              <div className="profile-stat-item">
                <span className="stat-number">{userProfile.friendRequests ? userProfile.friendRequests.length : 0}</span>
                <span className="stat-label">Requests</span>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button 
              onClick={onEditToggle}
              className="edit-profile-button"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Popup Component (for friends)
function ProfilePopup({ friend, isOwnProfile, onClose }) {
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