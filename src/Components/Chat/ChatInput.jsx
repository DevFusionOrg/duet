import React from "react";

function ChatInput({
  user,
  isBlocked,
  replyingTo,
  replyText,
  newMessage,
  selectedImage,
  uploadingImage,
  cloudinaryLoaded,
  loading,
  inputRef,
  onImageUploadClick,
  onInputChange,
  onCancelReply,
  onSendMessage,
  onVoiceRecordClick
}) {

  const handleSubmit = (e) => {
    e.preventDefault();
    onSendMessage(e);
  };

  const handleImageUpload = async () => {
    // Just call the parent's handler
    onImageUploadClick();
  };

  const handleVoiceRecord = () => {
    if (onVoiceRecordClick) {
      onVoiceRecordClick();
    }
  };

  return (
    <>
      {replyingTo && (
        <div className="reply-preview">
          <div className="reply-info">
            <span>Replying to {replyingTo.senderId === user?.uid ? 'yourself' : 'message'}</span>
            <button onClick={onCancelReply} className="reply-cancel-button">✕</button>
          </div>
          <div className="original-message-preview">
            {replyingTo.type === 'image' ? '📷 Image' : 
             replyingTo.type === 'voice' ? '🎤 Voice message' : 
             (replyingTo.text || '').substring(0, 50)}
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="chat-input-container">
        <button
          type="button"
          onClick={handleImageUpload}
          disabled={uploadingImage || loading || !cloudinaryLoaded || isBlocked}
          className="chat-image-upload-button"
          title={isBlocked ? "You have blocked this user" : (cloudinaryLoaded ? "Upload image" : "Loading image upload...")}
        >
          {uploadingImage ? (
            <span className="upload-spinner-small"></span>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M23 4v2h-3v3h-2V6h-3V4h3V1h2v3h3zm-8.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm.5 2l-1.5 2-2.25-3-3.25 4.5h11L17 11l-2-2zm-8-9h8v2H7c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h2v8c0 2.2-1.8 4-4 4H7c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4z"/>
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={handleVoiceRecord}
          disabled={loading || isBlocked || uploadingImage}
          className="chat-voice-record-button"
          title={isBlocked ? "You have blocked this user" : "Record voice note"}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={replyingTo ? replyText : newMessage}
          onChange={onInputChange}
          placeholder={isBlocked ? "You have blocked this user" : (replyingTo ? "Type your reply..." : "Type here...")}
          className={`chat-message-input ${isBlocked ? 'disabled' : ''}`}
          disabled={loading || isBlocked || uploadingImage}
        />

        <button
          type="submit"
          disabled={loading || (!newMessage.trim() && !replyText.trim() && !selectedImage) || isBlocked || uploadingImage}
          className={`chat-send-button ${isBlocked ? 'disabled' : ''}`}
          title={isBlocked ? "You have blocked this user" : "Send message"}
        >
          {uploadingImage ? (
            <span className="send-spinner"></span>
          ) : (
            <svg aria-label="Send" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </button>
      </form>
    </>
  );
}

export default ChatInput;