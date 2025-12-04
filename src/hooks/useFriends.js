import { useState, useEffect } from "react";
import { getUserFriends } from "../firebase/firestore";

export function useFriends(user) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadFriends = async () => {
      try {
        const friendsList = await getUserFriends(user.uid);
        setFriends(friendsList);
        setLoading(false);
      } catch (error) {
        console.error("Error loading friends:", error);
        setLoading(false);
      }
    };

    loadFriends();
  }, [user]);

  return { friends, loading };
}