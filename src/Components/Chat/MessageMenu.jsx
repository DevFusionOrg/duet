import React from "react";

function MessageMenu({ 
  message, 
  canEditMessage,
  isMessageSaved,
  onReplyMessage,
  onCopyMessage,
  onForwardMessage,
  onSaveMessage,
  onUnsaveMessage,
  onStartEdit
}) {
  const copyPayload = message.text || message.image?.url || "";

  return (
    <div className="chat-menu-icons" role="menu" aria-label="Message actions">
      <button className="menu-item" onClick={() => onReplyMessage(message)} title="Reply" aria-label="Reply">↩</button>
      <button className="menu-item" onClick={() => onCopyMessage(copyPayload)} title="Copy" aria-label="Copy">⧉</button>
      <button className="menu-item" onClick={() => onForwardMessage(message)} title="Forward" aria-label="Forward">↪</button>
      {isMessageSaved(message) ? (
        <button className="menu-item" onClick={() => onUnsaveMessage(message.id)} title="Unstar" aria-label="Unstar">☆</button>
      ) : (
        <button className="menu-item" onClick={() => onSaveMessage(message.id)} title="Star" aria-label="Star">★</button>
      )}
      {canEditMessage(message) && (
        <button className="menu-item" onClick={() => onStartEdit(message)} title="Edit" aria-label="Edit">✎</button>
      )}
    </div>
  );
}

export default MessageMenu;