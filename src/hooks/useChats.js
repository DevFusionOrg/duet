import { useState, useEffect } from "react";
import { listenToUserChats } from "../firebase/firestore";

export function useChats(user) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserChats(user.uid, (userChats) => {
      setChats(userChats);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return { chats, loading };
}