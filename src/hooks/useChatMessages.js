import { useState, useEffect } from "react";
import { listenToChatMessages, markMessagesAsRead } from "../firebase/firestore";

export function useChatMessages(chatId, user) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !user?.uid) return;
    
    const unsubscribe = listenToChatMessages(chatId, user.uid, (chatMessages) => {
      setMessages(chatMessages);
      setLoading(false);
      
      if (document.visibilityState === "visible") {
        markMessagesAsRead(chatId, user.uid);
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId, user?.uid]);

  return { messages, loading, setMessages };
}
