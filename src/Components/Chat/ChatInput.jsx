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
    onSendMessage(e); // Pass the event
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
          onClick={onImageUploadClick}
          disabled={uploadingImage || loading || !cloudinaryLoaded || isBlocked}
          className="chat-image-upload-button"
          title={isBlocked ? "You have blocked this user" : (cloudinaryLoaded ? "Upload image" : "Loading image upload...")}
        >
          <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor" className="x14ctfv xbudbmw x10l6tqk xwa60dl x11lhmoz">
            <path d="M12 9.652a3.54 3.54 0 1 0 3.54 3.539A3.543 3.543 0 0 0 12 9.65zm6.59-5.187h-.52a1.107 1.107 0 0 1-1.032-.762 3.103 3.103 0 0 0-3.127-1.961H10.09a3.103 3.103 0 0 0-3.127 1.96 1.107 1.107 0 0 1-1.032.763h-.52A4.414 4.414 0 0 0 1 8.874v9.092a4.413 4.413 0 0 0 4.408 4.408h13.184A4.413 4.413 0 0 0 23 17.966V8.874a4.414 4.414 0 0 0-4.41-4.41zM12 18.73a5.54 5.54 0 1 1 5.54-5.54A5.545 5.545 0 0 1 12 18.73z"></path>
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={replyingTo ? replyText : newMessage}
          onChange={onInputChange}
          placeholder={isBlocked ? "You have blocked this user" : (replyingTo ? "Type your reply..." : "Type here...")}
          className={`chat-message-input ${isBlocked ? 'disabled' : ''}`}
          disabled={loading || isBlocked}
        />

        <button
          type="submit"
          disabled={loading || (!newMessage.trim() && !replyText.trim() && !selectedImage) || isBlocked}
          className={`chat-send-button ${isBlocked ? 'disabled' : ''}`}
          title={isBlocked ? "You have blocked this user" : "Send message"}
        >
          <svg aria-label="Send" className="x1lliihq x1n2onr6 x9bdzbf" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18">
            <title>Send</title>
            <path d="M22.513 3.576C21.826 2.552 20.617 2 19.384 2H4.621c-1.474 0-2.878.818-3.46 2.173-.6 1.398-.297 2.935.784 3.997l3.359 3.295a1 1 0 0 0 1.195.156l8.522-4.849a1 1 0 1 1 .988 1.738l-8.526 4.851a1 1 0 0 0-.477 1.104l1.218 5.038c.343 1.418 1.487 2.534 2.927 2.766.208.034.412.051.616.051 1.26 0 2.401-.644 3.066-1.763l7.796-13.118a3.572 3.572 0 0 0-.116-3.863Z"></path>
          </svg>
        </button>
      </form>
    </>
  );
}

export default ChatInput;