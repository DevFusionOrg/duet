import React, { useState, useEffect, useRef } from "react";
import MusicPlayer from '../Components/MusicPlayer';
import { 
  getOrCreateChat, 
  sendMessage, 
  listenToChatMessages, 
  markMessagesAsRead 
} from "../firebase/firestore";
import '../styles/Chat.css'; // Import the CSS file

function Chat({ user, friend, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (user && friend) {
      initializeChat();
    }
  }, [user, friend]);

  const initializeChat = async () => {
    try {
      const id = await getOrCreateChat(user.uid, friend.uid);
      setChatId(id);
      
      // Mark existing messages as read
      await markMessagesAsRead(id, user.uid);
    } catch (error) {
      console.error("Error initializing chat:", error);
    }
  };

  useEffect(() => {
    if (!chatId) return;

    // Listen for real-time messages
    const unsubscribe = listenToChatMessages(chatId, (chatMessages) => {
      setMessages(chatMessages);
      scrollToBottom();
      
      // Mark new messages as read
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

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!friend) {
    return (
      <div className="chat-container">
        <div className="chat-placeholder">
          <h3>Select a friend to start chatting</h3>
          <p>Choose a friend from your friends list to begin your conversation</p>
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
          <img 
            src={friend.photoURL} 
            alt={friend.displayName}
            className="chat-user-avatar"
          />
          <div>
            <h3 className="chat-user-name">{friend.displayName}</h3>
            <p className="chat-user-status">Online</p>
          </div>
        </div>
        {/* Add Music Button */}
        <button 
          onClick={() => setShowMusicPlayer(true)}
          className="chat-music-button"
          disabled={loading}
        >
          🎵 Sync Music
        </button>
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
              className={`chat-message-bubble ${
                message.senderId === user.uid 
                  ? 'chat-sent-message' 
                  : 'chat-received-message'
              }`}
            >
              <div className="chat-message-content">
                <p className="chat-message-text">{message.text}</p>
                <span className="chat-message-time">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="chat-input-container">
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
          disabled={loading || !newMessage.trim()}
          className="chat-send-button"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>

      {/* Music Player */}
      <MusicPlayer
        chatId={chatId}
        user={user}
        isVisible={showMusicPlayer}
        onClose={() => setShowMusicPlayer(false)}
      />
    </div>
  );
}

export default Chat;