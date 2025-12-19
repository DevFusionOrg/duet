import React, { useState, useEffect, useRef } from "react";
import ChatHeader from '../Components/Chat/ChatHeader';
import ChatMessage from '../Components/Chat/ChatMessage';
import ChatInput from '../Components/Chat/ChatInput';
import MessageMenu from '../Components/Chat/MessageMenu';
import ForwardPopup from '../Components/Chat/ForwardPopup';
import CallScreen from '../Components/Call/CallScreen';
import IncomingCallModal from '../Components/Call/IncomingCallModal';
import MusicPlayer from "../Components/MusicPlayer";
import VideoCallScreen from '../Components/Call/VideoCallScreen';
import VoiceRecorder from '../Components/Chat/VoiceRecorder';
import EncryptionIndicator from '../Components/Chat/EncryptionIndicator';

import { useChatSetup } from "../hooks/useChatSetup";
import { useChatMessages } from "../hooks/useChatMessages";
import { useBlockedUsers } from "../hooks/useBlockedUsers";
import { useFriendOnlineStatus } from "../hooks/useFriendOnlineStatus";
import { useCall } from "../hooks/useCall";
import { useVideoCall } from "../hooks/useVideoCall"; 

import {
  sendMessage,
  sendVoiceNote,
  markMessagesAsRead,
  saveMessage,
  unsaveMessage,
  editMessage,
  blockUser,
  unblockUser,
  getBlockedUsers,
  deleteChat,
  replyToMessage,
  setTypingStatus,
  listenToTypingStatus,
} from "../firebase/firestore";
import { openUploadWidget, getOptimizedImageUrl, uploadVoiceNote } from "../services/cloudinary";
import { notificationService } from "../services/notifications";
import "../styles/Chat.css";

