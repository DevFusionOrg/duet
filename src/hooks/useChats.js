import { useState, useEffect, useMemo } from "react";
import { listenToUserChats } from "../firebase/firestore";

export function useChats(user, friends = []) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const friendIds = useMemo(
    () => friends.map(f => f.uid),
    [friends]
  );

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = listenToUserChats(user.uid, (userChats) => {
      const filteredChats = userChats
        .filter(chat =>
          chat.participants?.some(id => friendIds.includes(id))
        )
        .sort((a, b) => {
          const timeA = a.lastMessageAt?.toDate?.() || new Date(0);
          const timeB = b.lastMessageAt?.toDate?.() || new Date(0);
          return timeB - timeA;
        });

      setChats(filteredChats);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid, friendIds.join(",")]);

  return { chats, loading };
}
