import { useState, useEffect, useRef } from "react";
import { listenToPresenceMap } from "../firebase/presence";

export function useFriendsOnlineStatus(user, friends) {
  const [friendsOnlineStatus, setFriendsOnlineStatus] = useState({});
  const updateTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user || friends.length === 0) return;

    const friendIds = friends.map(friend => friend.uid);
    const timeoutId = updateTimeoutRef.current;

    const unsubscribe = listenToPresenceMap(friendIds, (status) => {
      const flattened = Object.fromEntries(
        Object.entries(status).map(([id, val]) => [id, val.isOnline])
      );
      setFriendsOnlineStatus(flattened);
    });

    return () => {
      unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, friends]);

  return { friendsOnlineStatus };
}