import { useState, useEffect } from "react";
import { listenToUserProfile } from "../firebase/firestore";

export function useProfile(user) {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserProfile(user.uid, (profile) => {
      setUserProfile(profile);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return { userProfile, loading };
}