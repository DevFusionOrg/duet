import React from "react";

function MessageMenu({ 
  message, 
  canEditMessage, 
  isMessageSaved,
  onCopyMessage,
  onForwardMessage,
  onSaveMessage,
  onUnsaveMessage,
  onStartEdit
}) {
  
  const renderMenuOptions = () => {
    if (message.type === "image") {
      return (
        <>
          {isMessageSaved(message) ? (
            <div
              className="menu-item"
              onClick={() => onUnsaveMessage(message.id)}
            >
              Unstar
            </div>
          ) : (
            <div
              className="menu-item"
              onClick={() => onSaveMessage(message.id)}
            >
              Star
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <div
          className="menu-item"
          onClick={() => onCopyMessage(message.text)}
        >
          Copy
        </div>
        <div className="menu-item" onClick={() => onForwardMessage(message)}>
          Forward
        </div>
        {isMessageSaved(message) ? (
          <div
            className="menu-item"
            onClick={() => onUnsaveMessage(message.id)}
          >
            Unstar
          </div>
        ) : (
          <div
            className="menu-item"
            onClick={() => onSaveMessage(message.id)}
          >
            Star
          </div>
        )}
        {canEditMessage(message) && (
          <div className="menu-item" onClick={() => onStartEdit(message)}>
            Edit
          </div>
        )}
      </>
    );
  };

  return (
    <div className="chat-dropdown-menu">
      {renderMenuOptions()}
    </div>
  );
}

export default MessageMenu;