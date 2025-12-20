import { useState, useEffect } from "react";
import { listenToPresence } from "../firebase/presence";

export function useFriendOnlineStatus(friendId) {
  const [isFriendOnline, setIsFriendOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (!friendId) return;

    const unsubscribe = listenToPresence(friendId, ({ isOnline, lastSeen }) => {
      setIsFriendOnline(isOnline);
      setLastSeen(lastSeen);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [friendId]);

  const getLastSeenText = () => {
    if (isFriendOnline) return "Online";

    if (lastSeen) {
      const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return lastSeenDate.toLocaleDateString();
    }

    return "Offline";
  };

  return { isFriendOnline, lastSeen, getLastSeenText };
}