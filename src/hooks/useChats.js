import { useState, useEffect, useMemo } from "react";
import { listenToUserChats } from "../firebase/firestore";

export function useChats(user, friends = []) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const friendIds = useMemo(
    () => new Set(friends.map(f => f.uid)),
    [friends]
  );

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserChats(user.uid, (userChats) => {
      const filteredChats = userChats
        .filter(chat =>
          chat.participants?.some(id => friendIds.has(id))
        )
        .sort((a, b) => {
          const timeA = a.lastMessageAt?.toDate
            ? a.lastMessageAt.toDate()
            : new Date(a.lastMessageAt || 0);
          const timeB = b.lastMessageAt?.toDate
            ? b.lastMessageAt.toDate()
            : new Date(b.lastMessageAt || 0);
          return timeB - timeA;
        });

      setChats(filteredChats);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid, friendIds]);

  return { chats, loading };
}
