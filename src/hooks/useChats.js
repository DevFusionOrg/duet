import { useState, useEffect } from "react";
import { listenToUserChats } from "../firebase/firestore";

export function useChats(user) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserChats(user.uid, (userChats) => {
      // Ensure proper sorting - most recent first
      const sortedChats = [...userChats].sort((a, b) => {
        // Convert timestamps to Date objects for comparison
        const timeA = a.lastMessageAt?.toDate ? a.lastMessageAt.toDate() : new Date(a.lastMessageAt || 0);
        const timeB = b.lastMessageAt?.toDate ? b.lastMessageAt.toDate() : new Date(b.lastMessageAt || 0);
        return timeB.getTime() - timeA.getTime(); // Most recent first
      });
      
      setChats(sortedChats);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return { chats, loading };
}