import { useState, useEffect, useRef } from "react";
import { listenToChatMessages, markMessagesAsRead } from "../firebase/firestore";

export function useChatMessages(chatId, user, isActiveChatRef) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const markAsReadTimeoutRef = useRef(null);

  useEffect(() => {
    if (!chatId || !user?.uid) return;
    
    const unsubscribe = listenToChatMessages(chatId, user.uid, (chatMessages) => {
      setMessages(chatMessages);
      setLoading(false);
      
      // Only mark messages as read if:
      // 1. Document is visible
      // 2. This chat is the currently active/focused one
      if (document.visibilityState === "visible" && isActiveChatRef?.current) {
        // Small delay to ensure messages are rendered and chat is actually visible
        if (markAsReadTimeoutRef.current) {
          clearTimeout(markAsReadTimeoutRef.current);
        }
        markAsReadTimeoutRef.current = setTimeout(() => {
          if (isActiveChatRef?.current && document.visibilityState === "visible") {
            markMessagesAsRead(chatId, user.uid);
          }
        }, 300);
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [chatId, user?.uid, isActiveChatRef]);

  return { messages, loading, setMessages };
}
