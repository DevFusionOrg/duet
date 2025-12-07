import React from "react";

function ChatMessage({ 
  message, 
  user, 
  friend,
  isFirstOfDay,
  formatDateHeader,
  formatTime,
  isMessageSaved,
  isMessageEdited,
  hoveredMessage,
  editingMessageId,
  editText,
  selectedMessage,
  showMessageMenu,
  onMessageHover,
  onMessageLeave,
  onArrowClick,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onStartReply,
  renderMenuOptions,
  getOptimizedImageUrl
}) {

  const renderMessageContent = (message) => {
    const isSeenByRecipient = message.senderId === user.uid && message.read === true;
    
    const renderMessageStatus = () => (
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
          <span className={`chat-read-indicator ${isSeenByRecipient ? 'seen' : ''}`}>
            {isSeenByRecipient ? '✓' : ''}
          </span>
        )}
      </div>
    );

    const renderReplyIndicator = () => (
      message.isReply && message.originalMessageText && (
        <div className="reply-indicator">
          <span className="reply-icon">Replied to</span>
          <div className="quoted-message">
            {message.originalMessageType === 'image' ? '📷 Image' : message.originalMessageText}
          </div>
        </div>
      )
    );

    if (message.type === "image" && message.image) {
      return (
        <div className="chat-image-message">
          {renderReplyIndicator()}
          
          <img
            src={getOptimizedImageUrl(message.image.publicId, 400, 400)}
            alt={message.text || "Attachment"}
            className="chat-image"
            onClick={() => window.open(message.image.url, "_blank")}
          />
          
          {message.text && <p className="chat-image-caption">{message.text}</p>}
          
          {renderMessageStatus()}
        </div>
      );
    }

    return (
      <>
        {renderReplyIndicator()}
        {message.text && <p className="chat-message-text">{message.text}</p>}
        {message.image && (
          <img 
            src={message.image.url} 
            alt="Message attachment" 
            className="message-image" 
          />
        )}
        {renderMessageStatus()}
      </>
    );
  };

  return (
    <React.Fragment>
      {isFirstOfDay && (
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
        onMouseEnter={() => onMessageHover(message)}
        onMouseLeave={onMessageLeave}
      >
        {hoveredMessage?.id === message.id && (
          <div className="chat-menu-arrow-container">
            <button
              className="chat-menu-arrow"
              onClick={(e) => onArrowClick(e, message)}
              title="Message options"
            >
              ▼
            </button>
          </div>
        )}
        
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
                  onChange={(e) => onStartEdit(e.target.value)}
                  className="chat-edit-input"
                  autoFocus
                />
                <div className="chat-edit-actions">
                  <button
                    onClick={() => onSaveEdit(message.id)}
                    className="chat-edit-save"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
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
          
          {message.senderId !== user?.uid && hoveredMessage?.id === message.id && (
            <button 
              className="reply-button"
              onClick={() => onStartReply(message)}
              title="Reply to this message"
            >
              <span aria-describedby="_r_2a_" className="html-span xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x1hl2dhg x16tdsg8 x1vvkbs x4k7w5x x1h91t0o x1h9r5lt x1jfb8zj xv2umb2 x1beo9mf xaigb6o x12ejxvf x3igimt xarpa2k xedcshv x1lytzrv x1t2pt76 x7ja8zs x1qrby5j">
                <div aria-disabled="false" role="button" tabIndex="0">
                  <div className="x1i10hfl x972fbf x10w94by x1qhh985 x14e42zd x9f619 x3ct3a4 xdj266r x14z9mp xat24cr x1lziwak x16tdsg8 x1hl2dhg xggy1nq x1a2a7pz x6s0dn4 xjbqb8w x1ejq31n x18oe1m7 x1sy0etr xstzfhl x1ypdohk x78zum5 xl56j7k x1y1aw1k xf159sx xwib8y2 xmzvs34 x1epzrsm x1jplu5e x14snt5h x4gyw5p x1o7uuvo x1c9tyrk xeusxvb x1pahc9y x1ertn4p xxk0z11 x1hc1fzr xvy4d1p x15vn3sj" role="button" tabIndex="0">
                    <div className="x6s0dn4 x78zum5 xdt5ytf xl56j7k">
                      <svg aria-label="Reply to message from igtestingsub" className="x1lliihq x1n2onr6 x5n08af" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                        <title>Reply to message from igtestingsub</title>
                        <path d="M14 8.999H4.413l5.294-5.292a1 1 0 1 0-1.414-1.414l-7 6.998c-.014.014-.019.033-.032.048A.933.933 0 0 0 1 9.998V10c0 .027.013.05.015.076a.907.907 0 0 0 .282.634l6.996 6.998a1 1 0 0 0 1.414-1.414L4.415 11H14a7.008 7.008 0 0 1 7 7v3.006a1 1 0 0 0 2 0V18a9.01 9.01 0 0 0-9-9Z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </span>
            </button>
          )}
        </div>
        
        {showMessageMenu && selectedMessage?.id === message.id && (
          <div className="chat-dropdown-menu">
            {renderMenuOptions(message)}
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

export default ChatMessage;