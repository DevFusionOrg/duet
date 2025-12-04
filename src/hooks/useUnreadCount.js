import { useState, useEffect } from "react";
import { listenToUnreadMessagesCount } from "../firebase/firestore";

export function useUnreadCount(user) {
  const [unreadFriendsCount, setUnreadFriendsCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUnreadMessagesCount(user.uid, (count) => {
      setUnreadFriendsCount(count);
    });
    
    return unsubscribe;
  }, [user]);

  return { unreadFriendsCount };
}