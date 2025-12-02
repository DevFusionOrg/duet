import React, { useState, useEffect, useRef } from "react";
import MusicPlayer from "../Components/MusicPlayer";
import {
  getOrCreateChat,
  sendMessage,
  listenToChatMessages,
  markMessagesAsRead,
  saveMessage,
  unsaveMessage,
  editMessage,
  getUserFriends,
  saveUserNotificationToken,
  blockUser,
  unblockUser,
  getBlockedUsers,
  deleteChat,
  replyToMessage,
} from "../firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { openUploadWidget, getOptimizedImageUrl } from "../services/cloudinary";
import "../styles/Chat.css";
import { notificationService } from "../services/notifications";
import { requestNotificationPermission, onMessageListener } from "../firebase/firebase";

function Chat({ user, friend, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading,] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [showForwardPopup, setShowForwardPopup] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cloudinaryLoaded, setCloudinaryLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const [notificationToken, setNotificationToken] = useState(null);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [isFriendOnline, setIsFriendOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const inputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
  const initializeNotifications = async () => {
    const hasPermission = await notificationService.requestPermission();
    setHasNotificationPermission(hasPermission);
    
    if (hasPermission) {
      const token = await requestNotificationPermission();
      setNotificationToken(token);
      
      if (token && user) {
        await saveUserNotificationToken(user.uid, token);
      }
    }
  };

  initializeNotifications();
}, [user]);

useEffect(() => {
  const setupForegroundMessages = async () => {
    const payload = await onMessageListener();
    if (payload) {
      const { title, body, data } = payload.notification || payload;
      
      notificationService.showNotification(title || 'New Message', {
        body,
        data,
        icon: data?.senderPhoto || '/default-avatar.png'
      });
    }
  };

  setupForegroundMessages();
}, []);

useEffect(() => {
  if (!chatId) return;

  const unsubscribe = listenToChatMessages(chatId, (chatMessages) => {
    const previousMessageCount = messages.length;
    setMessages(chatMessages);
    scrollToBottom();
    markMessagesAsRead(chatId, user.uid);
    
    if (chatMessages.length > previousMessageCount && previousMessageCount > 0) {
      const newMessages = chatMessages.slice(previousMessageCount);
      const newMessageFromFriend = newMessages.find(msg => 
        msg.senderId === friend.uid && 
        !msg.seenBy?.includes(user.uid)
      );
      
      if (newMessageFromFriend) {
        showNewMessageNotification(newMessageFromFriend);
      }
    }
  });

  return unsubscribe;
}, [chatId, user.uid, messages.length]);

const showNewMessageNotification = (message) => {
  const isViewingThisChat = true;

  if (!isViewingThisChat && hasNotificationPermission) {
    const notificationTitle = friend.displayName;
    const notificationBody = message.type === 'image' ? '📷 Sent a photo' : message.text;
    
    notificationService.showNotificationIfHidden(notificationTitle, {
      body: notificationBody.length > 100 ? notificationBody.substring(0, 100) + '...' : notificationBody,
      icon: friend.photoURL,
      badge: '/badge.png',
      data: {
        chatId,
        senderId: friend.uid,
        messageId: message.id,
        type: 'new-message'
      },
      vibrate: [200, 100, 200],
      tag: `chat-${chatId}`,
      renotify: true,
      requireInteraction: false,
      silent: false
    });
    playNotificationSound();
  }
};

const playNotificationSound = () => {
  const audio = new Audio('/notification.mp3');
  audio.volume = 0.3;
  audio.play().catch(e => console.log('Audio play failed:', e));
};

