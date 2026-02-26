import { useState, useEffect } from "react";
import { listenToChatMessages } from "../firebase/firestore";

export function useChatMessages(chatId, user, isActiveChatRef) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !user?.uid) return;
    
    const unsubscribe = listenToChatMessages(chatId, user.uid, (chatMessages) => {
      setMessages(chatMessages);
      setLoading(false);
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId, user?.uid, isActiveChatRef]);

  return { messages, loading, setMessages };
}
