import { useState, useCallback } from "react";
import { getBlockedUsers, unblockUser } from "../firebase/firestore";

export function useBlockedUsersProfile(user, isOwnProfile) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);

  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid || !isOwnProfile) return;
    
    setLoadingBlockedUsers(true);
    try {
      const blockedList = await getBlockedUsers(user.uid);
      setBlockedUsers(blockedList);
    } catch (error) {
      console.error("Error loading blocked users:", error);
      throw new Error("Error loading blocked users: " + error.message);
    } finally {
      setLoadingBlockedUsers(false);
    }
  }, [user?.uid, isOwnProfile]);

  const handleUnblockUser = async (userId, onSuccess) => {
    if (!user?.uid) return;

    const confirmUnblock = window.confirm(
      "Are you sure you want to unblock this user? You will be able to message each other again."
    );
    
    if (!confirmUnblock) return;

    try {
      await unblockUser(user.uid, userId);
      await loadBlockedUsers();
      
      if (onSuccess) onSuccess();
      return true;
    } catch (error) {
      console.error("Error unblocking user:", error);
      throw new Error("Error unblocking user: " + error.message);
    }
  };

  return {
    blockedUsers,
    showBlockedUsers,
    loadingBlockedUsers,
    setShowBlockedUsers,
    loadBlockedUsers,
    handleUnblockUser
  };
}