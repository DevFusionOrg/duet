import React, { useCallback, useEffect, useState, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Chat from "./Chat";
import '../styles/Home.css';
import ChatsView from '../Components/Home/ChatsView';
import SearchView from '../Components/Home/SearchView';
import NotificationsModal from '../Components/Home/NotificationsModal';
import LoadingScreen from '../Components/LoadingScreen';
import { useFriends } from "../hooks/useFriends";
import { useChats } from "../hooks/useChats";
import { useProfiles } from "../hooks/useProfiles";
import { useFriendsOnlineStatus } from "../hooks/useFriendsOnlineStatus";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { migrateOldUnreadCounts, listenToIncomingFriendRequestCount } from "../firebase/firestore";

const ProfileView = React.lazy(() => import('../Components/Home/ProfileView'));

function Home({ user, isDarkMode, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { friends } = useFriends(user);
  const { chats, loading: chatsLoading } = useChats(user, friends);
  const { profile: userProfile} = useProfiles(user);
  const { friendsOnlineStatus } = useFriendsOnlineStatus(user, friends);
  const { unreadFriendsCount } = useUnreadCount(user);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeView, setActiveView] = useState('chats');

  const [pendingFriendId, setPendingFriendId] = useState(null);
  const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = listenToIncomingFriendRequestCount(user.uid, setPendingFriendRequestCount);
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    
    const migrationKey = `unreadCountMigrated_${user.uid}_v2`;
    const alreadyMigrated = localStorage.getItem(migrationKey);
    
    if (!alreadyMigrated) {
      console.log('Starting unread count migration...');
      migrateOldUnreadCounts(user.uid)
        .then((count) => {
          if (count >= 0) {
            localStorage.setItem(migrationKey, 'true');
            console.log(`Migration completed: ${count} chats updated`);
          }
        })
        .catch((error) => {
          console.error('Migration failed:', error);
        });
    } else {
      console.log('Migration already completed for this user');
    }
  }, [user?.uid]);
  
  const handleFriendRequestUpdate = () => {};

  const handleStartChat = (friend) => {
    setSelectedFriend(friend);
  };

  const handleBackToFriends = (nextFriend = null) => {
    if (nextFriend && typeof nextFriend === 'object' && (nextFriend.uid || nextFriend.id)) {
      setSelectedFriend(nextFriend);
      setActiveView('chats');
      return;
    }
    setSelectedFriend(null);
  };


  const openChatForFriendId = useCallback((friendId) => {
    if (!friendId) return false;
    const friendMatch = friends.find((f) => f.uid === friendId || f.id === friendId);
    if (friendMatch) {
      setSelectedFriend(friendMatch);
      setActiveView('chats');
      return true;
    }
    return false;
  }, [friends]);

  useEffect(() => {
    if (!pendingFriendId || !friends.length) return;
    const handled = openChatForFriendId(pendingFriendId);
    if (handled) {
      setPendingFriendId(null);
    }
  }, [pendingFriendId, friends, openChatForFriendId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatIdParam = params.get("chatId");
    const senderIdParam = params.get("senderId");
    const viewParam = params.get("view");

    if (viewParam === "notifications") {
      setActiveView("alerts");
    }

    const friendIdFromChat = chatIdParam
      ? chatIdParam.split("_").find((id) => id !== user.uid)
      : null;

    const targetFriendId = senderIdParam || friendIdFromChat;
    if (targetFriendId) {
      const handled = openChatForFriendId(targetFriendId);
      if (!handled) {
        setPendingFriendId(targetFriendId);
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [location.search, user?.uid, openChatForFriendId, navigate]);

  useEffect(() => {
    const handleNotificationClick = (event) => {
      const detail = event.detail || {};

      if (detail.type === 'friend_request') {
        setActiveView('alerts');
        return;
      }

      const friendId =
        detail.senderId ||
        detail.fromUserId ||
        (detail.chatId ? detail.chatId.split('_').find((id) => id !== user.uid) : null);

      if (friendId) {
        const handled = openChatForFriendId(friendId);
        if (!handled) {
          setPendingFriendId(friendId);
        }
      }
    };

    window.addEventListener('notification-click', handleNotificationClick);
    return () => window.removeEventListener('notification-click', handleNotificationClick);
  }, [openChatForFriendId, user?.uid]);

  if (selectedFriend) {
    return (
      <Chat 
        user={user} 
        friend={selectedFriend} 
        onBack={() => handleBackToFriends()}
      />
    );
  }

  return (
    <div className="home-container">
      <div className="side-pane">
        <nav className="pane-nav">
          <button 
            className={`nav-item ${activeView === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveView('chats')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span className="nav-label">Chat</span>
            {unreadFriendsCount > 0 && <span className="nav-badge">{unreadFriendsCount}</span>}
          </button>
          <button
            className={`nav-item ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => setActiveView('search')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span className="nav-label">Search</span>
          </button>
          <button
            className={`nav-item ${activeView === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveView('alerts')}
          >
            <svg aria-label="Notifications" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
              <title>Notifications</title>
              <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z"></path>
            </svg>
            <span className="nav-label">Alerts</span>
            {pendingFriendRequestCount > 0 && <span className="nav-badge">{pendingFriendRequestCount}</span>}
          </button>
          <button 
            className={`nav-item ${(activeView === 'profile' || activeView === 'settings') ? 'active' : ''}`}
            onClick={() => setActiveView('profile')}
          >
            <span className="nav-avatar">
              <img
                src={userProfile?.photoURL || '/default-avatar.png'}
                alt="Profile"
                className="nav-avatar-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/default-avatar.png';
                }}
              />
            </span>
            <span className="nav-label">Profile</span>
          </button>
        </nav>
      </div>

      <div className="main-content">
        <div className="content-area">
          {activeView === 'chats' ? (
            <ChatsView 
              chats={chats} 
              loading={chatsLoading} 
              onStartChat={handleStartChat}
              friendsOnlineStatus={friendsOnlineStatus}
              user={user}
              friends={friends}
            />
          ) : activeView === 'search' ? (
            <SearchView user={user} />
          ) : activeView === 'alerts' ? (
            <NotificationsModal
              isOpen={true}
              user={user}
              onFriendRequestUpdate={handleFriendRequestUpdate}
              asPage={true}
            />
          ) : activeView === 'profile' ? (
            <Suspense fallback={<LoadingScreen message="Loading profile..." size="medium" fullScreen={true} />}>
              <ProfileView
                user={user}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                onOpenSettingsTab={() => setActiveView('settings')}
              />
            </Suspense>
          ) : activeView === 'settings' ? (
            <Suspense fallback={<LoadingScreen message="Loading settings..." size="medium" fullScreen={true} />}>
              <ProfileView
                user={user}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                openSettingsAsView={true}
                onCloseSettingsTab={() => setActiveView('profile')}
              />
            </Suspense>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Home;
