import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { getUserFriends, listenToUserChats, listenToUserProfile } from "../firebase/firestore";
import { openUploadWidget } from "../services/cloudinary";
import { updateProfile } from "firebase/auth";
import { updateDoc, doc} from "firebase/firestore";
import { listenToFriendsOnlineStatus, listenToUnreadMessagesCount } from "../firebase/firestore";
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
  const [friendsOnlineStatus, setFriendsOnlineStatus] = useState({});
  const [unreadFriendsCount, setUnreadFriendsCount] = useState(0);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleFriendRequestUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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

  useEffect(() => {
    const calculateUnreadFriends = () => {
      const friendsWithUnread = new Set();
    
      chats.forEach(chat => {
        if (chat.unreadCount > 0) {
          const friendId = chat.otherParticipant?.uid;
          if (friendId) {
            friendsWithUnread.add(friendId);
          }
        }
      });
      setUnreadFriendsCount(friendsWithUnread.size);
     };
     calculateUnreadFriends();
  }, [chats]);

  useEffect(() => {
    if (!user) return;
  // Use dedicated real-time listener for unread counts
    const unsubscribe = listenToUnreadMessagesCount(user.uid, (count) => {
      setUnreadFriendsCount(count);
      console.log(`Real-time unread friends count: ${count}`);
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
              <p className="user-status online">Online</p>
            </div>
          </div>
        </div>

        <nav className="pane-nav">
          <button 
            className={`nav-item ${activeView === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveView('friends')}
          >
            <svg aria-label="Home" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Home</title><path d="m21.762 8.786-7-6.68a3.994 3.994 0 0 0-5.524 0l-7 6.681A4.017 4.017 0 0 0 1 11.68V19c0 2.206 1.794 4 4 4h3.005a1 1 0 0 0 1-1v-7.003a2.997 2.997 0 0 1 5.994 0V22a1 1 0 0 0 1 1H19c2.206 0 4-1.794 4-4v-7.32a4.02 4.02 0 0 0-1.238-2.894Z"></path></svg>
            <span className="nav-text">HOME</span>
          </button>
          <button 
            className={`nav-item ${activeView === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveView('chats')}
          >
            <svg aria-label="Messages" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Messages</title><path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"></path><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="7.488" x2="15.515" y1="12.208" y2="7.641"></line></svg>
            <span className="nav-text">CHAT</span>
            {unreadFriendsCount > 0 && <span className="nav-badge">{unreadFriendsCount}</span>}
          </button>
          <button 
            className={`nav-item ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => setActiveView('search')}
          >
            <svg aria-label="Search" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Search</title><path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="16.511" x2="22" y1="16.511" y2="22"></line></svg>
            <span className="nav-text">SEARCH</span>
          </button>          
          <button 
            className={`nav-item ${activeView === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveView('notifications')}
            title="View notifications"
          >
            <svg aria-label="Notifications" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Notifications</title><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z"></path></svg>
            <span className="nav-text">ALERTS</span>
          </button>
          <button 
            className={`nav-item ${activeView === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('profile');
              setEditingProfile(false);
            }}
            title="View profile"
          >
            <svg aria-label="Profile" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="x14rh7hd"><title>Tagged</title><path d="M10.201 3.797 12 1.997l1.799 1.8a1.59 1.59 0 0 0 1.124.465h5.259A1.818 1.818 0 0 1 22 6.08v14.104a1.818 1.818 0 0 1-1.818 1.818H3.818A1.818 1.818 0 0 1 2 20.184V6.08a1.818 1.818 0 0 1 1.818-1.818h5.26a1.59 1.59 0 0 0 1.123-.465z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2px"></path><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2px"><path d="M18.598 22.002V21.4a3.949 3.949 0 0 0-3.948-3.949H9.495A3.949 3.949 0 0 0 5.546 21.4v.603" fill="none"></path><circle cx="12.07211" cy="11.07515" r="3.55556" fill="none"></circle></g></svg>
            <span className="nav-text">PROFILE</span>
          </button>
        </nav>

        <div className="pane-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <svg aria-label="Settings" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18"><title>Settings</title><circle cx="12" cy="12" fill="none" r="8.635" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></circle><path d="M14.232 3.656a1.269 1.269 0 0 1-.796-.66L12.93 2h-1.86l-.505.996a1.269 1.269 0 0 1-.796.66m-.001 16.688a1.269 1.269 0 0 1 .796.66l.505.996h1.862l.505-.996a1.269 1.269 0 0 1 .796-.66M3.656 9.768a1.269 1.269 0 0 1-.66.796L2 11.07v1.862l.996.505a1.269 1.269 0 0 1 .66.796m16.688-.001a1.269 1.269 0 0 1 .66-.796L22 12.93v-1.86l-.996-.505a1.269 1.269 0 0 1-.66-.796M7.678 4.522a1.269 1.269 0 0 1-1.03.096l-1.06-.348L4.27 5.587l.348 1.062a1.269 1.269 0 0 1-.096 1.03m11.8 11.799a1.269 1.269 0 0 1 1.03-.096l1.06.348 1.318-1.317-.348-1.062a1.269 1.269 0 0 1 .096-1.03m-14.956.001a1.269 1.269 0 0 1 .096 1.03l-.348 1.06 1.317 1.318 1.062-.348a1.269 1.269 0 0 1 1.03.096m11.799-11.8a1.269 1.269 0 0 1-.096-1.03l.348-1.06-1.317-1.318-1.062.348a1.269 1.269 0 0 1-1.03-.096" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"></path></svg>
            <span className="nav-text">LOGOUT</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="welcome-section">
          <h1 className="welcome-title">
            {activeView === 'friends' && `DUET`}
            {activeView === 'chats' && 'Chat'}
            {activeView === 'search' && 'Search'}
            {activeView === 'notifications' && 'Alerts'}
            {activeView === 'profile' && (editingProfile ? 'Edit Profile ✏️' : 'My Profile')}
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
          ) : activeView === 'search' ? (
            <SearchView user={user} />
          ) : activeView === 'notifications' ? (
            <>
              <NotificationsView user={user} onFriendRequestUpdate={handleFriendRequestUpdate} />
              {/* Friends list component that should also refresh */}
              <friendsList refreshKey={refreshTrigger} />
            </>
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
            <svg aria-label="Messages" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Messages</title><path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"></path><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="7.488" x2="15.515" y1="12.208" y2="7.641"></line></svg>
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

      {message && (
        <div className={`search-message ${message.includes("Error") ? "search-message-error" : "search-message-success"}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Search here..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button
          type="submit"
          disabled={loading}
          className="search-button"
        >
          <svg aria-label="Search" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Search</title><path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="16.511" x2="22" y1="16.511" y2="22"></line></svg>
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

function NotificationsView({ user, onFriendRequestUpdate }) {
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

      if (onFriendRequestUpdate) {
        onFriendRequestUpdate();
      }

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

      if (onFriendRequestUpdate) {
        onFriendRequestUpdate();
      }

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