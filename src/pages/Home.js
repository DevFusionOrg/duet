import React, { useCallback, useEffect, useState, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Chat from "./Chat";
import '../styles/Home.css';
import ChatsView from '../Components/Home/ChatsView';
import FriendsView from '../Components/Home/FriendsView';
import SearchView from '../Components/Home/SearchView';
import NotificationsModal from '../Components/Home/NotificationsModal';
import RecentlyActiveFriends from '../Components/Home/RecentlyActiveFriends';
import WelcomeOnboarding from '../Components/Home/WelcomeOnboarding';
import DevFusionModal from '../Components/Home/DevFusionModal';
import LoadingScreen from '../Components/LoadingScreen';
import { useFriends } from "../hooks/useFriends";
import { useChats } from "../hooks/useChats";
import { useProfiles } from "../hooks/useProfiles";
import { useFriendsOnlineStatus } from "../hooks/useFriendsOnlineStatus";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { migrateOldUnreadCounts } from "../firebase/firestore";

const ProfileView = React.lazy(() => import('../Components/Home/ProfileView'));

function Home({ user, isDarkMode, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { friends, loading: friendsLoading } = useFriends(user);
  const { chats, loading: chatsLoading } = useChats(user, friends);
  const { profile: userProfile,getProfilePictureUrl} = useProfiles(user);
  const { friendsOnlineStatus } = useFriendsOnlineStatus(user, friends);
  const { unreadFriendsCount } = useUnreadCount(user);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeView, setActiveView] = useState('friends');
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  
  const [pendingFriendId, setPendingFriendId] = useState(null);
  const [showConnectWithUs, setShowConnectWithUs] = useState(false);
  const loading = friendsLoading;

  const pendingFriendRequestCount = (userProfile?.friendRequests || []).filter(
    (req) => (req.status || 'pending') === 'pending'
  ).length;

  // Run migration once to convert old unreadCount to user-specific counts
  useEffect(() => {
    if (!user?.uid) return;
    
    const migrationKey = `unreadCountMigrated_${user.uid}_v2`; // v2 to force re-run
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

  useEffect(() => {
    if (!loading) {
      if (friends.length === 0) {
        
        const timer = setTimeout(() => {
          setShowConnectWithUs(true);
        }, 1000); 
        return () => clearTimeout(timer);
      } else {
        
        setShowConnectWithUs(false);
      }
    }
  }, [friends.length, loading]);
  
  const handleFriendRequestUpdate = () => {};

  const handleStartChat = (friend) => {
    setSelectedFriend(friend);
  };

  const handleBackToFriends = () => {
    setSelectedFriend(null);
  };

  const handleFriendCardClick = () => {};

  const getDisplayName = () => {
    return userProfile?.displayName || user?.displayName || "User";
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
      setActiveView("chats");
      setShowAlertsModal(true);
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
        setActiveView('chats');
        setShowAlertsModal(true);
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

  const filteredFriends = friends.filter(
    f => !userProfile?.blockedUsers?.includes(f.uid)
  );

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
        <nav className="pane-nav">
          <button 
            className={`nav-item ${activeView === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveView('friends')}
          >
            <svg aria-label="Home" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Home</title><path d="m21.762 8.786-7-6.68a3.994 3.994 0 0 0-5.524 0l-7 6.681A4.017 4.017 0 0 0 1 11.68V19c0 2.206 1.794 4 4 4h3.005a1 1 0 0 0 1-1v-7.003a2.997 2.997 0 0 1 5.994 0V22a1 1 0 0 0 1 1H19c2.206 0 4-1.794 4-4v-7.32a4.02 4.02 0 0 0-1.238-2.894Z"></path></svg>
            <span className="nav-text">HOME</span>
          </button>
          <button 
            className={`nav-item ${activeView === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveView('chats')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span className="nav-text">CHAT</span>
            {unreadFriendsCount > 0 && <span className="nav-badge">{unreadFriendsCount}</span>}
          </button>
          <button 
            className={`nav-item ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => setActiveView('search')}
          >
            <svg aria-label="Search" fill="none" stroke="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24" strokeWidth="2"><title>Search</title><path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" strokeLinecap="round" strokeLinejoin="round"></path><line strokeLinecap="round" strokeLinejoin="round" x1="16.511" x2="22" y1="16.511" y2="22"></line></svg>
            <span className="nav-text">SEARCH</span>
          </button>
          <button 
            className={`nav-item ${activeView === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('profile');
            }}
            title="View profile"
          >
            <div className="user-profile-section"><img src={getProfilePictureUrl()} alt={getDisplayName()} className="user-avatar" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-avatar.png";}}/></div>
            <span className="nav-text">PROFILE</span>
          </button>
        </nav>
      </div>

      <div className="main-content">
        <div className="content-area">
          {activeView === 'friends' ? (
            <>
              <FriendsView 
                friends={filteredFriends}
                loading={loading} 
                onStartChat={handleStartChat}
                onFriendCardClick={handleFriendCardClick}
                friendsOnlineStatus={friendsOnlineStatus}
                currentUserId={user.uid}
                hideGrid={true}
                hideHeading={true}
              />
              <div style={{ paddingLeft: '20px', paddingRight: '20px' }}>
                {filteredFriends.length > 0 ? (
                  <RecentlyActiveFriends
                    key="recently-active"
                    friends={filteredFriends}
                    friendsOnlineStatus={friendsOnlineStatus}
                    onStartChat={handleStartChat}
                  />
                ) : (
                  <WelcomeOnboarding
                    user={user}
                    onSwitchToSearch={() => setActiveView('search')}
                  />
                )}
              </div>
            </>
          ) : activeView === 'chats' ? (
            <ChatsView 
              chats={chats} 
              loading={chatsLoading} 
              onStartChat={handleStartChat}
              friendsOnlineStatus={friendsOnlineStatus}
              user={user}
              onOpenAlerts={() => setShowAlertsModal(true)}
              alertsCount={pendingFriendRequestCount}
            />
          ) : activeView === 'search' ? (
            <SearchView user={user} />
          ) : activeView === 'profile' ? (
            <Suspense fallback={<LoadingScreen message="Loading profile..." size="medium" fullScreen={true} />}>
              <ProfileView user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
            </Suspense>
          ) : null}
        </div>
      </div>

      <NotificationsModal 
        isOpen={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
        user={user}
        onFriendRequestUpdate={handleFriendRequestUpdate}
      />
      <DevFusionModal 
        isOpen={showConnectWithUs}
        onClose={() => setShowConnectWithUs(false)}
        currentUserId={user?.uid}
      />
    </div>
  );
}

export default Home;
