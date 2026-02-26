import React, { useState, useRef, useEffect } from "react";

function ChatInput({
  user,
  isBlocked,
  replyingTo,
  replyText,
  newMessage,
  selectedImage,
  uploadingImage,
  loading,
  inputRef,
  onImageUploadClick,
  onInputChange,
  onCancelReply,
  onSendMessage,
  onVoiceRecordClick
}) {
  const [sending, setSending] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const isMobileDevice = () => {
    if (typeof navigator === "undefined" || typeof window === "undefined") return false;
    const ua = navigator.userAgent || "";
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const touchDesktop = navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 1024px)").matches;
    return mobileUA || touchDesktop;
  };

  useEffect(() => {
    return () => {
      galleryItems.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [galleryItems]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    onSendMessage(e);
    setSending(false);
  };

  const handleOpenAttachmentSheet = () => {
    if (uploadingImage || isBlocked) return;
    setShowAttachmentSheet(true);

    if (isMobileDevice()) {
      setTimeout(() => {
        cameraInputRef.current?.click();
      }, 0);
    }
  };

  const handleCameraUpload = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryPicker = () => {
    galleryInputRef.current?.click();
  };

  const handleCameraFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      onImageUploadClick(file);
      setShowAttachmentSheet(false);
    }
    e.target.value = "";
  };

  const handleGalleryFileChange = (e) => {
    const files = Array.from(e.target.files || []).filter((file) => file.type?.startsWith("image/"));
    if (files.length === 0) {
      e.target.value = "";
      return;
    }

    const newItems = files.slice(0, 10).map((file) => ({
      id: `${file.name}_${file.size}_${file.lastModified}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setGalleryItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      const deduped = newItems.filter((item) => !existingIds.has(item.id));
      return [...prev, ...deduped].slice(0, 12);
    });

    e.target.value = "";
  };

  const handleGalleryImageSend = async (itemId) => {
    const item = galleryItems.find((entry) => entry.id === itemId);
    if (!item) return;

    await onImageUploadClick(item.file);
    setShowAttachmentSheet(false);

    setGalleryItems((prev) => {
      const selected = prev.find((entry) => entry.id === itemId);
      if (selected) {
        URL.revokeObjectURL(selected.preview);
      }
      return prev.filter((entry) => entry.id !== itemId);
    });
  };

  const clearGalleryItems = () => {
    galleryItems.forEach((item) => URL.revokeObjectURL(item.preview));
    setGalleryItems([]);
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

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="chat-hidden-file-input"
        onChange={handleCameraFileChange}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="chat-hidden-file-input"
        onChange={handleGalleryFileChange}
      />
      
      <form onSubmit={handleSubmit} className="chat-input-container">
        <button
          type="button"
          onClick={handleOpenAttachmentSheet}
          disabled={uploadingImage || isBlocked}
          className="chat-image-upload-button"
          title={isBlocked ? "You have blocked this user" : "Attach photo"}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M9 4l-1.5 2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.5L15 4H9zm3 4.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={handleVoiceRecord}
          disabled={isBlocked || uploadingImage}
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
          disabled={isBlocked || uploadingImage}
        />

        <button
          type="submit"
          disabled={sending || (!newMessage.trim() && !replyText.trim() && !selectedImage) || isBlocked || uploadingImage}
          className={`chat-send-button ${isBlocked ? 'disabled' : ''}`}
          title={isBlocked ? "You have blocked this user" : "Send message"}
        >
          <svg aria-label="Send" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>

      {showAttachmentSheet && (
        <div className="chat-attachment-sheet-overlay" onClick={() => setShowAttachmentSheet(false)}>
          <div className="chat-attachment-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="chat-attachment-sheet-header">
              <span>Attach photo</span>
              <button
                type="button"
                className="chat-attachment-close"
                onClick={() => setShowAttachmentSheet(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="chat-attachment-actions">
              <button
                type="button"
                onClick={handleCameraUpload}
                disabled={uploadingImage || isBlocked}
                className="chat-attachment-action"
                title="Open camera"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M9 4l-1.5 2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.5L15 4H9zm3 4.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/>
                </svg>
                <span>Camera</span>
              </button>

              <button
                type="button"
                onClick={handleGalleryPicker}
                disabled={uploadingImage || isBlocked}
                className="chat-attachment-action"
                title="Pick from gallery"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-4-3 3-5-5-4 4V5zm4 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                </svg>
                <span>Gallery</span>
              </button>
            </div>

            {galleryItems.length > 0 && (
              <div className="chat-gallery-strip" role="group" aria-label="Gallery quick picks">
                {galleryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="chat-gallery-thumb"
                    onClick={() => handleGalleryImageSend(item.id)}
                    disabled={uploadingImage || isBlocked}
                    title="Send this photo"
                  >
                    <img src={item.preview} alt="Gallery preview" />
                  </button>
                ))}
                <button
                  type="button"
                  className="chat-gallery-clear"
                  onClick={clearGalleryItems}
                  disabled={uploadingImage}
                  title="Clear selected photos"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ChatInput;