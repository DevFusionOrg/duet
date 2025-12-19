import { useState, useEffect } from "react";
import { listenToUserFriends, getUserFriendsWithProfiles } from "../firebase/firestore";

export function useFriends(user) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = listenToUserFriends(user.uid, async (friendIds) => {
      try {
        if (friendIds.length === 0) {
          setFriends([]);
          setLoading(false);
          return;
        }

        const profiles = await getUserFriendsWithProfiles(friendIds);
        setFriends(profiles);
      } catch (err) {
        console.error("Error loading friends:", err);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  return { friends, loading };
}
