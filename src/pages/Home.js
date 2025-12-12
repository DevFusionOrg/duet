import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Chat from "./Chat";
import '../styles/Home.css';
import FriendsView from '../Components/Home/FriendsView';
import ChatsView from '../Components/Home/ChatsView';
import ProfileView from '../Components/Home/ProfileView';
import SearchView from '../Components/Home/SearchView';
import NotificationsView from '../Components/Home/NotificationsView';
import ProfilePopup from '../Components/Home/ProfilePopup';
import { useFriends } from "../hooks/useFriends";
import { useChats } from "../hooks/useChats";
import { useProfile } from "../hooks/useProfile";
import { useFriendsOnlineStatus } from "../hooks/useFriendsOnlineStatus";
import { useUnreadCount } from "../hooks/useUnreadCount";

function Home({ user }) {
  const navigate = useNavigate();
  const { friends, loading: friendsLoading } = useFriends(user);
  const { chats, loading: chatsLoading } = useChats(user);
  const { userProfile } = useProfile(user);
  const { friendsOnlineStatus } = useFriendsOnlineStatus(user, friends);
  const { unreadFriendsCount } = useUnreadCount(user);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeView, setActiveView] = useState('friends');
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const loading = friendsLoading || chatsLoading;
  
  const handleFriendRequestUpdate = () => {};

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
            <svg aria-label="Home" className="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Home</title><path d="m21.762 8.786-7-6.68a3.994 3.994 0 0 0-5.524 0l-7 6.681A4.017 4.017 0 0 0 1 11.68V19c0 2.206 1.794 4 4 4h3.005a1 1 0 0 0 1-1v-7.003a2.997 2.997 0 0 1 5.994 0V22a1 1 0 0 0 1 1H19c2.206 0 4-1.794 4-4v-7.32a4.02 4.02 0 0 0-1.238-2.894Z"></path></svg>
            <span className="nav-text">HOME</span>
          </button>
          <button 
            className={`nav-item ${activeView === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveView('chats')}
          >
            <svg aria-label="Messages" className="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Messages</title><path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path><line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="7.488" x2="15.515" y1="12.208" y2="7.641"></line></svg>
            <span className="nav-text">CHAT</span>
            {unreadFriendsCount > 0 && <span className="nav-badge">{unreadFriendsCount}</span>}
          </button>
          <button 
            className={`nav-item ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => setActiveView('search')}
          >
            <svg aria-label="Search" className="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Search</title><path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path><line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="16.511" x2="22" y1="16.511" y2="22"></line></svg>
            <span className="nav-text">SEARCH</span>
          </button>          
          <button 
            className={`nav-item ${activeView === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveView('notifications')}
            title="View notifications"
          >
            <svg aria-label="Notifications" className="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Notifications</title><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z"></path></svg>
            <span className="nav-text">ALERTS</span>
          </button>
          <button 
            className={`nav-item ${activeView === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('profile');
            }}
            title="View profile"
          >
            <svg aria-label="Profile" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="x14rh7hd"><title>Tagged</title><path d="M10.201 3.797 12 1.997l1.799 1.8a1.59 1.59 0 0 0 1.124.465h5.259A1.818 1.818 0 0 1 22 6.08v14.104a1.818 1.818 0 0 1-1.818 1.818H3.818A1.818 1.818 0 0 1 2 20.184V6.08a1.818 1.818 0 0 1 1.818-1.818h5.26a1.59 1.59 0 0 0 1.123-.465z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2px"></path><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2px"><path d="M18.598 22.002V21.4a3.949 3.949 0 0 0-3.948-3.949H9.495A3.949 3.949 0 0 0 5.546 21.4v.603" fill="none"></path><circle cx="12.07211" cy="11.07515" r="3.55556" fill="none"></circle></g></svg>
            <span className="nav-text">PROFILE</span>
          </button>
        </nav>
      </div>

      <div className="main-content">
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
            <NotificationsView user={user} onFriendRequestUpdate={handleFriendRequestUpdate} />
          ) : activeView === 'profile' ? (
            <ProfileView user={user} />
          ) : null}
        </div>
      </div>

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
