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
  onSendMessage
}) {

  const handleSubmit = (e) => {
    e.preventDefault();
    onSendMessage(e);
  };

  const handleImageUpload = async () => {
    // Just call the parent's handler
    onImageUploadClick();
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
            {replyingTo.type === 'image' ? '📷 Image' : (replyingTo.text || '').substring(0, 50)}
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