function Chat({ user, friend, onBack }) {
  const { chatId, friends, loading: setupLoading } = useChatSetup(user, friend);
  const { messages, loading: messagesLoading } = useChatMessages(chatId, user);
  const { isBlocked } = useBlockedUsers(user?.uid, friend?.uid);
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
    // eslint-disable-next-line no-unused-vars
    cleanupIncomingCall: _cleanupIncomingCall,
    handleToggleMute,
    handleToggleSpeaker,
  } = useCall(user, friend, chatId);

  // NEW: Video call hook - SEPARATE
  const {
    // Video call state
    isVideoCallActive,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    isFrontCamera,
    connectionQuality,
    callState: videoCallState,
    callDuration: videoCallDuration,
    
    // Video call actions
    startVideoCall,
    acceptVideoCall,
    endVideoCall,
    toggleVideo,
    toggleAudio,
    switchCamera,
    
  } = useVideoCall(user, friend, chatId);

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
  const [pendingMessages, setPendingMessages] = useState([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const componentMountedRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const firstUnreadMessageRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const loading = setupLoading || messagesLoading;

  // Separate handlers for different call types
  const handleAudioCall = () => {
    initiateAudioCall();
  };

  const handleVideoCall = () => {
    startVideoCall();
  };

  // Modify handleAcceptCall to handle both audio and video
  const handleAcceptCallWrapper = () => {
    if (incomingCall?.type === 'video') {
      acceptVideoCall(incomingCall);
    } else {
      handleAcceptCall(); // Original audio call handler
    }
  };

  // Modify to handle end call for both types
  const handleEndCallWrapper = () => {
    if (isVideoCallActive) {
      endVideoCall();
    } else {
      handleEndCall(); // Original audio end call
    }
  };

  // Add toggle functions for video calls
  const handleToggleVideo = () => {
    if (isVideoCallActive) {
      return toggleVideo();
    }
    return false;
  };

  const handleToggleAudio = () => {
    if (isVideoCallActive) {
      return toggleAudio();
    } else {
      return handleToggleMute(); // Original audio mute
    }
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
        setCloudinaryLoaded(true);
      };
      script.onerror = () => {
        setCloudinaryLoaded(false);
      };
      document.head.appendChild(script);
    };
    loadCloudinaryScript();
  }, []);

  // Auto-remove pending messages when real messages arrive
  useEffect(() => {
    if (messages.length > 0 && pendingMessages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      // Check if the latest message matches any pending message
      const matchingPending = pendingMessages.find(pm => 
        pm.senderId === latestMessage.senderId &&
        pm.text === latestMessage.text &&
        Math.abs(new Date(latestMessage.timestamp?.toDate?.() || latestMessage.timestamp) - new Date(pm.timestamp)) < 5000
      );
      
      if (matchingPending) {
        setPendingMessages(prev => prev.filter(m => m.id !== matchingPending.id));
      }
    }
  }, [messages, pendingMessages]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only mark as read if page is visible AND this component is still mounted
      if (document.visibilityState === 'visible' && chatId && user?.uid) {
        markMessagesAsRead(chatId, user.uid);
        notificationService.clearAllNotifications(chatId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [chatId, user?.uid]);

  // Only mark messages as read when Chat component is actively displayed
  // Don't mark on mount - only when user returns to the chat
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    
    // Only mark as read if component is mounted and visible
    if (!componentMountedRef.current) return;
    
    // Small delay to ensure component is mounted and visible
    const timer = setTimeout(() => {
      if (componentMountedRef.current) {
        markMessagesAsRead(chatId, user.uid);
        notificationService.clearAllNotifications(chatId);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [chatId, user?.uid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  // Listen to friend's typing status
  useEffect(() => {
    if (!chatId || !user?.uid) return;

    const unsubscribe = listenToTypingStatus(chatId, user.uid, (isTyping) => {
      setIsFriendTyping(isTyping);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId, user?.uid]);

  // Clear typing status when component unmounts or chat changes
  useEffect(() => {
    return () => {
      if (chatId && user?.uid) {
        setTypingStatus(chatId, user.uid, false);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
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
    if (isBlocked) {
      alert("This chat is no longer available.");
      onBack();
    }
  }, [isBlocked, onBack]);

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
      if (isInitialLoadRef.current) {
        // On initial load, find first unread message and position instantly
        const firstUnread = messages.find(msg => !msg.read && msg.senderId !== user?.uid);
        
        // Use requestAnimationFrame to ensure DOM is ready but no visible scroll
        requestAnimationFrame(() => {
          if (firstUnread && firstUnreadMessageRef.current) {
            // Position at first unread message instantly
            firstUnreadMessageRef.current.scrollIntoView({ behavior: "instant", block: "start" });
          } else {
            // If no unread messages, position at bottom instantly
            messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
          }
          isInitialLoadRef.current = false;
        });
      } else {
        // For subsequent updates, smooth scroll to bottom
        scrollToBottom();
      }
    }
  }, [messages, loading, user?.uid]);

  // Reset initial load flag when chat changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    firstUnreadMessageRef.current = null;
  }, [chatId]);

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

  const handleVoiceRecordClick = () => {
    setIsRecordingVoice(true);
  };

  const handleVoiceSend = async (audioBlob, duration) => {
    setSendingVoice(true);
    try {
      const voiceData = await uploadVoiceNote(audioBlob);
      await sendVoiceNote(chatId, user.uid, voiceData);
      setIsRecordingVoice(false);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending voice note:', error);
      alert('Error sending voice note: ' + error.message);
    } finally {
      setSendingVoice(false);
    }
  };

  const handleVoiceCancel = () => {
    setIsRecordingVoice(false);
    setSendingVoice(false);
  };

  const handleInputChange = (e) => {
    if (isBlocked) return;
    
    const value = e.target.value;
    if (replyingTo) {
      setReplyText(value);
    } else {
      setNewMessage(value);
    }

    // Update typing status
    if (chatId && user?.uid) {
      // Set typing to true
      setTypingStatus(chatId, user.uid, true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to clear typing status after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(chatId, user.uid, false);
      }, 3000);
    }
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
      alert("User is Blocked.");
      return;
    }

    const text = inputRef.current?.value?.trim();
    if (!text && !selectedImage) return;

    try {
      // Create a local pending message for instant feedback (red dot)
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const basePending = {
        id: tempId,
        chatId,
        senderId: user.uid,
        senderName: user.displayName || user.username || 'You',
        senderPhoto: user.photoURL || '',
        text: text || '',
        timestamp: new Date(),
        read: false,
        pending: true,
        type: selectedImage ? 'image' : 'text'
      };

      let pendingMsg = basePending;
      if (replyingTo) {
        pendingMsg = {
          ...basePending,
          isReply: true,
          originalMessageId: replyingTo.id,
          originalSenderId: replyingTo.senderId,
          originalMessageText: replyingTo.text || '',
          originalMessageType: replyingTo.type || 'text',
        };
        
        // Include original image if replying to an image message
        if (replyingTo.image) {
          pendingMsg.originalMessageImage = {
            url: replyingTo.image.url,
            publicId: replyingTo.image.publicId,
          };
        }
        
        // Include current image if sending image in reply
        if (selectedImage) {
          pendingMsg.image = selectedImage;
        }
      }

      setPendingMessages((prev) => [...prev, pendingMsg]);

      // Clear input immediately and keep focus for continuous typing
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
      setNewMessage('');
      const wasReply = !!replyingTo;
      if (replyingTo) {
        setReplyText('');
        setReplyingTo(null);
      }

      // Firestore send
      if (wasReply) {
        await replyToMessage(chatId, pendingMsg.originalMessageId, text, user.uid, selectedImage);
      } else {
        await sendMessage(chatId, user.uid, text, selectedImage);
      }

      // Remove pending placeholder when send completes
      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSelectedImage(null);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message: ' + error.message);
      // On error, also remove pending placeholder
      setPendingMessages((prev) => prev.filter((m) => !m.pending));
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
        await getBlockedUsers(user.uid);
        alert(`${friend.displayName} has been unblocked.`);
      } else {
        const confirmBlock = window.confirm(
          `Block ${friend.displayName}? You won't be able to message each other.`
        );
        if (confirmBlock) {
          await blockUser(user.uid, friend.uid);
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
    // Move any text already typed into the reply input, like WhatsApp/Instagram
    const currentTyped = inputRef.current?.value || newMessage || '';
    setReplyText(currentTyped);
    setNewMessage('');
    if (inputRef.current) inputRef.current.value = '';
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

  // Update ChatHeader props
  const chatHeaderProps = {
    user,
    friend,
    onBack,
    isBlocked,
    isFriendOnline,
    isFriendTyping,
    lastSeen,
    onToggleUserMenu: () => setShowUserMenu(!showUserMenu),
    showUserMenu,
    onBlockUser: handleBlockUser,
    onDeleteChat: handleDeleteChat,
    onToggleMusicPlayer: () => setShowMusicPlayer(true),
    onInitiateAudioCall: handleAudioCall, // Audio call handler
    onInitiateVideoCall: handleVideoCall, // NEW: Video call handler
    loading,
    isInCall: isInCall || isVideoCallActive, // Combined call state
    callState: isVideoCallActive ? 'active' : callState, // Use appropriate state
    isVideoCallActive // NEW: Pass video call state
  };

  return (
    <div className={`chat-container ${isBlocked ? 'blocked' : ''}`}>
      <ChatHeader {...chatHeaderProps} />

      <div className="chat-messages-container">
        <EncryptionIndicator />
        {messages.length === 0 && pendingMessages.length === 0 ? (
          <div className="chat-no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          [...messages, ...pendingMessages].map((message, index, arr) => {
            const prev = index > 0 ? arr[index - 1] : null;
            const showDateSeparator = !prev || !isSameDay(prev?.timestamp, message.timestamp);
            const isFirstUnread = !message.read && message.senderId !== user?.uid && 
              arr.slice(0, index).every(m => m.read || m.senderId === user?.uid);
            
            return (
              <div
                key={message.id}
                ref={isFirstUnread ? firstUnreadMessageRef : null}
              >
                <ChatMessage
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
              </div>
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

      {isRecordingVoice ? (
        <VoiceRecorder 
          onSend={handleVoiceSend}
          onCancel={handleVoiceCancel}
          disabled={sendingVoice}
        />
      ) : (
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
          onVoiceRecordClick={handleVoiceRecordClick}
          onInputChange={handleInputChange}
          onCancelReply={handleCancelReply}
          onSendMessage={handleSendMessage}
        />
      )}

      <MusicPlayer
        chatId={chatId}
        user={user}
        isVisible={showMusicPlayer}
        pinned={true}
        onClose={() => setShowMusicPlayer(false)}
      />
      
      {/* Audio Call Screen */}
      {isInCall && friend && !isVideoCallActive && (
        <CallScreen
          friend={friend}
          callState={callState}
          callDuration={callDuration}
          isSpeaker={isSpeaker}
          onEndCall={handleEndCallWrapper}
          onToggleMute={handleToggleAudio}
          onToggleSpeaker={handleToggleSpeaker}
          isInitiator={!incomingCall}
          isVideoCall={false} // This is audio call
        />
      )}
      
      {/* Video Call Screen - Show during all video call states */}
      {(isVideoCallActive || (videoCallState !== 'idle' && videoCallState !== 'ended')) && friend && (
        <VideoCallScreen
          friend={friend}
          callState={videoCallState}
          onEndCall={handleEndCallWrapper}
          onToggleMute={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onSwitchCamera={switchCamera}
          callDuration={videoCallDuration}
          localStream={localStream}
          remoteStream={remoteStream}
          isVideoEnabled={isVideoEnabled}
          isAudioEnabled={isAudioEnabled}
          isMuted={!isAudioEnabled}
          isSpeaker={isSpeaker}
          isFrontCamera={isFrontCamera}
          connectionQuality={connectionQuality}
        />
      )}
      
      {/* Update IncomingCallModal to handle video calls */}
      {incomingCall && (
        <IncomingCallModal
          incomingCall={incomingCall}
          friend={friend}
          onAccept={handleAcceptCallWrapper}
          onDecline={handleDeclineCall}
          isVideoCall={incomingCall?.type === 'video'} // Pass call type
        />
      )}
      
      <audio className="remote-audio" autoPlay playsInline />
    </div>
  );
}

export default Chat;