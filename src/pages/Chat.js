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
} from "../firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { openUploadWidget, getOptimizedImageUrl } from "../services/cloudinary";
import "../styles/Chat.css";

function Chat({ user, friend, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
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

    // Fix: Add real-time online status tracking
  const [isFriendOnline, setIsFriendOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  // Add this useEffect to track friend's online status
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

  // You can also add a function to get the last seen time
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
    });

    return unsubscribe;
  }, [chatId, user.uid]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    setLoading(true);
    try {
      await sendMessage(chatId, user.uid, newMessage.trim());
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error sending message: " + error.message);
    }
    setLoading(false);
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
    if (message.type === "image" && message.image) {
      return (
        <div className="chat-image-message">
          <img
            src={getOptimizedImageUrl(message.image.publicId, 400, 400)}
            alt={message.text || 'Attachment'}
            className="chat-image"
            onClick={() => window.open(message.image.url, "_blank")}
          />
          {message.text && <p className="chat-image-caption">{message.text}</p>}
        </div>
      );
    }

    return (
      <>
        <p className="chat-message-text">{message.text}</p>
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
        </div>
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

    // For TEXT messages - show all options
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
    <div className="chat-container">
      {/* Chat Header */}
      <div className="chat-header">
        <button onClick={onBack} className="chat-back-button">
          ← Back
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
        <button
          onClick={() => setShowMusicPlayer(true)}
          className="chat-music-button"
          disabled={loading}
        >
          🎵 Sync Music
        </button>
      </div>

      {/* Simple centered warning banner */}
      <div className="chat-auto-deletion-info">
        ⏰ Messages auto-delete in 24 hours. Tap ⭐ to save important messages.
      </div>

      {/* Messages Area */}
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
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
              </div>

              {/* Dropdown Menu - UPDATED: Uses renderMenuOptions function */}
              {showMessageMenu && selectedMessage?.id === message.id && (
                <div className="chat-dropdown-menu">
                  {renderMenuOptions(message)}
                </div>
              )}
            </div>
          ))
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

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="chat-input-container">
        <button
          type="button"
          onClick={handleImageUploadClick}
          disabled={uploadingImage || loading || !cloudinaryLoaded}
          className="chat-image-upload-button"
          title={cloudinaryLoaded ? "Upload image" : "Loading image upload..."}
        >
          {uploadingImage ? "📸" : "📷"}
        </button>

        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="chat-message-input"
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || (!newMessage.trim() && !uploadingImage)}
          className="chat-send-button"
        >
          {loading ? "..." : "Send"}
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
