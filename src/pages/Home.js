import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { getUserFriends, listenToUserChats, listenToUserProfile } from "../firebase/firestore";
import { openUploadWidget } from "../services/cloudinary";
import { updateProfile } from "firebase/auth";
import { updateDoc, doc} from "firebase/firestore";
import { setUserOnlineStatus, listenToUserOnlineStatus, listenToFriendsOnlineStatus } from "../firebase/firestore";
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

  const [editingProfile, setEditingProfile] = useState(false);
  const [isUserOnline, setIsUserOnline] = useState(true);
  const [friendsOnlineStatus, setFriendsOnlineStatus] = useState({});

  useEffect(() => {
    if (!user) return;

    const setOnline = async () => {
      await setUserOnlineStatus(user.uid, true);
    };

    setOnline();

    const handleBeforeUnload = async () => {
      await setUserOnlineStatus(user.uid, false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      const cleanup = async () => {
        await setUserOnlineStatus(user.uid, false);
      };
      cleanup();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserOnlineStatus(user.uid, (online) => {
      setIsUserOnline(online);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user || friends.length === 0) return;

    const friendIds = friends.map(friend => friend.uid);
    const unsubscribe = listenToFriendsOnlineStatus(friendIds, (status) => {
      setFriendsOnlineStatus(status);
    });

    return unsubscribe;
  }, [user, friends]);

  useEffect(() => {
    if (!user) return;

    const loadFriends = async () => {
      try {
        const friendsList = await getUserFriends(user.uid);
        setFriends(friendsList);
        
        const initialStatus = {};
        friendsList.forEach(friend => {
          initialStatus[friend.uid] = friend.isOnline || false;
        });
        setFriendsOnlineStatus(initialStatus);
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading friends:", error);
        setLoading(false);
      }
    };

    loadFriends();
  }, [user]);

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

  const getDisplayName = () => {
    return userProfile?.displayName || user?.displayName || "User";
  };

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
              <p className={`user-status ${isUserOnline ? 'online' : 'offline'}`}> {isUserOnline ? 'Online' : 'Offline'} </p>
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
            className={`nav-item ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => setActiveView('search')}
          >
            <span className="nav-icon">🔍</span>
            <span className="nav-text">Search</span>
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
              setEditingProfile(false);
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
            {activeView === 'search' && 'Find New Friends 🔍'}
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
              friendsOnlineStatus={friendsOnlineStatus}
            />
          ) : activeView === 'chats' ? (
            <ChatsView 
              chats={chats} 
              loading={loading} 
              onStartChat={handleStartChat}
              friendsOnlineStatus={friendsOnlineStatus}
            />
          ) :activeView === 'search' ? (
            <SearchView user={user} />
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
          friendsOnlineStatus={friendsOnlineStatus}
        />
      )}
    </div>
  );
}

export default Home;

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
            <span className="chat-icon">💬</span>
            Chat
          </button>
        </div>
      ))}
    </div>
  );
}

function ChatsView({ chats, loading, onStartChat, friendsOnlineStatus }) {
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
            <div className={`online-indicator ${friendsOnlineStatus[chat.otherParticipant.uid] ? 'online' : 'offline'}`}></div>
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

function ProfileView({ user, userProfile, editing, onEditToggle, onBack }) {
  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    bio: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || "",
        username: userProfile.username || "",
        bio: userProfile.bio || "",
      });
    }
  }, [userProfile, editing]);

  const handleProfilePictureUpload = async () => {
    if (!user) return;

    setUploadingImage(true);
    setMessage("");

    try {
      const result = await openUploadWidget();
      
      if (result) {
        await updateProfile(user, {
          photoURL: result.secure_url
        });

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

  const handleRemoveProfilePicture = async () => {
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      const originalPhotoURL = user.providerData?.[0]?.photoURL || null;
      await updateProfile(user, {
        photoURL: originalPhotoURL
      });

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
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: formData.displayName,
        username: formData.username,
        bio: formData.bio,
      });

      setMessage("Profile updated successfully!");
      setTimeout(() => {
        onEditToggle();
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

function ProfilePopup({ friend, isOwnProfile, onClose, friendsOnlineStatus }) {
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

            <div className="info-field">
              <label>Status:</label>
              <span className={`status ${friendsOnlineStatus[friend?.uid] ? 'online' : 'offline'}`}>
                {friendsOnlineStatus[friend?.uid] ? 'Online' : 'Offline'}
              </span>
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

function SearchView({ user }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState({});
  const [message, setMessage] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setMessage("");
    try {
      const { searchUsers } = await import("../firebase/firestore");
      const results = await searchUsers(searchTerm);
      const filteredResults = results.filter(
        (result) => result.uid !== user.uid,
      );
      setSearchResults(filteredResults);

      if (filteredResults.length === 0) {
        setMessage("No users found. Try a different search term.");
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setMessage("Error searching users: " + error.message);
    }
    setLoading(false);
  };

  const handleSendRequest = async (toUserId, toUserName) => {
    setRequestLoading((prev) => ({ ...prev, [toUserId]: true }));
    setMessage("");

    try {
      const { sendFriendRequest } = await import("../firebase/firestore");
      await sendFriendRequest(user.uid, toUserId);
      setMessage(`Friend request sent to ${toUserName}!`);

      setSearchResults((prev) =>
        prev.map((user) =>
          user.uid === toUserId
            ? {
                ...user,
                hasSentRequest: true,
                friendRequests: [
                  ...(user.friendRequests || []),
                  { from: user.uid, status: "pending" },
                ],
              }
            : user,
        ),
      );
    } catch (error) {
      console.error("Error sending friend request:", error);
      setMessage(error.message);
    }
    setRequestLoading((prev) => ({ ...prev, [toUserId]: false }));
  };

  const hasSentRequest = (userProfile, currentUserId) => {
    return (
      userProfile.friendRequests &&
      userProfile.friendRequests.some(
        (req) => req.from === currentUserId && req.status === "pending",
      )
    );
  };

  const isAlreadyFriend = (userProfile, currentUserId) => {
    return userProfile.friends && userProfile.friends.includes(currentUserId);
  };

  return (
    <div className="search-container">
      <h2 className="search-title">Search Users</h2>

      {message && (
        <div className={`search-message ${message.includes("Error") ? "search-message-error" : "search-message-success"}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Search by name or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button
          type="submit"
          disabled={loading}
          className="search-button"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      <div className="search-results">
        {searchResults.map((result) => {
          const alreadyFriends = isAlreadyFriend(result, user.uid);
          const requestSent = hasSentRequest(result, user.uid);

          return (
            <div
              key={result.uid}
              className="search-result-item"
            >
              <img
                src={result.photoURL || '/default-avatar.png'}
                alt={result.displayName}
                className="search-result-avatar"
              />
              <div className="search-result-info">
                <h4>{result.displayName}</h4>
                <p className="search-result-username">@{result.username}</p>
                {result.bio && (
                  <p className="search-result-bio">{result.bio}</p>
                )}

                {/* Status indicators */}
                {alreadyFriends && (
                  <p className="status-indicator status-friends">
                    ✓ Already friends
                  </p>
                )}
                {requestSent && (
                  <p className="status-indicator status-pending">
                    ⏳ Friend request sent
                  </p>
                )}
              </div>

              {!alreadyFriends && !requestSent ? (
                <button
                  onClick={() =>
                    handleSendRequest(result.uid, result.displayName)
                  }
                  disabled={requestLoading[result.uid]}
                  className="add-friend-button"
                >
                  {requestLoading[result.uid] ? "Sending..." : "Add Friend"}
                </button>
              ) : (
                <button
                  disabled
                  className="disabled-button"
                >
                  {alreadyFriends ? "Friends" : "Request Sent"}
                </button>
              )}
            </div>
          );
        })}

        {searchResults.length === 0 && searchTerm && !loading && !message && (
          <p className="no-results">No users found. Try a different search term.</p>
        )}
      </div>
    </div>
  );
}

function NotificationsView({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState({});
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserProfile(user.uid, (userProfile) => {
      console.log("Notifications - Profile updated:", userProfile);
      setProfile(userProfile);
    });

    return unsubscribe;
  }, [user]);

  const handleAccept = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;

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

      console.log("Friend request accepted and marked as processed");

      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      setActionMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [requestKey]: false }));
    }
  };

  const handleReject = async (requestFromId, requestIndex, requesterName) => {
    const requestKey = `${requestFromId}_${requestIndex}`;

    if (processedRequests.has(requestKey)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [requestKey]: true }));
    setActionMessage("");

    try {
      const { rejectFriendRequest } = await import("../firebase/firestore");
      await rejectFriendRequest(user.uid, requestFromId);

      setProcessedRequests((prev) => new Set(prev.add(requestKey)));
      setActionMessage(`❌ Rejected friend request from ${requesterName}`);

      console.log("Friend request rejected and marked as processed");

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
      <div className="notifications-loading">Loading notifications...</div>
    );
  }

  const friendRequests = profile.friendRequests || [];
  const activeFriendRequests = friendRequests.filter((request, index) => {
    const requestKey = `${request.from}_${index}`;
    return !processedRequests.has(requestKey);
  });

  return (
    <div className="notifications-container">

      {actionMessage && (
        <div className={`action-message ${actionMessage.includes("✅") ? "action-message-success" : "action-message-error"}`}>
          {actionMessage}
        </div>
      )}

      {activeFriendRequests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Pending Requests</h3>
          <p>You're all caught up! New friend requests will appear here.</p>
        </div>
      ) : (
        <div className="friend-requests-list">
          <h3 className="notifications-section-title">
            Friend Requests
            <span className="notifications-badge">
              {activeFriendRequests.length}
            </span>
          </h3>
          {activeFriendRequests.map((request, index) => (
            <FriendRequestItem
              key={`${request.from}_${index}`}
              request={request}
              index={index}
              onAccept={handleAccept}
              onReject={handleReject}
              loading={loading[`${request.from}_${index}`] || false}
              isProcessed={processedRequests.has(`${request.from}_${index}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FriendRequestItem({
  request,
  index,
  onAccept,
  onReject,
  loading,
  isProcessed,
}) {
  const [requesterProfile, setRequesterProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchRequesterProfile = async () => {
      try {
        const { getUserProfile } = await import("../firebase/firestore");
        const profile = await getUserProfile(request.from);
        setRequesterProfile(profile);
      } catch (error) {
        console.error("Error fetching requester profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchRequesterProfile();
  }, [request.from]);

  if (isProcessed) {
    return null;
  }

  if (profileLoading) {
    return (
      <div className="notifications-request-loading">
        Loading user information...
      </div>
    );
  }

  const requesterName = requesterProfile?.displayName || "Unknown User";

  return (
    <div className={`friend-request-item ${loading ? "friend-request-item-loading" : ""}`}>
      <div className="request-user-info">
        {requesterProfile ? (
          <>
            <img
              src={requesterProfile.photoURL || '/default-avatar.png'}
              alt={requesterProfile.displayName}
              className="request-avatar"
            />
            <div className="request-details">
              <h4>{requesterProfile.displayName}</h4>
              <p className="request-username">@{requesterProfile.username}</p>
              {requesterProfile.bio && (
                <p className="request-bio">
                  {requesterProfile.bio}
                </p>
              )}
              <p className="request-time">
                {request.timestamp?.toDate?.()?.toLocaleString() || "Recently"}
              </p>
            </div>
          </>
        ) : (
          <div className="request-details">
            <p className="request-name">User not found</p>
            <p className="request-time">
              User ID: {request.from}
            </p>
          </div>
        )}
      </div>
      <div className="request-actions">
        <button
          onClick={() => onAccept(request.from, index, requesterName)}
          disabled={loading}
          className="accept-btn"
        >
          {loading ? "..." : "✓ Accept"}
        </button>
        <button
          onClick={() => onReject(request.from, index, requesterName)}
          disabled={loading}
          className="reject-btn"
        >
          {loading ? "..." : "✕ Reject"}
        </button>
      </div>
    </div>
  );
}