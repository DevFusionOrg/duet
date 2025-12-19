import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getBlockedUsers } from "../firebase/firestore";

export function useBlockedUsers(userId) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "users", userId);

    const unsubscribe = onSnapshot(userRef, async (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      const blockedIds = data.blockedUsers || [];

      if (blockedIds.length === 0) {
        setBlockedUsers([]);
        setLoadingBlockedUsers(false);
        return;
      }

      const profiles = await getBlockedUsers(userId);
      setBlockedUsers(profiles);
      setLoadingBlockedUsers(false);
    });

    return unsubscribe;
  }, [userId]);

  const handleUnblockUser = async (blockedUserId, onSuccess) => {
    if (!blockedUserId || typeof blockedUserId !== "string") {
      throw new Error("Invalid blocked user");
    }

    const userRef = doc(db, "users", userId);

    await updateDoc(userRef, {
      blockedUsers: arrayRemove(blockedUserId),
    });

    if (onSuccess) onSuccess();
  };

  return {
    blockedUsers,          
    showBlockedUsers,
    setShowBlockedUsers,
    loadingBlockedUsers,
    handleUnblockUser,
  };
}
