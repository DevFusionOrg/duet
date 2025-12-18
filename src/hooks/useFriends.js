import { useState, useEffect } from "react";
import { listenToUserFriends, getUserProfile } from "../firebase/firestore";

export function useFriends(user) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = listenToUserFriends(user.uid, async (friendIds) => {
      try {
        const profiles = await Promise.all(
          friendIds.map(id => 
            getUserProfile(id).then(profile => ({
              ...profile,
              uid: id,
              id: id
            }))
          )
        );
        
        const cleanFriends = profiles.filter(Boolean);

        setFriends(cleanFriends);
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
