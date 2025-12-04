import { useState, useEffect } from "react";
import { listenToFriendsOnlineStatus } from "../firebase/firestore";

export function useOnlineStatus(user, friends) {
  const [friendsOnlineStatus, setFriendsOnlineStatus] = useState({});

  useEffect(() => {
    if (!user || friends.length === 0) return;

    const friendIds = friends.map(friend => friend.uid);
    const unsubscribe = listenToFriendsOnlineStatus(friendIds, (status) => {
      setFriendsOnlineStatus(status);
    });

    return unsubscribe;
  }, [user, friends]);

  return { friendsOnlineStatus };
}