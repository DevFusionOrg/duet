import React, { useState, useEffect, useMemo } from 'react';
import LoadingScreen from '../LoadingScreen';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { getOptimizedProfilePictureUrl } from '../../services/cloudinary';

function ChatsView({ chats, loading, onStartChat, friendsOnlineStatus, user, friends = [] }) {
  const [pinnedChatId, setPinnedChatId] = useState(localStorage.getItem('pinnedChatId') || null);
  const [mutedChats, setMutedChats] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    
    const loadMutedChats = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setMutedChats(userData.mutedChats || []);
        }
      } catch (error) {
        console.error('Error loading muted chats:', error);
      }
    };
    
    loadMutedChats();
  }, [user?.uid]);

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

  const handlePinChat = (e, chatId) => {
    e.stopPropagation();
    if (pinnedChatId === chatId) {
      setPinnedChatId(null);
      localStorage.removeItem('pinnedChatId');
    } else {
      setPinnedChatId(chatId);
      localStorage.setItem('pinnedChatId', chatId);
    }
  };

  const handleToggleMute = async (e, chatId) => {
    e.stopPropagation();
    if (!user?.uid) return;
    
    const isMuted = mutedChats.includes(chatId);
    const newMuted = isMuted 
      ? mutedChats.filter(id => id !== chatId)
      : [...mutedChats, chatId];
    
    setMutedChats(newMuted);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        mutedChats: newMuted
      });
    } catch (error) {
      console.error('Error updating muted chats:', error);
      
      setMutedChats(mutedChats);
    }
  };

  const sortedChats = chats.sort((a, b) => {
    if (a.id === pinnedChatId) return -1;
    if (b.id === pinnedChatId) return 1;
    return 0;
  });

  const notStartedFriends = useMemo(() => {
    const chattedFriendIds = new Set(
      chats
        .map((chat) => chat.participants?.find((id) => id !== user?.uid))
        .filter(Boolean)
    );

    return friends.filter((f) => {
      const id = f?.uid || f?.id;
      if (!id) return false;
      return !chattedFriendIds.has(id);
    });
  }, [chats, friends, user?.uid]);

  if (loading) {
    return <LoadingScreen message="Loading chats..." size="medium" />;
  }

  return (
    <div className="chats-container">
      <div className="chats-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' , margin: '0px 10px' }}>
        <h1 className="SearchHeading">Messages</h1>
      </div>

      {chats.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>No Active Chats</h3>
          <p>Start a conversation with one of your friends!</p>
        </div>
      ) : (
        <div className="chats-list">
          <MemoizedVirtualizedChats
            chats={sortedChats}
            pinnedChatId={pinnedChatId}
            mutedChats={mutedChats}
            friendsOnlineStatus={friendsOnlineStatus}
            currentUserId={user?.uid}
            onStartChat={onStartChat}
            handlePinChat={handlePinChat}
            handleToggleMute={handleToggleMute}
            formatChatTimestamp={formatChatTimestamp}
          />
        </div>
      )}

      {notStartedFriends.length > 0 && (
        <div className="home-chat-suggestions">
          <h3 className="home-chat-suggestions-title">Start chatting with friends</h3>
          <div className="home-chat-suggestions-list">
            {notStartedFriends.map((suggestedFriend) => {
              const suggestedFriendId = suggestedFriend.uid || suggestedFriend.id;
              return (
                <button
                  key={suggestedFriendId}
                  type="button"
                  className="home-chat-suggestion-item"
                  onClick={() => onStartChat(suggestedFriend)}
                >
                  <img
                    src={
                      suggestedFriend.cloudinaryPublicId
                        ? getOptimizedProfilePictureUrl(suggestedFriend.cloudinaryPublicId, 64)
                        : (suggestedFriend.photoURL || '/default-avatar.png')
                    }
                    alt={suggestedFriend.displayName || suggestedFriend.username || 'Friend'}
                    className="home-chat-suggestion-avatar"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/default-avatar.png';
                    }}
                  />
                  <span className="home-chat-suggestion-name">
                    {suggestedFriend.displayName || suggestedFriend.username || 'Friend'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatsView;

function VirtualizedChats({ chats, pinnedChatId, mutedChats, friendsOnlineStatus, currentUserId, onStartChat, handlePinChat, handleToggleMute, formatChatTimestamp }) {
  const containerRef = React.useRef(null);
  const [viewportHeight, setViewportHeight] = React.useState(480);
  const itemHeight = 80;
  const [scrollTop, setScrollTop] = React.useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height || 480);
      }
    });
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
  const endIndex = Math.min(chats.length, startIndex + Math.ceil(viewportHeight / itemHeight) + 4);
  const visibleChats = chats.slice(startIndex, endIndex);

  const topSpacer = startIndex * itemHeight;
  const bottomSpacer = (chats.length - endIndex) * itemHeight;

  return (
    <div ref={containerRef} >
      <div style={{ height: topSpacer }} />
      {visibleChats.map((chat) => {
        const lastMessagePreview = chat.lastMessage || 'Start a conversation...';
        const isPinned = pinnedChatId === chat.id;
        const isMuted = mutedChats.includes(chat.id);
        const other = chat.otherParticipant || {};
        const otherParticipantId = other.uid || other.id || chat.participants?.find((id) => id !== currentUserId);
        const chatTarget = otherParticipantId
          ? {
              ...other,
              uid: otherParticipantId,
              id: otherParticipantId,
              displayName: other.displayName || 'User',
            }
          : null;
        return (
          <div
            key={chat.id}
            className={`chat-item ${isPinned ? 'pinned' : ''}`}
            style={{ height: itemHeight }}
            onClick={() => {
              if (chatTarget) onStartChat(chatTarget);
            }}
          >
            {isPinned && (
              <div className="pin-indicator" title="Pinned chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 9h-1V4c0-.5-.5-1-1-1h-2c-.5 0-1 .5-1 1v5H8c-.5 0-1 .5-1 1v2h2v7l3 3 3-3v-7h2v-2c0-.5-.5-1-1-1z"></path>
                </svg>
              </div>
            )}
            <div className="chat-avatar-section">
              <img
                loading="lazy"
                src={
                  other.cloudinaryPublicId
                    ? getOptimizedProfilePictureUrl(other.cloudinaryPublicId, 80)
                    : (other.photoURL || '/default-avatar.png')
                }
                alt={other.displayName}
                className="chat-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.png";
                }}
              />
              <div className={`online-indicator ${friendsOnlineStatus[other.uid] ? 'online' : 'offline'}`}></div>
            </div>
            <div className="chat-info">
              <div className="chat-header">
                <h4 className="chat-name">{other.displayName}</h4>
              </div>
              <p className="last-message">
                {lastMessagePreview.length > 40
                  ? lastMessagePreview.substring(0, 40) + '...'
                  : lastMessagePreview}
              </p>
            </div>
            <div className="chat-actions-group">
              <div className="chat-actions">
                <button
                  className="chat-action-btn pin-btn"
                  onClick={(e) => handlePinChat(e, chat.id)}
                  title={isPinned ? 'Unpin chat' : 'Pin chat'}
                  aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
                  style={{ color: isPinned ? '#00a8e8' : undefined }}
                >
                  {}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3v5l4 4v2h-7l-2 7-2-7H2v-2l4-4V3h10z" />
                  </svg>
                </button>
                <button
                  className="chat-action-btn mute-btn"
                  onClick={(e) => handleToggleMute(e, chat.id)}
                  title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                  aria-label={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                  style={{ color: isMuted ? '#ff4757' : undefined }}
                >
                  {}
                  {isMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 10-12 0c0 4-2 6-2 6h16s-2-2-2-6" fill="none" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 10-12 0c0 4-2 6-2 6h16s-2-2-2-6" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                  )}
                </button>
              </div>
              <span className="chat-time">{formatChatTimestamp(chat.lastMessageAt)}</span>
            </div>
            {chat.unreadCount > 0 && !isMuted && <div className="unread-badge">{chat.unreadCount}</div>}
          </div>
        );
      })}
      <div style={{ height: bottomSpacer }} />
    </div>
  );
}

// Memoize VirtualizedChats to prevent unnecessary re-renders
const MemoizedVirtualizedChats = React.memo(VirtualizedChats, (prev, next) => {
  return (
    prev.chats === next.chats &&
    prev.pinnedChatId === next.pinnedChatId &&
    prev.mutedChats === next.mutedChats &&
    prev.friendsOnlineStatus === next.friendsOnlineStatus &&
    prev.currentUserId === next.currentUserId
  );
});