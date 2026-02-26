import { useState, useEffect, useRef } from "react";
import { listenToPresenceMap } from "../firebase/presence";

export function useFriendsOnlineStatus(user, friends) {
  const [friendsOnlineStatus, setFriendsOnlineStatus] = useState({});
  const updateTimeoutRef = useRef(null);
  const pendingStatusRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const DEBOUNCE_MS = 250;

  useEffect(() => {
    if (!user || friends.length === 0) {
      setFriendsOnlineStatus({});
      return;
    }

    const friendIds = friends
      .map((friend) => friend?.uid || friend?.id)
      .filter(Boolean);

    if (friendIds.length === 0) {
      setFriendsOnlineStatus({});
      return;
    }
    const timeoutId = updateTimeoutRef.current;

    const unsubscribe = listenToPresenceMap(friendIds, (status) => {
      const flattened = Object.fromEntries(
        Object.entries(status).map(([id, val]) => [id, val.isOnline])
      );

      pendingStatusRef.current = flattened;

      const now = Date.now();
      const shouldUpdateNow = now - lastUpdateRef.current > DEBOUNCE_MS;

      if (shouldUpdateNow) {
        setFriendsOnlineStatus(pendingStatusRef.current);
        lastUpdateRef.current = now;
        pendingStatusRef.current = null;
      } else {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
          if (pendingStatusRef.current) {
            setFriendsOnlineStatus(pendingStatusRef.current);
            lastUpdateRef.current = Date.now();
            pendingStatusRef.current = null;
          }
        }, DEBOUNCE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      pendingStatusRef.current = null;
    };
  }, [user, friends]);

  return { friendsOnlineStatus };
}