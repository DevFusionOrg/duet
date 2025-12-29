import React, { useState, useEffect } from 'react';
import UserBadge from '../UserBadge';
import LoadingScreen from '../LoadingScreen';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { getOptimizedProfilePictureUrl } from '../../services/cloudinary';

function ChatsView({ chats, loading, onStartChat, friendsOnlineStatus, user, onOpenAlerts, alertsCount }) {
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

  if (loading) {
    return <LoadingScreen message="Loading chats..." size="medium" />;
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
    <div className="chats-container">
      <div className="chats-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' , margin: '0px 10px' }}>
        <h1 className="SearchHeading">Messages</h1>
        <button
          className="alerts-button"
          onClick={onOpenAlerts}
          title="View alerts"
          aria-label="View alerts"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          <svg aria-label="Notifications" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>Notifications</title>
            <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z"></path>
          </svg>
          {alertsCount > 0 && (
            <span className="alerts-badge" style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ff4757',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 700
            }}>{alertsCount}</span>
          )}
        </button>
      </div>

      <div className="chats-list">
        <MemoizedVirtualizedChats
          chats={sortedChats}
          pinnedChatId={pinnedChatId}
          mutedChats={mutedChats}
          friendsOnlineStatus={friendsOnlineStatus}
          onStartChat={onStartChat}
          handlePinChat={handlePinChat}
          handleToggleMute={handleToggleMute}
          formatChatTimestamp={formatChatTimestamp}
        />
      </div>
    </div>
  );
}

export default ChatsView;

function VirtualizedChats({ chats, pinnedChatId, mutedChats, friendsOnlineStatus, onStartChat, handlePinChat, handleToggleMute, formatChatTimestamp }) {
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
        const displayBadge = other.badge || (other.username === 'ashwinirai492' ? 'tester' : null);
        return (
          <div
            key={chat.id}
            className={`chat-item ${isPinned ? 'pinned' : ''}`}
            style={{ height: itemHeight }}
            onClick={() => onStartChat(chat.otherParticipant)}
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
              {displayBadge && <UserBadge badge={displayBadge} size="small" />}
              <div className={`online-indicator ${friendsOnlineStatus[other.uid] ? 'online' : 'offline'}`}></div>
            </div>
            <div className="chat-info">
              <div className="chat-header">
                <h4 className="chat-name badge-with-name">
                  {other.displayName}
                  {displayBadge && <UserBadge badge={displayBadge} size="small" />}
                </h4>
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
    prev.friendsOnlineStatus === next.friendsOnlineStatus
  );
});