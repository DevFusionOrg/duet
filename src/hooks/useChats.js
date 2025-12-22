import { useState, useEffect, useMemo } from "react";
import { listenToUserChats } from "../firebase/firestore";

export function useChats(user, friends = []) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const friendIds = useMemo(
    () => new Set(friends.map(f => f.uid)),
    [friends]
  );

  // Memoize the filtered and sorted chats to prevent unnecessary re-renders
  // Only recompute when chats or friendIds actually change
  const sortedChats = useMemo(() => {
    if (chats.length === 0) return [];
    
    return chats
      .filter(chat =>
        chat.participants?.some(id => friendIds.has(id))
      )
      .sort((a, b) => {
        const timeA = a.lastMessageAt?.toDate?.() || new Date(0);
        const timeB = b.lastMessageAt?.toDate?.() || new Date(0);
        return timeB - timeA;
      });
  }, [chats, friendIds]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = listenToUserChats(user.uid, (userChats) => {
      setChats(userChats);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  return { chats: sortedChats, loading };
}