useEffect(() => {
  const handleNotificationClick = (event) => {
    const { chatId, senderId } = event.detail;
    console.log('Notification clicked for chat:', chatId);
  };

  window.addEventListener('notification-click', handleNotificationClick);
  
  return () => {
    window.removeEventListener('notification-click', handleNotificationClick);
  };
}, []);

  useEffect(() => {
    if (!friend?.uid) return;

    const userRef = doc(db, "users", friend.uid);

    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setIsFriendOnline(userData.isOnline || false);
        setLastSeen(userData.lastSeen || null);
      }
    });

    return unsubscribe;
  }, [friend?.uid]);

  const getLastSeenText = () => {
    if (isFriendOnline) return "Online";

    if (lastSeen) {
      const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return lastSeenDate.toLocaleDateString();
    }

    return "Offline";
  };

  const getMessageDate = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
  };

  const isSameDay = (tsA, tsB) => {
    if (!tsA || !tsB) return false;
    const a = getMessageDate(tsA);
    const b = getMessageDate(tsB);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const formatDateHeader = (date) => {
    if (!date) return "";
    const d = getMessageDate(date);
    const now = new Date();

    const diff = Math.floor((stripTime(now) - stripTime(d)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";

    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const stripTime = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  useEffect(() => {
    const loadCloudinaryScript = () => {
      if (window.cloudinary) {
        setCloudinaryLoaded(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://upload-widget.cloudinary.com/global/all.js";
      script.type = "text/javascript";
      script.async = true;

      script.onload = () => {
        console.log("Cloudinary script loaded successfully");
        setCloudinaryLoaded(true);
      };

      script.onerror = () => {
        console.error("Failed to load Cloudinary script");
        setCloudinaryLoaded(false);
      };

      document.head.appendChild(script);
    };

    loadCloudinaryScript();
  }, []);

  useEffect(() => {
    if (!user || !friend) return;

    const setup = async () => {
      try {
        const id = await getOrCreateChat(user.uid, friend.uid);
        setChatId(id);
        await markMessagesAsRead(id, user.uid);
      } catch (error) {
        console.error("Error initializing chat:", error);
      }

      try {
        const userFriends = await getUserFriends(user.uid);
        setFriends(userFriends);
      } catch (error) {
        console.error("Error loading friends:", error);
      }
    };

    setup();
  }, [user, friend]);

  const handleImageUploadClick = async () => {
    if (!cloudinaryLoaded) {
      alert("Image upload is still loading. Please try again in a moment.");
      return;
    }

    setUploadingImage(true);
    try {
      const imageResult = await openUploadWidget();

      if (imageResult) {
        await sendMessage(chatId, user.uid, "", imageResult);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      if (error.message !== "Upload cancelled") {
        alert("Error uploading image: " + error.message);
      }
    }
    setUploadingImage(false);
  };

  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = listenToChatMessages(chatId, (chatMessages) => {
      setMessages(chatMessages);
      scrollToBottom();
      markMessagesAsRead(chatId, user.uid);
      chatMessages.forEach(message => {
        if (message.senderId === friend.uid && !message.seenBy?.includes(user.uid)) {
      }
      });
    });

    return unsubscribe;
  }, [chatId, user.uid]);
  
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault(); // Prevent form submission refresh
    
    // Get the text from inputRef (since you're using controlled component)
    const text = inputRef.current?.value?.trim();
    
    // For debugging
    console.log('Sending message:', { 
      text, 
      selectedImage, 
      replyingTo: !!replyingTo,
      chatId 
    });
    
    if (!text && !selectedImage) {
      console.log('No content to send');
      return;
    }

    try {
      if (replyingTo) {
        console.log('Sending reply:', { replyText, originalMessageId: replyingTo.id });
        await replyToMessage(chatId, replyingTo.id, text, user.uid, selectedImage);
        
        // Clear reply state
        setReplyingTo(null);
        if (inputRef.current) {
          inputRef.current.value = '';
          setReplyText(''); // Also clear the replyText state
        }
      } else {
        console.log('Sending normal message:', text);
        await sendMessage(chatId, user.uid, text, selectedImage);
        
        // Clear input
        if (inputRef.current) {
          inputRef.current.value = '';
          setNewMessage(''); // Also clear the newMessage state
        }
      }
      
      // Clear image if any
      setSelectedImage(null);
      
      // Scroll to bottom
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message: ' + error.message);
    }
  };

  const handleSaveMessage = async (messageId) => {
    try {
      await saveMessage(chatId, messageId, user.uid);
      setShowMessageMenu(false);
    } catch (error) {
      console.error("Error saving message:", error);
      alert("Error saving message: " + error.message);
    }
  };

  const handleUnsaveMessage = async (messageId) => {
    try {
      await unsaveMessage(chatId, messageId);
      setShowMessageMenu(false);
    } catch (error) {
      console.error("Error unsaving message:", error);
      alert("Error unsaving message: " + error.message);
    }
  };

  const handleStartEdit = (message) => {
    if (message.senderId !== user.uid) return;

    if (!message.canEditUntil) {
      alert("This message cannot be edited.");
      return;
    }

    const now = new Date();
    const canEditUntil = message.canEditUntil.toDate
      ? message.canEditUntil.toDate()
      : new Date(message.canEditUntil);

    if (now > canEditUntil) {
      alert(
        "Edit time expired. You can only edit messages within 15 minutes of sending.",
      );
      return;
    }

    setEditingMessageId(message.id);
    setEditText(message.text);
    setShowMessageMenu(false);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const handleSaveEdit = async (messageId) => {
    if (!editText.trim()) return;

    try {
      await editMessage(chatId, messageId, editText.trim(), user.uid);
      setEditingMessageId(null);
      setEditText("");
    } catch (error) {
      console.error("Error editing message:", error);
      alert("Error editing message: " + error.message);
    }
  };

  const handleMessageHover = (message) => {
    setHoveredMessage(message);
  };

  const handleMessageLeave = () => {
    setHoveredMessage(null);
  };

  const handleArrowClick = (e, message) => {
    e.stopPropagation();
    setSelectedMessage(message);
    setShowMessageMenu(true);
  };

  const handleForwardClick = (message) => {
    setSelectedMessage(message);
    setSelectedFriends([]);
    setShowForwardPopup(true);
    setShowMessageMenu(false);
  };

  const handleFriendSelection = (friendId) => {
    setSelectedFriends((prev) => {
      if (prev.includes(friendId)) {
        return prev.filter((id) => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const handleForwardMessages = async () => {
    if (!selectedMessage || selectedFriends.length === 0) return;

    setForwarding(true);
    try {
      const forwardPromises = selectedFriends.map(async (friendId) => {
        const forwardChatId = await getOrCreateChat(user.uid, friendId);
        await sendMessage(forwardChatId, user.uid, selectedMessage.text);
      });

      await Promise.all(forwardPromises);

      setShowForwardPopup(false);
      setSelectedFriends([]);
      setForwarding(false);
      alert(`Message forwarded to ${selectedFriends.length} friend(s)`);
    } catch (error) {
      console.error("Error forwarding message:", error);
      alert("Error forwarding message: " + error.message);
      setForwarding(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showMessageMenu &&
        !e.target.closest(".chat-dropdown-menu") &&
        !e.target.closest(".chat-menu-arrow")
      ) {
        setShowMessageMenu(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showMessageMenu]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const canEditMessage = (message) => {
    if (message.senderId !== user.uid) return false;
    if (!message.canEditUntil) return false;

    try {
      const now = new Date();
      const canEditUntil = message.canEditUntil.toDate
        ? message.canEditUntil.toDate()
        : new Date(message.canEditUntil);
      return now <= canEditUntil;
    } catch (error) {
      return false;
    }
  };

  const isMessageSaved = (message) => {
    return message.isSaved === true;
  };

  const isMessageEdited = (message) => {
    return message.isEdited === true;
  };

  const renderMessageContent = (message) => {
    const isSeenByRecipient = message.senderId === user.uid && message.read === true;
    
    // Common status component
    const renderMessageStatus = () => (
      <div className="chat-message-status">
        <span className="chat-message-time">
          {formatTime(message.timestamp)}
        </span>
        {isMessageEdited(message) && (
          <span className="chat-edited-indicator">Edited</span>
        )}
        {isMessageSaved(message) && (
          <span className="chat-saved-indicator">⭐</span>
        )}
        {/* Single tick indicator */}
        {message.senderId === user.uid && (
          <span className={`chat-read-indicator ${isSeenByRecipient ? 'seen' : ''}`}>
            {isSeenByRecipient ? '✓' : ''}
          </span>
        )}
      </div>
    );

    // Reply indicator component
    const renderReplyIndicator = () => (
      message.isReply && message.originalMessageText && (
        <div className="reply-indicator">
          <span className="reply-icon">Replied to</span>
          <div className="quoted-message">
            {message.originalMessageType === 'image' ? '📷 Image' : message.originalMessageText}
          </div>
        </div>
      )
    );

    if (message.type === "image" && message.image) {
      return (
        <div className="chat-image-message">
          {/* Reply indicator for image messages */}
          {renderReplyIndicator()}
          
          <img
            src={getOptimizedImageUrl(message.image.publicId, 400, 400)}
            alt={message.text || "Attachment"}
            className="chat-image"
            onClick={() => window.open(message.image.url, "_blank")}
          />
          
          {/* Image caption */}
          {message.text && <p className="chat-image-caption">{message.text}</p>}
          
          {/* Message status */}
          {renderMessageStatus()}
        </div>
      );
    }

    // Text message or mixed content
    return (
      <>
        {/* Reply indicator */}
        {renderReplyIndicator()}
        
        {/* Message text */}
        {message.text && <p className="chat-message-text">{message.text}</p>}
        
        {/* Image attachment (for text messages with images) */}
        {message.image && (
          <img 
            src={message.image.url} 
            alt="Message attachment" 
            className="message-image" 
          />
        )}
        
        {/* Message status */}
        {renderMessageStatus()}
      </>
    );
  };

  const renderMenuOptions = (message) => {
    if (message.type === "image") {
      return (
        <>
          {isMessageSaved(message) ? (
            <div
              className="menu-item"
              onClick={() => handleUnsaveMessage(message.id)}
            >
              Unstar
            </div>
          ) : (
            <div
              className="menu-item"
              onClick={() => handleSaveMessage(message.id)}
            >
              Star
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <div
          className="menu-item"
          onClick={() => navigator.clipboard.writeText(message.text)}
        >
          Copy
        </div>
        <div className="menu-item" onClick={() => handleForwardClick(message)}>
          Forward
        </div>
        {isMessageSaved(message) ? (
          <div
            className="menu-item"
            onClick={() => handleUnsaveMessage(message.id)}
          >
            Unstar
          </div>
        ) : (
          <div
            className="menu-item"
            onClick={() => handleSaveMessage(message.id)}
          >
            Star
          </div>
        )}
        {canEditMessage(message) && (
          <div className="menu-item" onClick={() => handleStartEdit(message)}>
            Edit
          </div>
        )}
      </>
    );
  };

  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!user?.uid || !friend?.uid) return;
      
      try {
        const blockedList = await getBlockedUsers(user.uid);
        setBlockedUsers(blockedList);
        
        const isUserBlocked = blockedList.some(blockedUser => 
          blockedUser.uid === friend.uid
        );
        setIsBlocked(isUserBlocked);
      } catch (error) {
        console.error("Error checking block status:", error);
      }
    };

    checkBlockStatus();
  }, [user?.uid, friend?.uid]);

  const handleBlockUser = async () => {
    if (!user?.uid || !friend?.uid) return;
    
    try {
      if (isBlocked) {
        await unblockUser(user.uid, friend.uid);
        setIsBlocked(false);
        setBlockedUsers(prev => prev.filter(u => u.uid !== friend.uid));
        alert(`${friend.displayName} has been unblocked.`);
      } else {
        const confirmBlock = window.confirm(
          `Block ${friend.displayName}? You won't be able to message each other.`
        );
        
        if (confirmBlock) {
          await blockUser(user.uid, friend.uid);
          setIsBlocked(true);
          setBlockedUsers(prev => [...prev, friend]);
          alert(`${friend.displayName} has been blocked.`);
        }
      }
      setShowUserMenu(false);
    } catch (error) {
      console.error("Error blocking/unblocking user:", error);
      alert("Error: " + error.message);
    }
  };

  const handleDeleteChat = async () => {
    if (!chatId || !user?.uid) return;
    
    const confirmDelete = window.confirm(
      "Delete this chat? This will remove all messages and cannot be undone."
    );
    
    if (!confirmDelete) return;
    
    try {
      await deleteChat(chatId, user.uid);
      alert("Chat deleted successfully.");
      onBack(); // Go back to friends list
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Error: " + error.message);
    }
    setShowUserMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showUserMenu &&
        !e.target.closest(".chat-user-menu-button") &&
        !e.target.closest(".chat-user-dropdown-menu")
      ) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showUserMenu]);

  const handleStartReply = (message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  if (!friend) {
    return (
      <div className="chat-container">
        <div className="chat-placeholder">
          <h3>Select a friend to start chatting</h3>
          <p>
            Choose a friend from your friends list to begin your conversation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-container ${isBlocked ? 'blocked' : ''}`}>
      {/* Chat Header */}
      <div className="chat-header">
        <button onClick={onBack} className="chat-back-button">
          <svg aria-label="Close" class="x1lliihq x1n2onr6 x9bdzbf" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18"><title>Close</title><polyline fill="none" points="20.643 3.357 12 12 3.353 20.647" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></polyline><line fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" x1="20.649" x2="3.354" y1="20.649" y2="3.354"></line></svg>
        </button>
        <div className="chat-user-info">
          <div className="chat-avatar-with-status">
            <img
              src={friend.photoURL}
              alt={friend.displayName}
              className="chat-user-avatar"
            />
            <div className={`chat-online-indicator ${isFriendOnline ? 'online' : 'offline'}`}></div>
          </div>
          <div>
            <h3 className="chat-user-name">{friend.displayName}</h3>
            <p className={`user-status ${isFriendOnline ? 'online' : 'offline'}`}>
              {isFriendOnline ? 'Online' : getLastSeenText()}
            </p>
          </div>
        </div>

        {/* User Menu Button*/}
        <div className="chat-header-actions">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="chat-user-menu-button"
            title="More options"
          >
            <svg aria-label="More options" className="x1lliihq x1n2onr6 x9bdzbf" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>More options</title><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
          </button>
          
          {showUserMenu && (
            <div className="chat-user-dropdown-menu">
              <button
                onClick={handleBlockUser}
                className="chat-menu-item block-button"
              >
                {isBlocked ? "Unblock User" : "Block User"}
              </button>
              <button
                onClick={handleDeleteChat}
                className="chat-menu-item delete-button"
              >
                Delete Chat
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowMusicPlayer(true)}
          className="chat-music-button"
          disabled={loading}
        >
          <svg aria-label="Reels" class="x1lliihq x1n2onr6 x5n08af" height="24" viewBox="0 0 24 24" width="24"><title>Music</title><path d="M22.935 7.468c-.063-1.36-.307-2.142-.512-2.67a5.341 5.341 0 0 0-1.27-1.95 5.345 5.345 0 0 0-1.95-1.27c-.53-.206-1.311-.45-2.672-.513C15.333 1.012 14.976 1 12 1s-3.333.012-4.532.065c-1.36.063-2.142.307-2.67.512-.77.298-1.371.69-1.95 1.27a5.36 5.36 0 0 0-1.27 1.95c-.206.53-.45 1.311-.513 2.672C1.012 8.667 1 9.024 1 12s.012 3.333.065 4.532c.063 1.36.307 2.142.512 2.67.297.77.69 1.372 1.27 1.95.58.581 1.181.974 1.95 1.27.53.206 1.311.45 2.672.513C8.667 22.988 9.024 23 12 23s3.333-.012 4.532-.065c1.36-.063 2.142-.307 2.67-.512a5.33 5.33 0 0 0 1.95-1.27 5.356 5.356 0 0 0 1.27-1.95c.206-.53.45-1.311.513-2.672.053-1.198.065-1.555.065-4.531s-.012-3.333-.065-4.532Zm-1.998 8.972c-.05 1.07-.228 1.652-.38 2.04-.197.51-.434.874-.82 1.258a3.362 3.362 0 0 1-1.258.82c-.387.151-.97.33-2.038.379-1.162.052-1.51.063-4.441.063s-3.28-.01-4.44-.063c-1.07-.05-1.652-.228-2.04-.38a3.354 3.354 0 0 1-1.258-.82 3.362 3.362 0 0 1-.82-1.258c-.151-.387-.33-.97-.379-2.038C3.011 15.28 3 14.931 3 12s.01-3.28.063-4.44c.05-1.07.228-1.652.38-2.04.197-.51.434-.875.82-1.26a3.372 3.372 0 0 1 1.258-.819c.387-.15.97-.329 2.038-.378C8.72 3.011 9.069 3 12 3s3.28.01 4.44.063c1.07.05 1.652.228 2.04.38.51.197.874.433 1.258.82.385.382.622.747.82 1.258.151.387.33.97.379 2.038C20.989 8.72 21 9.069 21 12s-.01 3.28-.063 4.44Zm-4.584-6.828-5.25-3a2.725 2.725 0 0 0-2.745.01A2.722 2.722 0 0 0 6.988 9v6c0 .992.512 1.88 1.37 2.379.432.25.906.376 1.38.376.468 0 .937-.123 1.365-.367l5.25-3c.868-.496 1.385-1.389 1.385-2.388s-.517-1.892-1.385-2.388Zm-.993 3.04-5.25 3a.74.74 0 0 1-.748-.003.74.74 0 0 1-.374-.649V9a.74.74 0 0 1 .374-.65.737.737 0 0 1 .748-.002l5.25 3c.341.196.378.521.378.652s-.037.456-.378.651Z"></path></svg>
        </button>
      </div>

      {/* Messages Area */}
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const prev = index > 0 ? messages[index - 1] : null;
            const showDateSeparator = !prev || !isSameDay(prev.timestamp, message.timestamp);

            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <div className="chat-date-separator">
                    {formatDateHeader(message.timestamp)}
                  </div>
                )}

                <div
                  className={`chat-message-wrapper ${
                    message.senderId === user.uid
                      ? "chat-sent-wrapper"
                      : "chat-received-wrapper"
                  }`}
                  onMouseEnter={() => handleMessageHover(message)}
                  onMouseLeave={handleMessageLeave}
                >
                  {/* Menu Arrow - Left side */}
                  {hoveredMessage?.id === message.id && (
                    <div className="chat-menu-arrow-container">
                      <button
                        className="chat-menu-arrow"
                        onClick={(e) => handleArrowClick(e, message)}
                        title="Message options"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`chat-message-bubble ${
                      message.senderId === user.uid
                        ? "chat-sent-message"
                        : "chat-received-message"
                    } ${isMessageSaved(message) ? "chat-saved-message" : ""}`}
                  >

                    <div className="chat-message-content">
                      {editingMessageId === message.id ? (
                        <div className="chat-edit-container">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="chat-edit-input"
                            autoFocus
                          />
                          <div className="chat-edit-actions">
                            <button
                              onClick={() => handleSaveEdit(message.id)}
                              className="chat-edit-save"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="chat-edit-cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        renderMessageContent(message)
                      )}
                    </div>

                    {/* REPLY BUTTON - Add this inside the message bubble */}
                    {message.senderId !== user?.uid && hoveredMessage?.id === message.id && (
                      <button 
                        className="reply-button"
                        onClick={() => handleStartReply(message)}
                        title="Reply to this message"
                      >
                        <span aria-describedby="_r_2a_" class="html-span xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x1hl2dhg x16tdsg8 x1vvkbs x4k7w5x x1h91t0o x1h9r5lt x1jfb8zj xv2umb2 x1beo9mf xaigb6o x12ejxvf x3igimt xarpa2k xedcshv x1lytzrv x1t2pt76 x7ja8zs x1qrby5j"><div aria-disabled="false" role="button" tabindex="0"><div class="x1i10hfl x972fbf x10w94by x1qhh985 x14e42zd x9f619 x3ct3a4 xdj266r x14z9mp xat24cr x1lziwak x16tdsg8 x1hl2dhg xggy1nq x1a2a7pz x6s0dn4 xjbqb8w x1ejq31n x18oe1m7 x1sy0etr xstzfhl x1ypdohk x78zum5 xl56j7k x1y1aw1k xf159sx xwib8y2 xmzvs34 x1epzrsm x1jplu5e x14snt5h x4gyw5p x1o7uuvo x1c9tyrk xeusxvb x1pahc9y x1ertn4p xxk0z11 x1hc1fzr xvy4d1p x15vn3sj" role="button" tabindex="0"><div class="x6s0dn4 x78zum5 xdt5ytf xl56j7k"><svg aria-label="Reply to message from igtestingsub" class="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16"><title>Reply to message from igtestingsub</title><path d="M14 8.999H4.413l5.294-5.292a1 1 0 1 0-1.414-1.414l-7 6.998c-.014.014-.019.033-.032.048A.933.933 0 0 0 1 9.998V10c0 .027.013.05.015.076a.907.907 0 0 0 .282.634l6.996 6.998a1 1 0 0 0 1.414-1.414L4.415 11H14a7.008 7.008 0 0 1 7 7v3.006a1 1 0 0 0 2 0V18a9.01 9.01 0 0 0-9-9Z"></path></svg></div></div></div></span>
                      </button>
                    )}
                  </div>

                  {/* Dropdown Menu - UPDATED: Uses renderMenuOptions function */}
                  {showMessageMenu && selectedMessage?.id === message.id && (
                    <div className="chat-dropdown-menu">
                      {renderMenuOptions(message)}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Forward Popup */}
      {showForwardPopup && (
        <div className="forward-popup-overlay">
          <div className="forward-popup">
            <div className="forward-header">
              <h3>Forward to...</h3>
              <button
                className="forward-close"
                onClick={() => setShowForwardPopup(false)}
              >
                ×
              </button>
            </div>
            <div className="forward-search">
              <input
                type="text"
                placeholder="Search friends..."
                className="forward-search-input"
              />
            </div>
            <div className="forward-friends-list">
              {friends.map((friend) => (
                <div key={friend.uid} className="forward-friend-item">
                  <label className="forward-friend-label">
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(friend.uid)}
                      onChange={() => handleFriendSelection(friend.uid)}
                      className="forward-checkbox"
                    />
                    <img
                      src={friend.photoURL}
                      alt={friend.displayName}
                      className="forward-friend-avatar"
                    />
                    <div className="forward-friend-info">
                      <span className="forward-friend-name">
                        {friend.displayName}
                      </span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
            <div className="forward-actions">
              <button
                onClick={handleForwardMessages}
                disabled={selectedFriends.length === 0 || forwarding}
                className="forward-button"
              >
                {forwarding
                  ? "Forwarding..."
                  : `Forward ${selectedFriends.length > 0 ? `(${selectedFriends.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPLY PREVIEW - Add this right after the chat header */}
      {replyingTo && (
        <div className="reply-preview">
          <div className="reply-info">
            <span>Replying to {replyingTo.senderId === user?.uid ? 'yourself' : 'message'}</span>
            <button onClick={handleCancelReply} className="reply-cancel-button">✕</button>
          </div>
          <div className="original-message-preview">
            {replyingTo.type === 'image' ? '📷 Image' : (replyingTo.text || '').substring(0, 50)}
          </div>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="chat-input-container">
        <button
          type="button"
          onClick={handleImageUploadClick}
          disabled={uploadingImage || loading || !cloudinaryLoaded}
          className="chat-image-upload-button"
          title={cloudinaryLoaded ? "Upload image" : "Loading image upload..."}
        >
          <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor" class="x14ctfv xbudbmw x10l6tqk xwa60dl x11lhmoz"><path d="M12 9.652a3.54 3.54 0 1 0 3.54 3.539A3.543 3.543 0 0 0 12 9.65zm6.59-5.187h-.52a1.107 1.107 0 0 1-1.032-.762 3.103 3.103 0 0 0-3.127-1.961H10.09a3.103 3.103 0 0 0-3.127 1.96 1.107 1.107 0 0 1-1.032.763h-.52A4.414 4.414 0 0 0 1 8.874v9.092a4.413 4.413 0 0 0 4.408 4.408h13.184A4.413 4.413 0 0 0 23 17.966V8.874a4.414 4.414 0 0 0-4.41-4.41zM12 18.73a5.54 5.54 0 1 1 5.54-5.54A5.545 5.545 0 0 1 12 18.73z"></path></svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={replyingTo ? replyText : newMessage}
          onChange={(e) => {
            if (replyingTo) {
              setReplyText(e.target.value);
            } else {
              setNewMessage(e.target.value);
            }
          }}
          placeholder={replyingTo ? "Type your reply..." : "Type here..."}
          className="chat-message-input"
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || (!newMessage.trim() && !replyText.trim() && !selectedImage)}
          className="chat-send-button"
        >
          <svg aria-label="Send" class="x1lliihq x1n2onr6 x9bdzbf" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18"><title>Send</title><path d="M22.513 3.576C21.826 2.552 20.617 2 19.384 2H4.621c-1.474 0-2.878.818-3.46 2.173-.6 1.398-.297 2.935.784 3.997l3.359 3.295a1 1 0 0 0 1.195.156l8.522-4.849a1 1 0 1 1 .988 1.738l-8.526 4.851a1 1 0 0 0-.477 1.104l1.218 5.038c.343 1.418 1.487 2.534 2.927 2.766.208.034.412.051.616.051 1.26 0 2.401-.644 3.066-1.763l7.796-13.118a3.572 3.572 0 0 0-.116-3.863Z"></path></svg>
        </button>
      </form>

      {/* Music Player (pinned under the auto-delete banner) */}
      <MusicPlayer
        chatId={chatId}
        user={user}
        isVisible={showMusicPlayer}
        pinned={true}
        onClose={() => setShowMusicPlayer(false)}
      />
    </div>
  );
}

export default Chat;
