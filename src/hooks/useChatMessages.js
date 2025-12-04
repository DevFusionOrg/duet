import { useState, useEffect } from "react";
import { listenToChatMessages, markMessagesAsRead } from "../firebase/firestore";

export function useChatMessages(chatId, user) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !user?.uid) return;
    
    let previousMessagesLength = 0;
    let lastNotifiedMessageId = null;
    
    const unsubscribe = listenToChatMessages(chatId, user.uid, (chatMessages) => {
      const newMessages = [];
      
      if (previousMessagesLength > 0) {
        const previousMessageIds = new Set(messages.map(msg => msg.id));
        newMessages.push(...chatMessages.filter(msg => 
          !previousMessageIds.has(msg.id) && 
          msg.senderId !== user.uid && 
          msg.id !== lastNotifiedMessageId
        ));
      } else if (chatMessages.length > 0) {
        previousMessagesLength = chatMessages.length;
      }
      
      setMessages(chatMessages);
      setLoading(false);
      
      if (document.visibilityState === 'visible') {
        markMessagesAsRead(chatId, user.uid);
      }
      
      previousMessagesLength = chatMessages.length;
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId, user?.uid]);

  return { messages, loading, setMessages };
}