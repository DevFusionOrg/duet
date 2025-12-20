import { useState, useEffect, useRef } from "react";
import { listenToFriendsOnlineStatus } from "../firebase/firestore";

export function useFriendsOnlineStatus(user, friends) {
  const [friendsOnlineStatus, setFriendsOnlineStatus] = useState({});
  const updateTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user || friends.length === 0) return;

    const friendIds = friends.map(friend => friend.uid);
    const timeoutId = updateTimeoutRef.current;
    
    const unsubscribe = listenToFriendsOnlineStatus(friendIds, (status) => {
      // Update immediately for faster UI response
      setFriendsOnlineStatus(status);
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