import React, { useState, useEffect, useRef } from "react";
import ChatHeader from '../Components/Chat/ChatHeader';
import ChatMessage from '../Components/Chat/ChatMessage';
import ChatInput from '../Components/Chat/ChatInput';
import MessageMenu from '../Components/Chat/MessageMenu';
import ForwardPopup from '../Components/Chat/ForwardPopup';
import CallScreen from '../Components/Call/CallScreen';
import IncomingCallModal from '../Components/Call/IncomingCallModal';
import MusicPlayer from "../Components/MusicPlayer";

import { useChatSetup } from "../hooks/useChatSetup";
import { useChatMessages } from "../hooks/useChatMessages";
import { useBlockedUsers } from "../hooks/useBlockedUsers";
import { useFriendOnlineStatus } from "../hooks/useFriendOnlineStatus";
import { useCall } from "../hooks/useCall";

import {
  sendMessage,
  markMessagesAsRead,
  saveMessage,
  unsaveMessage,
  editMessage,
  blockUser,
  unblockUser,
  getBlockedUsers,
  deleteChat,
  replyToMessage,
} from "../firebase/firestore";
import { openUploadWidget, getOptimizedImageUrl } from "../services/cloudinary";
import "../styles/Chat.css";

function Chat({ user, friend, onBack }) {
  const { chatId, friends, loading: setupLoading } = useChatSetup(user, friend);
  const { messages, loading: messagesLoading } = useChatMessages(chatId, user);
  const { isBlocked, setIsBlocked } = useBlockedUsers(user?.uid, friend?.uid);
  const { isFriendOnline, lastSeen } = useFriendOnlineStatus(friend?.uid);
  const {
    callState,
    isInCall,
    incomingCall,
    callDuration,
    isSpeaker,
    initiateAudioCall,
    handleAcceptCall,
    handleDeclineCall,
    handleEndCall,
    cleanupIncomingCall,
    handleToggleMute,
    handleToggleSpeaker,
  } = useCall(user, friend, chatId);

  const [newMessage, setNewMessage] = useState("");
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [showForwardPopup, setShowForwardPopup] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cloudinaryLoaded, setCloudinaryLoaded] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const loading = setupLoading || messagesLoading;

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
        setCloudinaryLoaded(true);
      };
      script.onerror = () => {
        setCloudinaryLoaded(false);
      };
      document.head.appendChild(script);
    };
    loadCloudinaryScript();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && chatId && user?.uid) {
        markMessagesAsRead(chatId, user.uid);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [chatId, user?.uid]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMessageMenu && !e.target.closest(".chat-dropdown-menu") && !e.target.closest(".chat-menu-arrow")) {
        setShowMessageMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showMessageMenu]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showUserMenu && !e.target.closest(".chat-user-menu-button") && !e.target.closest(".chat-user-dropdown-menu")) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showUserMenu]);

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

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      scrollToBottom();
    }
  }, [messages, loading]);

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
    const container = document.querySelector(".chat-messages-container");

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

      setShowScrollButton(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isBlocked) {
      alert("You cannot send messages to a user you have blocked. Unblock them first.");
      return;
    }

    const text = inputRef.current?.value?.trim();
    if (!text && !selectedImage) return;

    try {
      if (replyingTo) {
        await replyToMessage(chatId, replyingTo.id, text, user.uid, selectedImage);
        setReplyingTo(null);
        if (inputRef.current) {
          inputRef.current.value = '';
          setReplyText('');
        }
      } else {
        await sendMessage(chatId, user.uid, text, selectedImage);
        if (inputRef.current) {
          inputRef.current.value = '';
          setNewMessage('');
        }
      }
      setSelectedImage(null);
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

  const handleStartEdit = (message) => {
    if (!canEditMessage(message)) {
      alert("Edit time expired. You can only edit messages within 15 minutes of sending.");
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

  const isMessageSaved = (message) => {
    return message.isSaved === true;
  };

  const isMessageEdited = (message) => {
    return message.isEdited === true;
  };

  const handleBlockUser = async () => {
    if (!user?.uid || !friend?.uid) return;
    try {
      if (isBlocked) {
        await unblockUser(user.uid, friend.uid);
        setIsBlocked(false);
        await getBlockedUsers(user.uid);
        alert(`${friend.displayName} has been unblocked.`);
      } else {
        const confirmBlock = window.confirm(
          `Block ${friend.displayName}? You won't be able to message each other.`
        );
        if (confirmBlock) {
          await blockUser(user.uid, friend.uid);
          setIsBlocked(true);
          await getBlockedUsers(user.uid);
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
      onBack();
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Error: " + error.message);
    }
    setShowUserMenu(false);
  };

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
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-container ${isBlocked ? 'blocked' : ''}`}>
      <ChatHeader
        user={user}
        friend={friend}
        onBack={onBack}
        isBlocked={isBlocked}
        isFriendOnline={isFriendOnline}
        lastSeen={lastSeen}
        onToggleUserMenu={() => setShowUserMenu(!showUserMenu)}
        showUserMenu={showUserMenu}
        onBlockUser={handleBlockUser}
        onDeleteChat={handleDeleteChat}
        onToggleMusicPlayer={() => setShowMusicPlayer(true)}
        onInitiateAudioCall={initiateAudioCall}
        loading={loading}
        isInCall={isInCall}
        callState={callState}
      />

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
              <ChatMessage
                key={message.id}
                message={message}
                user={user}
                friend={friend}
                isFirstOfDay={showDateSeparator}
                formatDateHeader={formatDateHeader}
                formatTime={formatTime}
                isMessageSaved={isMessageSaved}
                isMessageEdited={isMessageEdited}
                hoveredMessage={hoveredMessage}
                editingMessageId={editingMessageId}
                editText={editText}
                selectedMessage={selectedMessage}
                showMessageMenu={showMessageMenu}
                onMessageHover={handleMessageHover}
                onMessageLeave={handleMessageLeave}
                onArrowClick={handleArrowClick}
                onStartEdit={(value) => setEditText(value)}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onStartReply={handleStartReply}
                renderMenuOptions={() => (
                  <MessageMenu
                    message={message}
                    canEditMessage={canEditMessage}
                    isMessageSaved={isMessageSaved}
                    onCopyMessage={(text) => navigator.clipboard.writeText(text)}
                    onForwardMessage={handleForwardClick}
                    onSaveMessage={handleSaveMessage}
                    onUnsaveMessage={handleUnsaveMessage}
                    onStartEdit={handleStartEdit}
                  />
                )}
                getOptimizedImageUrl={getOptimizedImageUrl}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {showForwardPopup && (
        <ForwardPopup
          friends={friends}
          selectedFriends={selectedFriends}
          onFriendSelection={handleFriendSelection}
          onForwardMessages={handleForwardMessages}
          onClose={() => setShowForwardPopup(false)}
          forwarding={forwarding}
        />
      )}

      {showScrollButton && (
        <button 
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
        >
          ↓
        </button>
      )}

      <ChatInput
        user={user}
        isBlocked={isBlocked}
        replyingTo={replyingTo}
        replyText={replyText}
        newMessage={newMessage}
        selectedImage={selectedImage}
        uploadingImage={uploadingImage}
        cloudinaryLoaded={cloudinaryLoaded}
        loading={loading}
        inputRef={inputRef}
        onImageUploadClick={handleImageUploadClick}
        onInputChange={(e) => {
          if (isBlocked) return;
          if (replyingTo) {
            setReplyText(e.target.value);
          } else {
            setNewMessage(e.target.value);
          }
        }}
        onCancelReply={handleCancelReply}
        onSendMessage={handleSendMessage}
      />

      <MusicPlayer
        chatId={chatId}
        user={user}
        isVisible={showMusicPlayer}
        pinned={true}
        onClose={() => setShowMusicPlayer(false)}
      />
      
      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callerPhoto={friend?.photoURL}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          onClose={cleanupIncomingCall}
          ringtonePlaying={true}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-avatar.png";
          }}
        />
      )}
      
      {isInCall && friend && (
        <CallScreen
          friend={friend}
          callState={callState}
          callDuration={callDuration}
          isSpeaker={isSpeaker}
          onEndCall={handleEndCall}
          onToggleMute={handleToggleMute}
          onToggleSpeaker={handleToggleSpeaker}
          isInitiator={!incomingCall}
        />
      )}
      
      <audio className="remote-audio" autoPlay playsInline />
    </div>
  );
}

export default Chat;