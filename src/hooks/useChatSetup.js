import { useState, useEffect } from "react";
import {
  getOrCreateChat,
  getUserFriends,
  markMessagesAsRead,
  getUserProfile
} from "../firebase/firestore";

export function useChatSetup(user, friend) {
  const [chatId, setChatId] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const friendId = friend?.uid || friend?.id;
    if (!user?.uid || !friendId) {
      setChatId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        const [userProfile, friendProfile] = await Promise.all([
          getUserProfile(user.uid),
          getUserProfile(friendId),
        ]);

        if (
          userProfile?.blockedUsers?.includes(friendId) ||
          friendProfile?.blockedUsers?.includes(user.uid)
        ) {
          setChatId(null);
          return;
        }

        const id = await getOrCreateChat(user.uid, friendId);
        if (cancelled) return;

        setChatId(id);
        await markMessagesAsRead(id, user.uid);

        const userFriends = await getUserFriends(user.uid);
        setFriends(userFriends);
      } catch (error) {
        console.error("Error initializing chat:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, friend?.uid, friend?.id]);

  return { chatId, friends, loading };
}
