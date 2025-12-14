import { useState, useEffect } from "react";
import { listenToUserFriends, getUserFriends } from "../firebase/firestore";

export function useFriends(user) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserFriends(user.uid, async (friendIds) => {
      try {
        const friendsList = await getUserFriends(user.uid);
        setFriends(friendsList);
        setLoading(false);
      } catch (err) {
        console.error("Error loading friends:", err);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  return { friends, loading };
}
