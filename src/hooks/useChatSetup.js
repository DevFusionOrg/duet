import { useState, useEffect } from "react";
import { getOrCreateChat, getUserFriends, markMessagesAsRead } from "../firebase/firestore";

export function useChatSetup(user, friend) {
  const [chatId, setChatId] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !friend) return;
    
    const setup = async () => {
      try {
        const id = await getOrCreateChat(user.uid, friend.uid);
        setChatId(id);
        await markMessagesAsRead(id, user.uid);
        
        const userFriends = await getUserFriends(user.uid);
        setFriends(userFriends);
      } catch (error) {
        console.error("Error initializing chat:", error);
      } finally {
        setLoading(false);
      }
    };
    
    setup();
  }, [user, friend]);

  return { chatId, friends, loading };
}