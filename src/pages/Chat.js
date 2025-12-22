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
import LoadingScreen from '../Components/LoadingScreen';

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
  getBlockedUsersForUser,
  getOrCreateChat,
  deleteChat,
  replyToMessage,
  setTypingStatus,
  listenToTypingStatus,
  loadOlderMessages,
} from "../firebase/firestore";
import { getOptimizedImageUrl, uploadVoiceNote } from "../services/cloudinary";
import { notificationService } from "../services/notifications";
import "../styles/Chat.css";

function Chat({ user, friend, onBack }) {
  
  const isActiveChatRef = useRef(true);
  
  const { chatId, friends, loading: setupLoading } = useChatSetup(user, friend);
  const { messages, loading: messagesLoading, setMessages } = useChatMessages(chatId, user, isActiveChatRef);
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

  const {
    
    isVideoCallActive,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    isFrontCamera,
    connectionQuality,
    callState: videoCallState,
    callDuration: videoCallDuration,

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
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  // Removed unused messagesLoadedCount tracking

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const componentMountedRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const firstUnreadMessageRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const loading = setupLoading || messagesLoading;

  useEffect(() => {
    if (chatId) {
      setHasMoreMessages(true);
      setLoadingOlderMessages(false);
    }
  }, [chatId]);

  const handleAudioCall = () => {
    initiateAudioCall();
  };

  const handleVideoCall = () => {
    startVideoCall();
  };

  const handleAcceptCallWrapper = () => {
    if (incomingCall?.type === 'video') {
      acceptVideoCall(incomingCall);
    } else {
      handleAcceptCall(); 
    }
  };

  const handleEndCallWrapper = () => {
    if (isVideoCallActive) {
      endVideoCall();
    } else {
      handleEndCall(); 
    }
  };

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
      return handleToggleMute(); 
    }
  };

  useEffect(() => {
    if (messages.length > 0 && pendingMessages.length > 0) {
      setPendingMessages(prev => prev.filter(pm => {
        // Check if this pending message has a matching real message
        const hasMatch = messages.some(m => 
          m.senderId === pm.senderId &&
          m.text === pm.text &&
          m.type === pm.type &&
          Math.abs(new Date(m.timestamp?.toDate?.() || m.timestamp) - new Date(pm.timestamp)) < 5000
        );
        // If no match and pending for more than 15 seconds, remove it (failed send)
        const isExpired = Date.now() - new Date(pm.timestamp).getTime() > 15000;
        return !hasMatch && !isExpired;
      }));
    }
  }, [messages, pendingMessages]);

  const handleVoiceRecordClick = () => {
    setIsRecordingVoice(true);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      
      if (document.visibilityState === 'visible' && chatId && user?.uid && isActiveChatRef.current) {
        markMessagesAsRead(chatId, user.uid);
        notificationService.clearAllNotifications(chatId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [chatId, user?.uid]);

  useEffect(() => {
    if (!chatId || !user?.uid) return;

    if (!componentMountedRef.current || !isActiveChatRef.current) return;

    // Mark as read immediately when chat opens
    if (componentMountedRef.current && isActiveChatRef.current) {
      markMessagesAsRead(chatId, user.uid);
      notificationService.clearAllNotifications(chatId);
    }
  }, [chatId, user?.uid]);

  useEffect(() => {
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!chatId || !user?.uid) return;

    const unsubscribe = listenToTypingStatus(chatId, user.uid, (isTyping) => {
      setIsFriendTyping(isTyping);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId, user?.uid]);

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
    // Use requestAnimationFrame for smooth scrolling without delay
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      if (isInitialLoadRef.current) {
        
        const firstUnread = messages.find(msg => !msg.read && msg.senderId !== user?.uid);

        requestAnimationFrame(() => {
          if (firstUnread && firstUnreadMessageRef.current) {
            
            firstUnreadMessageRef.current.scrollIntoView({ behavior: "instant", block: "start" });
          } else {
            
            messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
          }
          isInitialLoadRef.current = false;
        });
      } else {
        
        scrollToBottom();
      }
    }
  }, [messages, loading, user?.uid]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    firstUnreadMessageRef.current = null;
  }, [chatId]);

  const handleImageUploadClick = async () => {
    // Create a temporary file input to bypass Cloudinary widget
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      setUploadingImage(true);
      try {
        // Upload to Cloudinary silently without showing widget
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'duet_chat');
        formData.append('folder', 'duet-chat');

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: 'POST', body: formData }
        );

        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();

        // Send message immediately without showing upload progress
        const imageResult = {
          public_id: data.public_id,
          secure_url: data.secure_url,
          width: data.width,
          height: data.height,
          format: data.format,
        };

        await sendMessage(chatId, user.uid, "", imageResult);
      } catch (error) {
        console.error("Error uploading image:", error);
        if (error.message !== "Upload cancelled") {
          alert("Error uploading image: " + error.message);
        }
      } finally {
        setUploadingImage(false);
      }
    };
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

    if (chatId && user?.uid) {
      
      setTypingStatus(chatId, user.uid, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(chatId, user.uid, false);
      }, 3000);
    }
  };

  useEffect(() => {
    const container = document.querySelector(".chat-messages-container");
    if (!container) return;

    const handleScroll = async () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

      setShowScrollButton(!isAtBottom);

      // Load older messages when scrolling to top
      const isAtTop = container.scrollTop < 100;
      if (isAtTop && !loadingOlderMessages && hasMoreMessages && messages.length > 0) {
        setLoadingOlderMessages(true);
        const oldestMessage = messages[0];
        const oldestTimestamp = oldestMessage.timestamp?.toDate ? 
          oldestMessage.timestamp.toDate() : 
          new Date(oldestMessage.timestamp);
        
        try {
          const { messages: olderMsgs, hasMore } = await loadOlderMessages(
            chatId,
            user.uid,
            oldestTimestamp,
            15 // Load 15 messages per scroll
          );
          
          if (olderMsgs.length > 0) {
            // Prepend older messages
            setMessages(prevMsgs => [...olderMsgs, ...prevMsgs]);
            setHasMoreMessages(hasMore);
          }
        } catch (error) {
          console.error("Error loading older messages:", error);
        } finally {
          setLoadingOlderMessages(false);
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [loadingOlderMessages, hasMoreMessages, messages, chatId, user.uid, setMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isBlocked) {
      alert("User is Blocked.");
      return;
    }

    const text = inputRef.current?.value?.trim();
    if (!text && !selectedImage) return;

    try {
      
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

        if (replyingTo.image) {
          pendingMsg.originalMessageImage = {
            url: replyingTo.image.url,
            publicId: replyingTo.image.publicId,
          };
        }

        if (selectedImage) {
          pendingMsg.image = selectedImage;
        }
      }

      setPendingMessages((prev) => [...prev, pendingMsg]);

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

      if (wasReply) {
        await replyToMessage(chatId, pendingMsg.originalMessageId, text, user.uid, selectedImage);
      } else {
        await sendMessage(chatId, user.uid, text, selectedImage);
      }

      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSelectedImage(null);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message: ' + error.message);
      
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
    if (!selectedMessage || selectedFriends.length === 0 || !user?.uid) return;
    setForwarding(true);
    try {
      const tasks = selectedFriends.map(async (friendId) => {
        const targetChatId = await getOrCreateChat(user.uid, friendId);

        if (selectedMessage.type === "image" && selectedMessage.image) {
          const img = selectedMessage.image;
          await sendMessage(targetChatId, user.uid, selectedMessage.text || "", {
            public_id: img.publicId || img.public_id,
            secure_url: img.url,
            width: img.width,
            height: img.height,
            format: img.format,
          });
          return;
        }

        if (selectedMessage.type === "voice" && selectedMessage.voice) {
          await sendVoiceNote(targetChatId, user.uid, {
            url: selectedMessage.voice.url,
            publicId: selectedMessage.voice.publicId,
            duration: selectedMessage.voice.duration,
            format: selectedMessage.voice.format,
            bytes: selectedMessage.voice.bytes,
          });
          return;
        }

        // Default to text for other message types
        await sendMessage(targetChatId, user.uid, selectedMessage.text || "");
      });

      await Promise.all(tasks);

      setShowForwardPopup(false);
      setSelectedFriends([]);
      alert(`Message forwarded to ${selectedFriends.length} friend(s)`);
    } catch (error) {
      console.error("Error forwarding message:", error);
      alert("Error forwarding message: " + error.message);
    } finally {
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
        await getBlockedUsersForUser(user.uid);
        alert(`${friend.displayName} has been unblocked.`);
      } else {
        const confirmBlock = window.confirm(
          `Block ${friend.displayName}? You won't be able to message each other.`
        );
        if (confirmBlock) {
          await blockUser(user.uid, friend.uid);
          await getBlockedUsersForUser(user.uid);
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
    onInitiateAudioCall: handleAudioCall, 
    onInitiateVideoCall: handleVideoCall, 
    loading,
    isInCall: isInCall || isVideoCallActive, 
    callState: isVideoCallActive ? 'active' : callState, 
    isVideoCallActive 
  };

  return (
    <div className={`chat-container ${isBlocked ? 'blocked' : ''}`}>
      <ChatHeader {...chatHeaderProps} />

      <div className="chat-messages-container">
        {loadingOlderMessages && hasMoreMessages && (
          <div className="chat-loading-older" style={{ textAlign: 'center', padding: '8px 0', color: '#666' }}>
            Loading earlier messages...
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
            <LoadingScreen message="Loading messages..." size="small" />
          </div>
        ) : messages.length === 0 && pendingMessages.length === 0 ? (
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
      
      {}
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
          isVideoCall={false} 
        />
      )}
      
      {}
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
      
      {}
      {incomingCall && (
        <IncomingCallModal
          incomingCall={incomingCall}
          friend={friend}
          onAccept={handleAcceptCallWrapper}
          onDecline={handleDeclineCall}
          isVideoCall={incomingCall?.type === 'video'} 
        />
      )}
      
      <audio className="remote-audio" autoPlay playsInline />
    </div>
  );
}

export default Chat;