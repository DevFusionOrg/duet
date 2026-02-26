import React, { useState } from "react";
import VoiceNotePlayer from './VoiceNotePlayer';
import ImageModal from '../ImageModal';

function ChatMessage({ 
  message, 
  user, 
  isFirstOfDay,
  formatDateHeader,
  formatTime,
  isMessageSaved,
  isMessageEdited,
  hoveredMessage,
  editingMessageId,
  editText,
  onMessageHover,
  onMessageLeave,
  onArrowClick,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  getOptimizedImageUrl
}) {

  const isCallMessage = message.type === 'call' || message.type === 'video-call';
  const shouldShowOnRight = isCallMessage 
    ? ((message.callInitiatorId || message.senderId) === user.uid)
    : (message.senderId === user.uid);

  const [expandedImage, setExpandedImage] = useState(null);

  const renderMessageStatus = (message, isSeenByRecipient) => (
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
      {message.senderId === user.uid && (
        message.pending ? (
          <span className="chat-pending-indicator" title="Sending..."></span>
        ) : (
          <span
            className={`chat-read-indicator ${isSeenByRecipient ? 'seen' : 'sent'}`}
            title={isSeenByRecipient ? 'Seen' : 'Sent'}
            aria-label={isSeenByRecipient ? 'Seen' : 'Sent'}
          >
            {isSeenByRecipient ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 8L4 10.5L8 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.5 8L9 10.5L13 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 7L5.2 9.2L10.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
        )
      )}
    </div>
  );

  const renderMessageContent = (message) => {
    const isCallMessage = message.type === 'call' || message.type === 'video-call';
    const isSeenByRecipient = message.senderId === user.uid && message.read === true;

    const renderInlineTextMeta = () => (
      <span className="chat-text-inline-meta">
        <span className="chat-message-time">{formatTime(message.timestamp)}</span>
        {isMessageEdited(message) && <span className="chat-edited-indicator">Edited</span>}
        {isMessageSaved(message) && <span className="chat-saved-indicator">⭐</span>}
        {message.senderId === user.uid && (
          message.pending ? (
            <span className="chat-pending-indicator" title="Sending..."></span>
          ) : (
            <span
              className={`chat-read-indicator ${isSeenByRecipient ? 'seen' : 'sent'}`}
              title={isSeenByRecipient ? 'Seen' : 'Sent'}
              aria-label={isSeenByRecipient ? 'Seen' : 'Sent'}
            >
              {isSeenByRecipient ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.5 8L4 10.5L8 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.5 8L9 10.5L13 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7L5.2 9.2L10.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
          )
        )}
      </span>
    );

    if (isCallMessage) {
      return (
        <div className="call-message-content">
          <div className="call-icon-time">
            <span className="call-icon">
              {message.type === 'video-call' ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              )}
            </span>
            <span className="call-message-text">{message.text}</span>
          </div>
          {renderMessageStatus(message, isSeenByRecipient)}
        </div>
      );
    }

    const renderReplyIndicator = () => (
      message.isReply && message.originalMessageText && (
        <div className="reply-indicator">
          <span className="reply-icon">Replied to</span>
          <div className="quoted-message">
            {message.originalMessageType === 'image' ? '📷 Image' : 
             message.originalMessageType === 'voice' ? '🎤 Voice message' : 
             message.originalMessageText}
          </div>
        </div>
      )
    );

    if (message.type === "voice" && message.voice) {
      return (
        <div className="chat-voice-message">
          {renderReplyIndicator()}
          
          <VoiceNotePlayer 
            voiceUrl={message.voice.url} 
            duration={message.voice.duration}
          />
          
          {renderMessageStatus(message, isSeenByRecipient)}
        </div>
      );
    }

    if (message.type === "image" && message.image) {
      return (
        <div className="chat-image-message">
          {renderReplyIndicator()}
          
          <img
            src={message.image.thumbnailUrl || getOptimizedImageUrl(message.image.publicId, 400, 400)}
            alt={message.text || "Attachment"}
            className="chat-image"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpandedImage(message.image.url)}
          />
          
          {message.text && <p className="chat-image-caption">{message.text}</p>}
          
          {renderMessageStatus(message, isSeenByRecipient)}
        </div>
      );
    }

    return (
      <>
        {renderReplyIndicator()}
        {message.text && (
          <p className="chat-message-text chat-message-text-inline">
            <span className="chat-text-inline-body">{message.text}</span>
            {renderInlineTextMeta()}
          </p>
        )}
        {message.image && (
          <img 
            src={message.image.thumbnailUrl || message.image.url} 
            alt="Message attachment" 
            className="message-image" 
            onClick={() => setExpandedImage(message.image.url)}
            style={{ cursor: 'pointer' }}
          />
        )}
        {!message.text && renderMessageStatus(message, isSeenByRecipient)}
      </>
    );
  };

  return (
    <React.Fragment>
      <ImageModal 
        imageUrl={expandedImage}
        onClose={() => setExpandedImage(null)}
      />
      {isFirstOfDay && (
        <div className="chat-date-separator">
          {formatDateHeader(message.timestamp)}
        </div>
      )}
      
      <div
        className={`chat-message-wrapper ${
          shouldShowOnRight
            ? "chat-sent-wrapper"
            : "chat-received-wrapper"
        }`}
        onMouseEnter={() => onMessageHover(message)}
        onMouseLeave={onMessageLeave}
      >
        {hoveredMessage?.id === message.id && shouldShowOnRight && (
          <div className="chat-menu-trigger-container chat-menu-trigger-left">
            <button
              className="chat-menu-trigger"
              onClick={(e) => onArrowClick(e, message)}
              title="Message options"
            >
              ⋮
            </button>
          </div>
        )}
        
        <div
          className={`chat-message-bubble ${
            shouldShowOnRight
              ? "chat-sent-message"
              : "chat-received-message"
          } ${message.type === 'call' ? "chat-call-message" : message.type === 'video-call' ? "chat-video-call-message" : ""} ${
            isMessageSaved(message) ? "chat-saved-message" : ""
          }`}
        >
          <div className="chat-message-content">
            {editingMessageId === message.id ? (
              <div className="chat-edit-container">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => onStartEdit(e.target.value)}
                  className="chat-edit-input"
                  autoFocus
                />
                <div className="chat-edit-actions">
                  <button
                    onClick={() => onSaveEdit(message.id)}
                    className="chat-edit-save"
                    title="Save edit"
                    aria-label="Save edit"
                  >
                    ↗
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="chat-edit-cancel"
                    title="Cancel edit"
                    aria-label="Cancel edit"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              renderMessageContent(message)
            )}
          </div>
          
        </div>

        {hoveredMessage?.id === message.id && !shouldShowOnRight && (
          <div className="chat-menu-trigger-container chat-menu-trigger-right">
            <button
              className="chat-menu-trigger"
              onClick={(e) => onArrowClick(e, message)}
              title="Message options"
            >
              ⋮
            </button>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

// Memoize to prevent re-renders when props haven't changed
export default React.memo(ChatMessage, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.read === nextProps.message.read &&
    prevProps.message.pending === nextProps.message.pending &&
    prevProps.hoveredMessage === nextProps.hoveredMessage &&
    prevProps.editingMessageId === nextProps.editingMessageId &&
    prevProps.editText === nextProps.editText
  );
});