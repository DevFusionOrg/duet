import { useState, useEffect, useMemo } from "react";
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
        // Memoization happens in useMemo below
        setFriends(profiles);
      } catch (err) {
        console.error("Error loading friends:", err);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  // Memoize friends list to prevent unnecessary re-renders in child components
  const memoizedFriends = useMemo(() => {
    // Sort friends alphabetically for consistent UI
    return [...friends].sort((a, b) => 
      (a.displayName || '').localeCompare(b.displayName || '')
    );
  }, [friends]);

  return { friends: memoizedFriends, loading };
}
