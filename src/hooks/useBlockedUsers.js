import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";

export function useBlockedUsers(userId, friendId) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);

  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const blockedList = userData.blockedUsers || [];
        setBlockedUsers(blockedList);
        const isUserBlocked = friendId ? blockedList.includes(friendId) : false;
        setIsBlocked(isUserBlocked);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId, friendId]);

  return { isBlocked, blockedUsers, setIsBlocked };
}