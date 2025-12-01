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

  const [isFriendOnline, setIsFriendOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

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
            alt={message.text || "Attachment"}
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
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type here..."
          className="chat-message-input"
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || (!newMessage.trim() && !uploadingImage)}
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
