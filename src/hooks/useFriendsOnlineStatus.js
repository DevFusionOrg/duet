import { useState, useEffect, useRef } from "react";
import { listenToFriendsOnlineStatus } from "../firebase/firestore";

export function useFriendsOnlineStatus(user, friends) {
  const [friendsOnlineStatus, setFriendsOnlineStatus] = useState({});
  const updateTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user || friends.length === 0) return;

    const friendIds = friends.map(friend => friend.uid);
    
    const unsubscribe = listenToFriendsOnlineStatus(friendIds, (status) => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        setFriendsOnlineStatus(status);
      }, 200);
    });

    return () => {
      unsubscribe();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [user, friends]);

  return { friendsOnlineStatus };
}